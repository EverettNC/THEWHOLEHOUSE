import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useHearing, type LiveFrame } from "@/components/corti/hearing-context";
import type { CanalRecord } from "@/lib/sound/canal";
import type { SoundCard } from "@/lib/sound/packet";
import { formatClock } from "@/lib/utils";

type Sample = { rms: number; f0: number | null };

const LIVE_CAP = 240;
const LOCK = 0.62;

function lockedF0(frame: LiveFrame): number | null {
  const pitch = frame.pitch;
  if (!pitch || pitch.probability <= LOCK || !(pitch.freq > 0)) return null;
  return pitch.freq;
}

function f0Y(freq: number, top: number, bot: number): number {
  const lo = Math.log(70);
  const hi = Math.log(420);
  const t = (Math.log(Math.max(70, Math.min(420, freq))) - lo) / (hi - lo);
  return bot - t * (bot - top);
}

function mag(rms: number): number {
  return Math.min(1, Math.max(0, rms * 8));
}

function walls(w: number, h: number) {
  return {
    nearTop: h * 0.14,
    nearBot: h * 0.86,
    farTop: h * 0.3,
    farBot: h * 0.7,
    farX: w * 0.93,
  };
}

function atX(x: number, w: number, h: number) {
  const { nearTop, nearBot, farTop, farBot, farX } = walls(w, h);
  const t = Math.max(0, Math.min(1, x / Math.max(1, farX)));
  const top = nearTop + (farTop - nearTop) * t;
  const bot = nearBot + (farBot - nearBot) * t;
  return { top, bot, mid: (top + bot) / 2 };
}

