import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { HOUSE_CHANNEL, bodyFromSkin } from "@/modules/memory/house";
import { frameFromSense } from "@/lib/skin/posture";
import { useSkin } from "@/lib/skin/store";
import type { SkinKind, SkinPosture } from "@/lib/skin/types";
import { cn } from "@/lib/utils";

function accelMag(ev: DeviceMotionEvent): number | null {
  const a = ev.acceleration;
  if (a && a.x != null && a.y != null && a.z != null) {
    return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  }
  const g = ev.accelerationIncludingGravity;
  if (g && g.x != null && g.y != null && g.z != null) {
    return Math.abs(Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - 9.8);
  }
  return null;
}

export function PressPad({
  motion,
  beta,
  gamma,
  accel,
}: {
  motion: boolean;
  beta: number | null;
  gamma: number | null;
  accel: number | null;
}) {
  const { setFrame, addTake } = useSkin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contactRef = useRef(false);
  const pressureRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const peakRef = useRef(0);
  const pointerTypeRef = useRef<string | null>(null);
  const motionRef = useRef(motion);
  const betaRef = useRef(beta);
  const gammaRef = useRef(gamma);
  const accelRef = useRef(accel);
  motionRef.current = motion;
  betaRef.current = beta;
  gammaRef.current = gamma;
  accelRef.current = accel;

  const broadcast = useCallback((contacting: boolean, pressure: number | null) => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(HOUSE_CHANNEL);
    ch.postMessage({
      source: "skin",
      t: Date.now(),
      skin: bodyFromSkin({
        contacting,
        motion: motionRef.current,
        pressure,
        beta: betaRef.current,
        gamma: gammaRef.current,
        accel: accelRef.current,
      }),
    });
    ch.close();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const frame = frameFromSense({
        at: Date.now(),
        contacting: contactRef.current,
        pressure: pressureRef.current,
        pointerType: pointerTypeRef.current,
        motion: motionRef.current,
        beta: betaRef.current,
        gamma: gammaRef.current,
        accel: accelRef.current,
      });
      setFrame(frame);
      broadcast(frame.contacting, frame.pressure);
    }, 400);
    return () => {
      window.clearInterval(id);
      broadcast(false, null);
    };
  }, [broadcast, setFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let live = true;
    const paint = () => {
      if (!live) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 280;
      const h = parent?.clientHeight ?? 256;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const p = contactRef.current ? (pressureRef.current ?? 0.5) : 0;
      const r = Math.max(12, Math.min(w, h) * (0.12 + p * 0.38));
      ctx.fillStyle = "color-mix(in oklab, var(--color-fg) 7%, transparent)";
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = `color-mix(in oklab, var(--color-fg) ${Math.round(18 + p * 50)}%, transparent)`;
      ctx.fill();
      requestAnimationFrame(paint);
    };
    const raf = requestAnimationFrame(paint);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    contactRef.current = true;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    pressureRef.current = pressure;
    pointerTypeRef.current = e.pointerType || "mouse";
    startRef.current = Date.now();
    peakRef.current = pressure;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptic */
    }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (!contactRef.current) return;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    pressureRef.current = pressure;
    if (pressure > peakRef.current) peakRef.current = pressure;
  }

  function up() {
    if (!contactRef.current) return;
    const durationMs = Date.now() - startRef.current;
    const contacting = false;
    const posture: SkinPosture =
      frameFromSense({
        at: Date.now(),
        contacting: true,
        pressure: peakRef.current,
        pointerType: pointerTypeRef.current,
        motion: motionRef.current,
        beta: betaRef.current,
        gamma: gammaRef.current,
        accel: accelRef.current,
      }).posture ?? "fit";
    const kind: SkinKind = motionRef.current ? "both" : "pointer";
    if (durationMs >= 120) {
      addTake({
        at: Date.now(),
        durationMs,
        peakPressure: peakRef.current,
        posture,
        kind,
      });
    }
    contactRef.current = contacting;
    pressureRef.current = null;
    pointerTypeRef.current = null;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="skin-pad"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn(
        "relative min-h-64 touch-none overflow-hidden rounded-2xl bg-surface shadow-border select-none",
        "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      )}
    >
      <canvas ref={canvasRef} className="size-full" aria-hidden />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center font-mono text-[0.625rem] tracking-[0.18em] text-subtle uppercase">
        Press
      </p>
    </div>
  );
}

export { accelMag };
