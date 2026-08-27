import { useEffect, useRef } from "react";
import { freqToPlace, placeToFreq } from "@/lib/audio/notes";
import { useHearing, type LiveFrame } from "./hearing-context";

const BINS = 96;

export function Spectrogram() {
  const { subscribe } = useHearing();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const col = useRef<Uint8Array>(new Uint8Array(BINS));

  useEffect(() => {
    return subscribe((frame: LiveFrame) => {
      const next = new Uint8Array(BINS);
      for (let i = 0; i < BINS; i++) {
        const place = i / (BINS - 1);
        const freq = placeToFreq(place);
        const nyquist = frame.sampleRate / 2;
        const idx = (freq / nyquist) * (frame.freqData.length - 1);
        const i0 = Math.max(0, Math.min(frame.freqData.length - 1, Math.floor(idx)));
        next[i] = frame.freqData[i0] ?? 0;
      }
      col.current = next;
    });
  }, [subscribe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 640;
      const h = parent?.clientHeight ?? 88;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#090a0b";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.drawImage(canvas, -1, 0, w, h);
      const data = col.current;
      for (let i = 0; i < BINS; i++) {
        const v = (data[i] ?? 0) / 255;
        const y = h - ((i + 1) / BINS) * h;
        const bh = h / BINS + 0.5;
        ctx.fillStyle = `rgba(200,208,214,${0.04 + v * 0.92})`;
        ctx.fillRect(w - 1, y, 1, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  void freqToPlace;

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-md bg-surface shadow-[var(--shadow-border)]">
      <canvas ref={canvasRef} className="size-full" aria-label="Log-frequency spectrogram" />
      <span className="pointer-events-none absolute left-3 top-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-subtle">
        Place · time
      </span>
    </div>
  );
}
