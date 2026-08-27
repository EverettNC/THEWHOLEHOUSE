import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HearingEngine, type HearingFrame, type Waveform } from "@/lib/audio/engine";
import { inspectMic } from "@/lib/audio/mic";
import { midiToFreq } from "@/lib/audio/notes";
import { measureProxies, type SpectralProxies } from "@/lib/audio/proxies";
import {
  appendSample,
  clearCorpusStore,
  finishTrial,
  loadCorpus,
  saveCorpus,
  summarizeCorpus,
  type CalibSample,
  type CorpusSummary,
} from "@/lib/audio/corpus";
import {
  clearSeat,
  compareToSeat,
  loadSeat,
  saveSeat,
  seatFromEvents,
  type SpeakerSeat,
  type VsSeat,
} from "@/lib/audio/speaker";
import { VocalTracker, type VocalEvent } from "@/lib/audio/vocalization";
import {
  routeForAlphaVox,
  type AcousticKey,
} from "@/lib/audio/alphavox-router";
import { postAcousticKey } from "@/lib/audio/alphavox-live";
import { HOUSE_CHANNEL, earFromFrame } from "@/modules/memory/house";

export type MicState = "off" | "pending" | "on" | "denied";
export type Mode = "listen" | "tone" | "train";

export type LiveFrame = HearingFrame & { proxies: SpectralProxies };

type HearingApi = {
  opened: boolean;
  opening: boolean;
  mic: MicState;
  framed: boolean;
  mode: Mode;
  a4: number;
  waveform: Waveform;
  volume: number;
  held: number[];
  last: LiveFrame | null;
  events: VocalEvent[];
  lastAcousticKey: AcousticKey;
  lastVs: VsSeat | null;
  seat: SpeakerSeat | null;
  voicedForSeat: number;
  restRms: number;
  liveVocalMs: number;
  error: string | null;
  blind: boolean;
  setBlind: (b: boolean) => void;
  seatVoice: () => boolean;
  clearVoice: () => void;
  open: () => Promise<void>;
  startMic: () => Promise<void>;
  stopMic: () => void;
  setMode: (m: Mode) => void;
  setA4: (n: number) => void;
  setWaveform: (w: Waveform) => void;
  setVolume: (v: number) => void;
  playMidi: (midi: number, opts?: { duration?: number; cents?: number }) => void;
  releaseMidi: (midi: number) => void;
  releaseAll: () => void;
  subscribe: (fn: (f: LiveFrame) => void) => () => void;
  corpus: CalibSample[];
  corpusSummary: CorpusSummary;
  clearCorpus: () => void;
};

type OpenTrial = {
  midi: number;
  expectedHz: number;
  until: number | null;
  locks: number[];
  peakRms: number;
  waveform: Waveform;
  a4: number;
  source: Mode;
};

const HearingContext = createContext<HearingApi | null>(null);

