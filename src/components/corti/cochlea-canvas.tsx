import { useEffect, useRef } from "react";
import {
  COCHLEA_FMAX,
  COCHLEA_FMIN,
  freqToPlace,
  midiName,
  placeToFreq,
} from "@/lib/audio/notes";
import { useHearing, type LiveFrame } from "./hearing-context";

const TURNS = 2.62;
const CELLS = 168;
const PHASE = Math.PI * 0.42;

function sampleMag(frame: LiveFrame, freq: number): number {
  const nyquist = frame.sampleRate / 2;
  const idx = (freq / nyquist) * (frame.freqData.length - 1);
  const i0 = Math.max(0, Math.floor(idx));
  const i1 = Math.min(frame.freqData.length - 1, i0 + 1);
  const t = idx - i0;
  const a = (frame.freqData[i0] ?? 0) / 255;
  const b = (frame.freqData[i1] ?? 0) / 255;
  return a * (1 - t) + b * t;
}

function travelingWave(s: number, peakS: number, energy: number): number {
  const d = s - peakS;
  const env = d < 0 ? Math.exp(-d * d * 22) * 0.4 : Math.exp(-d * d * 78);
  return env * energy;
}

export function CochleaCanvas() {
  const { subscribe, last, blind } = useHearing();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<LiveFrame | null>(null);
  const idleRef = useRef(0);
  const blindRef = useRef(blind);
  blindRef.current = blind;

  useEffect(() => {
    return subscribe((f) => {
      frameRef.current = f;
    });
  }, [subscribe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const styles = getComputedStyle(canvas);
    const accent = styles.getPropertyValue("--color-accent").trim() || "#c8d0d6";
    const fg = styles.getPropertyValue("--color-fg").trim() || "#eceae6";

    const draw = (t: number) => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 480;
      const h = parent?.clientHeight ?? 480;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + 4;
      const maxR = Math.min(w, h) * 0.42;
      const minR = maxR * 0.07;
      const frame = frameRef.current;
      const energy = frame ? Math.min(1, frame.rms * 14) : 0;
      const peakPlace =
        blindRef.current || !frame?.note ? null : freqToPlace(frame.note.freq);
      const peakS = peakPlace == null ? null : 1 - peakPlace;
      idleRef.current = t;

      ctx.strokeStyle = "rgba(236,234,230,0.045)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 7; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, minR + ((maxR - minR) * i) / 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * minR, cy + Math.sin(a) * minR);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      }

      ctx.beginPath();
      for (let i = 0; i <= 480; i++) {
        const s = i / 480;
        const theta = s * TURNS * Math.PI * 2 + PHASE;
        const r = maxR - s * (maxR - minR);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(200,208,214,0.22)";
      ctx.lineWidth = 1.25;
      ctx.stroke();

      for (let i = 0; i < CELLS; i++) {
        const s = i / (CELLS - 1);
        const place = 1 - s;
        const freq = placeToFreq(place);
        if (freq < COCHLEA_FMIN || freq > COCHLEA_FMAX) continue;
        const theta = s * TURNS * Math.PI * 2 + PHASE;
        const r = maxR - s * (maxR - minR);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        const s2 = Math.min(1, s + 0.01);
        const th2 = s2 * TURNS * Math.PI * 2 + PHASE;
        const r2 = maxR - s2 * (maxR - minR);
        const tx = Math.cos(th2) * r2 - Math.cos(theta) * r;
        const ty = Math.sin(th2) * r2 - Math.sin(theta) * r;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len;
        const ny = tx / len;
        const spec = frame ? sampleMag(frame, freq) : 0;
        const wave = peakS == null ? 0 : travelingWave(s, peakS, Math.max(energy, 0.35));
        const idle = 0.04 + 0.03 * Math.sin(t / 1800 + s * 9);
        const amp = Math.max(idle, spec * 1.15, wave);
        const cilia = 3.2 + amp * 9;
        ctx.strokeStyle = `rgba(200, 208, 214, ${0.07 + amp * 0.9})`;
        ctx.lineWidth = 1 + amp * 1.7;
        ctx.beginPath();
        ctx.moveTo(x - nx * cilia, y - ny * cilia);
        ctx.lineTo(x + nx * cilia * 0.35, y + ny * cilia * 0.35);
        ctx.stroke();
      }

      const labels = [24, 36, 48, 60, 72, 84, 96];
      ctx.fillStyle = "rgba(236,234,230,0.38)";
      ctx.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      for (const midi of labels) {
        const freq = 440 * 2 ** ((midi - 69) / 12);
        const place = freqToPlace(freq);
        const s = 1 - place;
        const theta = s * TURNS * Math.PI * 2 + PHASE;
        const r = maxR - s * (maxR - minR) + 14;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        ctx.fillText(midiName(midi), x, y + 3);
      }

      ctx.beginPath();
      ctx.arc(cx, cy, minR * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(18,20,22,0.9)";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.35 + energy * 0.5;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.45;
      ctx.font = "9px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillText("APEX", cx, cy + 3);
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const locked = blind ? null : (last?.note?.name ?? null);

  return (
    <div className="relative aspect-square w-full max-w-[560px]">
      <canvas
        ref={canvasRef}
        className="size-full"
        aria-label="Greenwood cochlear place map"
      />
      <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-subtle">
        Base 20 kHz
      </p>
      <p className="pointer-events-none absolute bottom-2 right-3 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-subtle">
        {locked ? `CF ${locked}` : blind ? "Blind" : "No lock"}
      </p>
    </div>
  );
}
