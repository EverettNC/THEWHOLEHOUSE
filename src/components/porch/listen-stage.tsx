import { Loader2, Mic, Square, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribe } from "@/lib/porch/transcribe";
import { taughtLexicon, usePorch } from "@/lib/porch/store";
import { HOUSE_CHANNEL, notePartial } from "@/modules/memory/house";
import { useMemory } from "@/modules/memory/store";
import { postPorchLive } from "@/lib/house/bridge-feed";
import { blobToBase64, cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "hearing" | "error";
type EarSource = "mic" | "file" | "sample";

const CLIP_URL = "/samples/porch-clip.mp3";
const MIC_FAIL =
  "This preview cannot hold a microphone. Open Porch in its own window, or drop a clip.";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function ListenStage() {
  const { addTake, setActive, lexicon } = usePorch();
  const lexiconRef = useRef(lexicon);
  lexiconRef.current = lexicon;

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const paintRafRef = useRef(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const rmsHistRef = useRef<number[]>(new Array(64).fill(0));
  const genRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const stopGraph = useCallback(() => {
    const tracks = streamRef.current?.getTracks() ?? [];
    for (const t of tracks) t.stop();
    streamRef.current = null;
    void audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
    analyserRef.current = null;
    recRef.current = null;
  }, []);

  useEffect(
    () => () => {
      genRef.current += 1;
      stopGraph();
    },
    [stopGraph],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let live = true;

    const paint = () => {
      if (!live) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 176;
      const h = parent?.clientHeight ?? 176;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const styles = getComputedStyle(canvas);
      const accent = styles.getPropertyValue("--color-accent").trim() || "#c8d0d6";
      const fg = styles.getPropertyValue("--color-fg").trim() || "#eceae6";
      const cx = w / 2;
      const cy = h / 2;
      const outer = Math.min(w, h) * 0.48;
      const inner = outer * 0.62;

      const analyser = analyserRef.current;
      let rms = 0;
      if (analyser && phaseRef.current === "recording") {
        const buf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / buf.length);
        const hist = rmsHistRef.current;
        hist.push(rms);
        if (hist.length > 64) hist.shift();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = phaseRef.current === "recording" ? 0.55 : 0.18;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      const hist = rmsHistRef.current;
      const n = hist.length;
      for (let i = 0; i < n; i++) {
        const mag = Math.min(1, hist[i]! * 6);
        if (mag < 0.02 && phaseRef.current !== "recording") continue;
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r0 = inner + 4;
        const r1 = r0 + mag * (outer - inner - 8);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.strokeStyle = fg;
        ctx.globalAlpha = 0.25 + mag * 0.7;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      paintRafRef.current = requestAnimationFrame(paint);
    };

    paintRafRef.current = requestAnimationFrame(paint);
    return () => {
      live = false;
      cancelAnimationFrame(paintRafRef.current);
    };
  }, []);

  const hearBlob = useCallback(
    async (blob: Blob, mime: string, source: EarSource, filename?: string) => {
      setPhase("hearing");
      setError(null);
      if (blob.size < 32) {
        setPhase("error");
        setError("Nothing on the tape. Hold a little longer.");
        void postPorchLive({ listening: false });
        return;
      }
      try {
        const audioBase64 = await blobToBase64(blob);
        const result = await transcribe({
          data: {
            audioBase64,
            mime,
            filename,
            extraLexicon: taughtLexicon(lexiconRef.current),
            source,
          },
        });
        if (!result.ok) {
          setPhase("error");
          setError(result.error);
          void postPorchLive({ listening: false });
          return;
        }
        addTake(result.take);
        setActive(result.take.id);
        void postPorchLive({ listening: false, take: result.take });
        const said = result.take.asSaid.trim();
        if (said) {
          notePartial({
            source: "porch",
            t: Date.now(),
            porch: { speaking: true, asSaid: said, at: result.take.at },
          });
          try {
            if (typeof BroadcastChannel !== "undefined") {
              const ch = new BroadcastChannel(HOUSE_CHANNEL);
              ch.postMessage({
                source: "porch",
                t: Date.now(),
                porch: { speaking: true, asSaid: said, at: result.take.at },
              });
              ch.close();
            }
          } catch {
            /* house is optional */
          }
          useMemory.getState().ingestPorch(said);
        }
        toast("Heard.");
        setPhase("idle");
      } catch (err) {
        void postPorchLive({ listening: false });
        setPhase("error");
        setError(err instanceof Error ? err.message : "The ear did not answer.");
      }
    },
    [addTake, setActive],
  );

  const stopRecording = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else void postPorchLive({ listening: false });
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError(MIC_FAIL);
      return;
    }
    const mime = pickMime();
    const gen = ++genRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (genRef.current !== gen) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      streamRef.current = stream;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const actx = new AC();
        if (actx.state === "suspended") await actx.resume();
        const source = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        audioRef.current = actx;
        analyserRef.current = analyser;
      }
      rmsHistRef.current = new Array(64).fill(0);
      chunksRef.current = [];
      let rec: MediaRecorder;
      try {
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch {
        rec = new MediaRecorder(stream);
      }
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopGraph();
        if (genRef.current !== gen) return;
        void hearBlob(blob, type, "mic");
      };
      rec.start(100);
      setPhase("recording");
      void postPorchLive({ listening: true });
    } catch {
      stopGraph();
      setPhase("error");
      setError(MIC_FAIL);
    }
  }, [hearBlob, stopGraph]);

  const toggleOrb = useCallback(() => {
    if (phaseRef.current === "hearing") return;
    if (phaseRef.current === "recording") {
      stopRecording();
      return;
    }
    void startRecording();
  }, [startRecording, stopRecording]);

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file || phaseRef.current === "hearing" || phaseRef.current === "recording") return;
      const named = /\.(mp3|wav|m4a|ogg|webm|flac|aac)$/i.test(file.name);
      if (!file.type.startsWith("audio/") && !named) {
        setPhase("error");
        setError("That is not a clip I can hear.");
        return;
      }
      void hearBlob(file, file.type || "audio/mpeg", "file", file.name);
    },
    [hearBlob],
  );

  const tryClip = useCallback(async () => {
    if (phaseRef.current === "hearing" || phaseRef.current === "recording") return;
    setError(null);
    setPhase("hearing");
    try {
      const res = await fetch(CLIP_URL);
      if (!res.ok) throw new Error("The porch clip is not here.");
      const blob = await res.blob();
      await hearBlob(blob, blob.type || "audio/mpeg", "sample", "porch-clip.mp3");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "The porch clip is not here.");
    }
  }, [hearBlob]);

  const busy = phase === "hearing";
  const recording = phase === "recording";

  return (
    <section className="min-w-0 rounded-2xl bg-surface p-5 shadow-border">
      <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">
        The orb
      </p>

      <div className="relative mx-auto mt-4 size-40 sm:size-48">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
        <button
          type="button"
          aria-label={recording ? "Stop recording" : "Record"}
          aria-pressed={recording}
          disabled={busy}
          onClick={toggleOrb}
          className={cn(
            "absolute inset-8 flex items-center justify-center rounded-full bg-raised shadow-border transition-[transform,background-color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            recording && "bg-accent/20 shadow-border-hover",
            busy && "opacity-70",
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-fg" />
          ) : recording ? (
            <Square className="size-4 fill-current text-fg" />
          ) : (
            <Mic className="size-6 text-fg" />
          )}
        </button>
      </div>

      <p className="mt-3 text-center text-sm text-muted">
        {busy
          ? "Hearing."
          : recording
            ? "Press again to hear."
            : "Press the orb. Press again to hear."}
      </p>

      {error && (
        <p className="mt-3 text-center text-sm text-danger" role="alert" aria-live="polite">
          {error === MIC_FAIL ? (
            <>
              This preview cannot hold a microphone.{" "}
              <a
                href={typeof window !== "undefined" ? window.location.href : "/say"}
                target="_blank"
                rel="noreferrer"
                className="text-fg underline decoration-border underline-offset-4"
              >
                Open Porch in its own window
              </a>
              , or drop a clip.
            </>
          ) : (
            error
          )}
        </p>
      )}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "mt-5 flex min-h-11 flex-col items-center justify-center rounded-xl bg-raised px-4 py-4 text-center shadow-border transition-[box-shadow] duration-[var(--motion-quick)]",
          dragging && "shadow-border-hover",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={busy || recording}
          onClick={() => fileRef.current?.click()}
        >
          <Upload />
          Drop a clip. Or pick one.
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full"
        disabled={busy || recording}
        onClick={() => void tryClip()}
      >
        Try a porch clip
      </Button>
    </section>
  );
}