export function HearingProvider({ children }: { children: ReactNode }) {
  const engine = useRef<HearingEngine | null>(null);
  const listeners = useRef(new Set<(f: LiveFrame) => void>());
  const tracker = useRef(new VocalTracker());
  const raf = useRef(0);
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [mic, setMic] = useState<MicState>("off");
  const micRef = useRef<MicState>("off");
  const houseCh = useRef<BroadcastChannel | null>(null);
  const lastHouse = useRef(0);
  const [mode, setMode] = useState<Mode>("listen");
  const [a4, setA4State] = useState(440);
  const [waveform, setWaveformState] = useState<Waveform>("sine");
  const [volume, setVolumeState] = useState(0.22);
  const [held, setHeld] = useState<number[]>([]);
  const [last, setLast] = useState<LiveFrame | null>(null);
  const [events, setEvents] = useState<VocalEvent[]>([]);
  const [lastAcousticKey, setLastAcousticKey] = useState<AcousticKey>("unknown");
  const [seat, setSeat] = useState<SpeakerSeat | null>(null);
  const seatRef = useRef<SpeakerSeat | null>(null);
  const [lastVs, setLastVs] = useState<VsSeat | null>(null);
  const [restRms, setRestRms] = useState(0);
  const restBuf = useRef<number[]>([]);
  const [liveVocalMs, setLiveVocalMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [framed, setFramed] = useState(false);
  const [blind, setBlind] = useState(false);
  const lastUi = useRef(0);
  const modeRef = useRef<Mode>("listen");
  const a4Ref = useRef(440);
  const waveRef = useRef<Waveform>("sine");
  const trials = useRef(new Map<number, OpenTrial>());
  const [corpus, setCorpus] = useState<CalibSample[]>([]);

  const flushTrial = useCallback((midi: number) => {
    const open = trials.current.get(midi);
    if (!open) return;
    trials.current.delete(midi);
    const sample = finishTrial(open);
    setCorpus((prev) => {
      const next = appendSample(prev, sample);
      saveCorpus(next);
      return next;
    });
  }, []);

  useEffect(() => {
    micRef.current = mic;
  }, [mic]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    a4Ref.current = a4;
  }, [a4]);
  useEffect(() => {
    waveRef.current = waveform;
  }, [waveform]);

  useEffect(() => {
    setFramed(inspectMic().framed);
    const loaded = loadSeat();
    setSeat(loaded);
    seatRef.current = loaded;
    setCorpus(loadCorpus());
  }, []);

  const loop = useCallback(() => {
    const e = engine.current;
    if (!e) return;
    const raw = e.sample();
    const frame: LiveFrame = {
      ...raw,
      proxies: measureProxies(
        raw.freqData,
        raw.timeData,
        raw.sampleRate,
        raw.fftSize,
        raw.rms,
        raw.pitch && raw.pitch.probability > 0.62 ? raw.pitch.freq : null,
      ),
    };
    const f0 =
      frame.pitch && frame.pitch.probability > 0.62 ? frame.pitch.freq : null;
    if (trials.current.size > 0) {
      const due: number[] = [];
      trials.current.forEach((trial, midi) => {
        if (f0 != null) trial.locks.push(f0);
        if (frame.rms > trial.peakRms) trial.peakRms = frame.rms;
        if (trial.until != null && frame.time >= trial.until) due.push(midi);
      });
      due.forEach((midi) => flushTrial(midi));
    }
    const closed = tracker.current.step(
      frame.time,
      frame.rms,
      frame.proxies.zcr,
      f0,
      frame.proxies.formants.f1,
      frame.proxies.formants.f2,
    );
    if (frame.rms < 0.008) {
      const buf = restBuf.current;
      buf.push(frame.rms);
      if (buf.length > 120) buf.shift();
    }
    listeners.current.forEach((fn) => fn(frame));
    const now = performance.now();
    if (now - lastUi.current > 50) {
      lastUi.current = now;
      setLast(frame);
      setLiveVocalMs(tracker.current.durationMs(frame.time));
      if (restBuf.current.length > 8) {
        const s = [...restBuf.current].sort((a, b) => a - b);
        setRestRms(s[Math.floor(s.length / 2)] ?? 0);
      }
      if (closed) {
        const ring = [...tracker.current.events];
        setEvents(ring);
        const key = routeForAlphaVox(ring);
        setLastAcousticKey(key);
        postAcousticKey(key);
        setLastVs(compareToSeat(closed, seatRef.current));
      }
      if (now - lastHouse.current > 400) {
        lastHouse.current = now;
        try {
          if (typeof BroadcastChannel !== "undefined") {
            if (!houseCh.current) houseCh.current = new BroadcastChannel(HOUSE_CHANNEL);
            houseCh.current.postMessage({
              source: "corti",
              t: Date.now(),
              corti: earFromFrame({
                listening: micRef.current === "on",
                rms: frame.rms,
                zcr: frame.proxies.zcr,
                f0,
              }),
            });
          }
        } catch {
          /* house is optional */
        }
      }
    }
    raf.current = requestAnimationFrame(loop);
  }, [flushTrial]);

  const open = useCallback(async () => {
    if (engine.current || opening) return;
    setOpening(true);
    setError(null);
    try {
      const e = new HearingEngine();
      await e.resume();
      engine.current = e;
      setOpened(true);
      raf.current = requestAnimationFrame(loop);
      const wake = [60, 64, 67, 72];
      wake.forEach((midi, i) => {
        window.setTimeout(() => e.playMidi(midi, { duration: 0.38 }), i * 280);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audio context failed to open.";
      setError(message);
    } finally {
      setOpening(false);
    }
  }, [loop, opening]);

  const startMic = useCallback(async () => {
    if (!engine.current) await open();
    const e = engine.current;
    if (!e) return;
    setMic("pending");
    setError(null);
    try {
      await e.startMic();
      setMic("on");
    } catch (err) {
      setMic("denied");
      const message =
        err instanceof Error ? err.message : "Microphone permission was denied.";
      setError(message);
    }
  }, [open]);

  const stopMic = useCallback(() => {
    engine.current?.stopMic();
    setMic("off");
  }, []);

  const setA4 = useCallback((n: number) => {
    setA4State(n);
    if (engine.current) engine.current.a4 = n;
  }, []);

  const setWaveform = useCallback((w: Waveform) => {
    setWaveformState(w);
    if (engine.current) engine.current.waveform = w;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (engine.current) engine.current.volume = v;
  }, []);

  const playMidi = useCallback(
    (midi: number, opts?: { duration?: number; cents?: number }) => {
      const e = engine.current;
      if (!e) return;
      e.playMidi(midi, { id: `key-${midi}`, ...opts });
      const expectedHz = midiToFreq(midi + (opts?.cents ?? 0) / 100, a4Ref.current);
      if (trials.current.has(midi)) flushTrial(midi);
      trials.current.set(midi, {
        midi,
        expectedHz,
        until:
          opts?.duration != null ? performance.now() + opts.duration * 1000 : null,
        locks: [],
        peakRms: 0,
        waveform: waveRef.current,
        a4: a4Ref.current,
        source: modeRef.current,
      });
      if (opts?.duration == null) {
        setHeld((h) => (h.includes(midi) ? h : [...h, midi]));
      }
    },
    [flushTrial],
  );

  const releaseMidi = useCallback(
    (midi: number) => {
      engine.current?.release(`key-${midi}`);
      flushTrial(midi);
      setHeld((h) => h.filter((m) => m !== midi));
    },
    [flushTrial],
  );

  const releaseAll = useCallback(() => {
    engine.current?.releaseAll();
    setHeld([]);
  }, []);

  const seatVoice = useCallback(() => {
    const next = seatFromEvents(tracker.current.events, restRms);
    if (!next) return false;
    saveSeat(next);
    seatRef.current = next;
    setSeat(next);
    const newest = tracker.current.events[0];
    if (newest) setLastVs(compareToSeat(newest, next));
    return true;
  }, [restRms]);

  const clearVoice = useCallback(() => {
    clearSeat();
    seatRef.current = null;
    setSeat(null);
    setLastVs(null);
  }, []);

  const clearCorpus = useCallback(() => {
    clearCorpusStore();
    setCorpus([]);
  }, []);

  const subscribe = useCallback((fn: (f: LiveFrame) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(raf.current);
      engine.current?.dispose();
      engine.current = null;
      houseCh.current?.close();
      houseCh.current = null;
    };
  }, []);

  useEffect(() => {
    const map: Record<string, number> = {
      a: 60,
      w: 61,
      s: 62,
      e: 63,
      d: 64,
      f: 65,
      t: 66,
      g: 67,
      y: 68,
      h: 69,
      u: 70,
      j: 71,
      k: 72,
    };
    const onKey = (ev: KeyboardEvent) => {
      if (!engine.current) return;
      if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const midi = map[ev.key.toLowerCase()];
      if (midi == null) return;
      ev.preventDefault();
      playMidi(midi);
    };
    const onUp = (ev: KeyboardEvent) => {
      const midi = map[ev.key.toLowerCase()];
      if (midi == null) return;
      releaseMidi(midi);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [playMidi, releaseMidi]);

  return (
    <HearingContext.Provider
      value={{
        opened,
        opening,
        mic,
        framed,
        mode,
        a4,
        waveform,
        volume,
        held,
        last,
        events,
        lastAcousticKey,
        lastVs,
        seat,
        voicedForSeat: events.filter((e) => e.voiced && e.f0 != null).length,
        restRms,
        liveVocalMs,
        error,
        blind,
        setBlind,
        seatVoice,
        clearVoice,
        open,
        startMic,
        stopMic,
        setMode,
        setA4,
        setWaveform,
        setVolume,
        playMidi,
        releaseMidi,
        releaseAll,
        subscribe,
        corpus,
        corpusSummary: summarizeCorpus(corpus),
        clearCorpus,
      }}
    >
      {children}
    </HearingContext.Provider>
  );
}

export function useHearing() {
  const ctx = useContext(HearingContext);
  if (!ctx) throw new Error("useHearing must be used inside HearingProvider");
  return ctx;
}
