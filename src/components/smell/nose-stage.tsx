import { FlaskConical, Square, Upload, Usb, Wind } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HOUSE_CHANNEL, noseFromReading } from "@/modules/memory/house";
import { parseSmellPayload, parseSmellText, serialLineToIntensity } from "@/lib/smell/parse";
import { canSerial, isFramed, openSerialSniff, type SerialHandle } from "@/lib/smell/serial";
import { useSmell } from "@/lib/smell/store";
import type { SmellKind, SmellReading } from "@/lib/smell/types";
import { cn } from "@/lib/utils";

const HALLWAY = "/samples/hallway-air.json";
const SIM = "/samples/opensmell-sim.json";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

export function NoseStage() {
  const { addTake, setLive, liveIntensity, sniffing } = useSmell();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [framed, setFramed] = useState(false);
  const [serialOn, setSerialOn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const serialRef = useRef<SerialHandle | null>(null);
  const baselineBuf = useRef<number[]>([]);
  const baselineRef = useRef<number | null>(null);
  const histRef = useRef<number[]>(new Array(64).fill(0));
  const liveRef = useRef(liveIntensity);
  liveRef.current = liveIntensity;

  useEffect(() => {
    setFramed(isFramed());
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(HOUSE_CHANNEL);
    const id = window.setInterval(() => {
      const s = useSmell.getState();
      ch.postMessage({
        source: "opensmell",
        t: Date.now(),
        smell: noseFromReading({
          sniffing: s.sniffing,
          kind: s.liveKind,
          intensity: s.liveIntensity,
          baseline: s.liveBaseline,
        }),
      });
    }, 400);
    return () => {
      ch.postMessage({
        source: "opensmell",
        t: Date.now(),
        smell: noseFromReading({ sniffing: false, kind: null, intensity: null, baseline: null }),
      });
      window.clearInterval(id);
      ch.close();
    };
  }, []);

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
      const v = liveRef.current ?? 0;
      const hist = histRef.current;
      hist.push(v);
      if (hist.length > 64) hist.shift();
      ctx.fillStyle = "color-mix(in oklab, var(--color-fg) 6%, transparent)";
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      hist.forEach((n, i) => {
        const x = (i / (hist.length - 1)) * w;
        const y = h - n * h * 0.86 - 8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "color-mix(in oklab, var(--color-fg) 70%, transparent)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      requestAnimationFrame(paint);
    };
    const raf = requestAnimationFrame(paint);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const ingest = useCallback(
    (reading: SmellReading) => {
      setError(null);
      addTake(reading);
      if (reading.kind !== "serial") {
        setLive({
          sniffing: true,
          kind: reading.kind,
          intensity: reading.intensity,
          baseline: reading.baseline,
        });
      }
    },
    [addTake, setLive],
  );

  async function loadSample(url: string, fallbackKind: SmellKind) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Sample air is not here.");
      const parsed = parseSmellPayload(await res.json(), fallbackKind);
      if (!parsed) throw new Error("Sample air would not parse.");
      ingest({
        kind: parsed.kind,
        claim: parsed.claim,
        intensity: parsed.intensity,
        baseline: parsed.baseline,
        channels: parsed.channels,
        at: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample air is not here.");
    }
  }

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseSmellText(text, "file");
    if (!parsed) {
      setError("That file is not a reading. JSON or a number.");
      return;
    }
    ingest({
      kind: "file",
      claim: parsed.claim === "simulation" ? "simulation" : "record",
      intensity: parsed.intensity,
      baseline: parsed.baseline,
      channels: parsed.channels,
      at: Date.now(),
    });
  }

  async function startSerial() {
    setError(null);
    if (!canSerial()) {
      setError(
        framed
          ? "This preview cannot hold a serial nose. Open OpenSmell in its own window, or drop a reading."
          : "This window has no serial nose. Drop a reading.",
      );
      return;
    }
    try {
      const handle = await openSerialSniff((line) => {
        const intensity = serialLineToIntensity(line);
        if (intensity == null) return;
        const buf = baselineBuf.current;
        if (buf.length < 20) {
          buf.push(intensity);
          baselineRef.current = median(buf);
        }
        setLive({
          sniffing: true,
          kind: "serial",
          intensity,
          baseline: baselineRef.current,
        });
      });
      serialRef.current = handle;
      setSerialOn(true);
      setLive({ sniffing: true, kind: "serial", intensity: 0, baseline: null });
    } catch (err) {
      setSerialOn(false);
      setError(
        err instanceof Error
          ? err.message
          : "This preview cannot hold a serial nose. Open OpenSmell in its own window, or drop a reading.",
      );
    }
  }

  async function stopSerial() {
    await serialRef.current?.close();
    serialRef.current = null;
    setSerialOn(false);
    setLive({ sniffing: false, kind: null, intensity: null, baseline: null });
  }

  useEffect(
    () => () => {
      void serialRef.current?.close();
    },
    [],
  );

  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-surface p-5 shadow-border">
      <div className="relative h-44 overflow-hidden rounded-lg bg-raised shadow-border">
        <canvas ref={canvasRef} className="size-full" aria-hidden />
      </div>
      <p className="mt-3 font-mono text-xs tabular-nums text-muted" data-testid="smell-intensity">
        Intensity {liveIntensity == null ? "—" : liveIntensity.toFixed(2)}
        {sniffing ? " · sniffing" : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {serialOn ? (
          <Button type="button" variant="outline" onClick={() => void stopSerial()} data-testid="smell-sniff">
            <Square />
            Close nose
          </Button>
        ) : (
          <Button type="button" onClick={() => void startSerial()} data-testid="smell-sniff">
            <Usb />
            Sniff serial
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} data-testid="smell-drop">
          <Upload />
          Drop a reading
        </Button>
        <Button type="button" variant="outline" onClick={() => void loadSample(HALLWAY, "sample")} data-testid="smell-sample">
          <Wind />
          Hallway sample
        </Button>
        <Button type="button" variant="outline" onClick={() => void loadSample(SIM, "file")} data-testid="smell-sim">
          <FlaskConical />
          Simulation
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,text/plain,text/csv,.json,.txt,.csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void onFile(file);
        }}
      />
      <div
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-sm text-muted",
          dragging && "bg-raised text-fg",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void onFile(file);
        }}
      >
        Drop JSON here. One voltage, or twenty proxy channels labeled simulation.
      </div>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}{" "}
          {framed ? (
            <a
              href={typeof window !== "undefined" ? window.location.href : "/smell"}
              target="_blank"
              rel="noreferrer"
              className="text-fg underline decoration-border underline-offset-4"
            >
              Open OpenSmell in its own window
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
