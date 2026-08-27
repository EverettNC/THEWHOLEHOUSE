import { analyzeNote, midiToFreq, type AnalyzedNote } from "./notes";
import { classifyMicError, inspectMic } from "./mic";
import {
  detectPitchYin,
  findPartials,
  rmsLevel,
  type PartialTone,
} from "./yin";

export type Waveform = "sine" | "triangle" | "square" | "sawtooth";

export type HearingFrame = {
  time: number;
  rms: number;
  freqData: Uint8Array;
  timeData: Float32Array;
  sampleRate: number;
  fftSize: number;
  pitch: { freq: number; probability: number } | null;
  note: AnalyzedNote | null;
  partials: PartialTone[];
};

type Voice = {
  id: string;
  osc: OscillatorNode;
  gain: GainNode;
  midi: number;
};

const FFT_SIZE = 4096;

export class HearingEngine {
  readonly ctx: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly mixer: GainNode;
  private readonly master: GainNode;
  private readonly micGain: GainNode;
  private readonly oscBus: GainNode;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private voices = new Map<string, Voice>();
  private freqBuf: Uint8Array<ArrayBuffer>;
  private timeBuf: Float32Array<ArrayBuffer>;
  private pitchClock = 0;
  private lastPitch: HearingFrame["pitch"] = null;
  a4 = 440;
  waveform: Waveform = "sine";
  volume = 0.22;

  constructor() {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.72;
    this.analyser.minDecibels = -92;
    this.analyser.maxDecibels = -18;
    this.mixer = this.ctx.createGain();
    this.master = this.ctx.createGain();
    this.micGain = this.ctx.createGain();
    this.oscBus = this.ctx.createGain();
    this.mixer.gain.value = 1;
    this.master.gain.value = 1;
    this.micGain.gain.value = 1.4;
    this.oscBus.gain.value = 1;
    this.oscBus.connect(this.mixer);
    this.oscBus.connect(this.master);
    this.micGain.connect(this.mixer);
    this.mixer.connect(this.analyser);
    this.master.connect(this.ctx.destination);
    this.freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeBuf = new Float32Array(this.analyser.fftSize);
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  async startMic(): Promise<void> {
    await this.resume();
    if (this.micSource) return;
    const pre = inspectMic();
    if (!pre.ok) {
      const err = new Error(pre.message);
      err.name = pre.code;
      throw err;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      const classified = classifyMicError(err);
      const wrapped = new Error(
        classified.ok ? "Microphone failed." : classified.message,
      );
      wrapped.name = classified.ok ? "UNKNOWN" : classified.code;
      throw wrapped;
    }
    this.micStream = stream;
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.micGain);
  }

  stopMic() {
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
  }

  playMidi(
    midi: number,
    opts: { duration?: number; id?: string; cents?: number } = {},
  ): string {
    const id = opts.id ?? `v-${midi}`;
    this.release(id);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = this.waveform;
    const detune = opts.cents ?? 0;
    osc.frequency.value = midiToFreq(midi + detune / 100, this.a4);
    const level =
      this.waveform === "sine"
        ? this.volume
        : this.waveform === "triangle"
          ? this.volume * 0.7
          : this.volume * 0.28;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), now + 0.018);
    osc.connect(gain);
    gain.connect(this.oscBus);
    osc.start(now);
    if (opts.duration != null) {
      const end = now + opts.duration;
      gain.gain.setValueAtTime(level, Math.max(now, end - 0.06));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.stop(end + 0.02);
      osc.onended = () => {
        try {
          gain.disconnect();
        } catch {
          /* already gone */
        }
        this.voices.delete(id);
      };
    }
    this.voices.set(id, { id, osc, gain, midi });
    return id;
  }

  release(id: string) {
    const v = this.voices.get(id);
    if (!v) return;
    const now = this.ctx.currentTime;
    try {
      const current = Math.max(0.0001, v.gain.gain.value);
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(current, now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      v.osc.stop(now + 0.06);
      v.osc.onended = () => {
        try {
          v.gain.disconnect();
        } catch {
          /* already gone */
        }
        this.voices.delete(id);
      };
    } catch {
      try {
        v.osc.stop();
      } catch {
        /* already gone */
      }
      this.voices.delete(id);
    }
  }

  releaseAll() {
    for (const id of [...this.voices.keys()]) this.release(id);
  }

  sample(): HearingFrame {
    this.analyser.getByteFrequencyData(this.freqBuf);
    this.analyser.getFloatTimeDomainData(this.timeBuf);
    const rms = rmsLevel(this.timeBuf);
    this.pitchClock += 1;
    if (rms > 0.008 && this.pitchClock % 2 === 0) {
      this.lastPitch = detectPitchYin(this.timeBuf, this.ctx.sampleRate);
    } else if (rms <= 0.008) {
      this.lastPitch = null;
    }
    const pitch =
      this.lastPitch && this.lastPitch.probability > 0.62
        ? this.lastPitch
        : null;
    const note = pitch ? analyzeNote(pitch.freq, this.a4) : null;
    const partials = findPartials(
      this.freqBuf,
      this.ctx.sampleRate,
      this.analyser.fftSize,
    );
    return {
      time: performance.now(),
      rms,
      freqData: this.freqBuf,
      timeData: this.timeBuf,
      sampleRate: this.ctx.sampleRate,
      fftSize: this.analyser.fftSize,
      pitch,
      note,
      partials,
    };
  }

  dispose() {
    this.releaseAll();
    this.stopMic();
    void this.ctx.close();
  }
}