function drawCanal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tape: Sample[],
  live: Sample[],
) {
  ctx.fillStyle = "#12201e";
  ctx.fillRect(0, 0, w, h);

  const { nearTop, nearBot, farTop, farBot, farX } = walls(w, h);

  ctx.beginPath();
  ctx.moveTo(0, nearTop);
  ctx.lineTo(farX, farTop);
  ctx.lineTo(w, farTop);
  ctx.lineTo(w, farBot);
  ctx.lineTo(farX, farBot);
  ctx.lineTo(0, nearBot);
  ctx.closePath();
  const water = ctx.createLinearGradient(0, 0, w, 0);
  water.addColorStop(0, "#162824");
  water.addColorStop(0.55, "#12201e");
  water.addColorStop(1, "#0c0d09");
  ctx.fillStyle = water;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(141, 206, 202, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const x = t * farX;
    const slot = atX(x, w, h);
    ctx.beginPath();
    ctx.moveTo(x, slot.top);
    ctx.lineTo(x, slot.bot);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(179, 142, 74, 0.55)";
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(0, nearTop);
  ctx.lineTo(farX, farTop);
  ctx.lineTo(w, farTop);
  ctx.moveTo(0, nearBot);
  ctx.lineTo(farX, farBot);
  ctx.lineTo(w, farBot);
  ctx.stroke();

  const ribbon = tape.length > 1 ? tape : live.length > 1 ? live : [];
  if (ribbon.length > 1) {
    const n = ribbon.length;
    const xs = (i: number) => (i / (n - 1)) * farX;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xs(i);
      const slot = atX(x, w, h);
      const y = slot.mid - mag(ribbon[i]!.rms) * (slot.mid - slot.top) * 0.88;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const x = xs(i);
      const slot = atX(x, w, h);
      const y = slot.mid + mag(ribbon[i]!.rms) * (slot.bot - slot.mid) * 0.88;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(141, 206, 202, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(141, 206, 202, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = "rgba(179, 142, 74, 0.95)";
    ctx.lineWidth = 1.5;
    let open = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const f0 = ribbon[i]!.f0;
      if (f0 == null || !Number.isFinite(f0) || f0 <= 0) {
        if (open) {
          ctx.stroke();
          ctx.beginPath();
          open = false;
        }
        continue;
      }
      const x = xs(i);
      const slot = atX(x, w, h);
      const y = f0Y(f0, slot.top, slot.bot);
      if (!open) {
        ctx.moveTo(x, y);
        open = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (open) ctx.stroke();
  }

  if (tape.length > 1 && live.length > 1) {
    const mouth = farX * 0.82;
    const n = live.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = mouth + (i / (n - 1)) * (w - mouth);
      const slot = atX(Math.min(x, farX), w, h);
      const y = slot.mid - mag(live[i]!.rms) * (slot.mid - slot.top) * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(221, 211, 179, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function hzLabel(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value)} Hz`;
}

export function CanalStage({
  cards,
  archive,
}: {
  cards: SoundCard[];
  archive: CanalRecord | null;
}) {
  const { mic, opened, last, subscribe } = useHearing();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<Sample[]>([]);
  const tapeRef = useRef<Sample[]>([]);
  const lastCard = cards[cards.length - 1] ?? null;
  const canalTape = archive && archive.frameCount > 0 ? archive.tape : null;

  tapeRef.current = (canalTape ?? lastCard?.tape ?? []).map((frame) => ({
    rms: frame.rms,
    f0: frame.f0,
  }));

  useEffect(() => {
    return subscribe((frame: LiveFrame) => {
      const buf = liveRef.current;
      buf.push({ rms: frame.rms, f0: lockedF0(frame) });
      if (buf.length > LIVE_CAP) buf.shift();
    });
  }, [subscribe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let live = true;

    const paint = () => {
      if (!live) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 640;
      const h = parent?.clientHeight ?? 220;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanal(ctx, w, h, tapeRef.current, liveRef.current);
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const liveF0 = last ? lockedF0(last) : null;
  const listening = mic === "on";
  const hasTape = Boolean(canalTape);
  const source = hasTape
    ? archive?.listening
      ? "Canal tape"
      : "Canal tape · held"
    : listening
      ? "Live from Corti"
      : lastCard
        ? "Last ingest"
        : "Empty";
  const duration = hasTape
    ? formatClock((archive?.durationMs ?? 0) / 1000)
    : lastCard
      ? formatClock(lastCard.durationMs / 1000)
      : listening && last
        ? "live"
        : "—";
  const f0 = hasTape ? (archive?.f0 ?? null) : lastCard ? lastCard.f0 : liveF0;
  const peak = hasTape
    ? (archive?.peakRms ?? 0).toFixed(3)
    : lastCard
      ? lastCard.peakRms.toFixed(3)
      : listening && last
        ? last.rms.toFixed(3)
        : "—";
  const voiced = lastCard ? (lastCard.voiced ? "yes" : "no") : "—";
  const frames = hasTape
    ? `${archive?.frameCount ?? 0}`
    : lastCard
      ? `${lastCard.tape.length}`
      : "0";

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-border">
      <header className="flex flex-col gap-1 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:px-5">
        <div>
          <p className="font-mono text-[0.625rem] tracking-[0.22em] text-subtle uppercase">
            Canal
          </p>
          <p className="font-display text-xl italic text-fg">{source}</p>
        </div>
        <p className="font-mono text-[0.625rem] tracking-[0.16em] text-subtle uppercase">
          {listening
            ? "Corti is in the canal"
            : opened
              ? "Corti is idle"
              : "Corti is closed"}
        </p>
      </header>

      <div className="relative mt-3 h-52 w-full sm:h-64">
        <canvas
          ref={canvasRef}
          className="size-full"
          aria-label="Canal tape. Cyan is RMS. Gold is F0. A gap is a hole, not a pitch."
        />
      </div>
      {!hasTape && cards.length === 0 ? (
        <p className="max-w-prose px-4 pt-3 text-sm text-muted sm:px-5">
          Nothing on the tape yet.{" "}
          <Link to="/hear" className="text-fg underline decoration-border underline-offset-4">
            Open Corti
          </Link>
          , press Listen. The canal writes the measured signal. I will not invent a
          tape.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-4 font-mono text-xs tabular-nums sm:grid-cols-5 sm:px-5">
        <div>
          <dt className="text-subtle">Duration</dt>
          <dd className="text-fg">{duration}</dd>
        </div>
        <div>
          <dt className="text-subtle">F0</dt>
          <dd className="text-fg">{hzLabel(f0)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Peak RMS</dt>
          <dd className="text-fg">{peak}</dd>
        </div>
        <div>
          <dt className="text-subtle">Voiced</dt>
          <dd className="text-fg">{voiced}</dd>
        </div>
        <div>
          <dt className="text-subtle">Tape</dt>
          <dd className="text-fg">{frames} frames</dd>
        </div>
      </dl>
    </section>
  );
}

export function TapeStrip({ card, index }: { card: SoundCard; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tape = card.tape.map((frame) => ({ rms: frame.rms, f0: frame.f0 }));

    const paint = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 320;
      const h = parent?.clientHeight ?? 56;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanal(ctx, w, h, tape, []);
    };

    paint();
    const parent = canvas.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(paint);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [card]);

  return (
    <li className="overflow-hidden rounded-2xl bg-surface shadow-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
        <p className="font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
          Card {index + 1}
          {card.truncated ? " · tail dropped" : ""}
        </p>
        <p className="font-mono text-xs tabular-nums text-muted">
          {formatClock(card.durationMs / 1000)} · {hzLabel(card.f0)} ·{" "}
          {card.tape.length} frames
        </p>
      </div>
      <div className="mt-2 h-14 w-full">
        <canvas ref={canvasRef} className="size-full" aria-hidden />
      </div>
    </li>
  );
}
