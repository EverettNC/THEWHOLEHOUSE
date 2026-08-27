import { Move } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PressPad, accelMag } from "./press-pad";
import { PostureRail } from "./posture-rail";

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function SkinOrgan() {
  const [motion, setMotion] = useState(false);
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [accel, setAccel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    setFramed(isFramed());
  }, []);

  useEffect(() => {
    if (!motion) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      setBeta(typeof e.beta === "number" ? e.beta : null);
      setGamma(typeof e.gamma === "number" ? e.gamma : null);
    };
    const onMotion = (e: DeviceMotionEvent) => {
      setAccel(accelMag(e));
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [motion]);

  async function openInnerEar() {
    setError(null);
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    try {
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") {
          setError(
            framed
              ? "This window cannot hold a gyroscope. Press still works. Open Skin in its own window for lean and sit."
              : "The gyroscope is closed. Press still works.",
          );
          return;
        }
      }
      setMotion(true);
    } catch {
      setError(
        framed
          ? "This window cannot hold a gyroscope. Press still works. Open Skin in its own window for lean and sit."
          : "This window has no gyroscope. Press still works.",
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <section className="max-w-2xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-subtle uppercase">Skin</p>
        <h1 className="font-display mt-2 text-3xl italic text-fg">The body</h1>
        <p className="mt-3 max-w-prose text-pretty text-sm text-muted">
          Fit, lean, sit. Contact and tilt. Do not invent a pose or a pulse.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div className="flex flex-col gap-3">
          <PressPad motion={motion} beta={beta} gamma={gamma} accel={accel} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void openInnerEar()}
            disabled={motion}
            data-testid="skin-motion"
          >
            <Move />
            {motion ? "Inner ear open" : "Open the inner ear"}
          </Button>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}{" "}
              {framed ? (
                <a
                  href={typeof window !== "undefined" ? window.location.href : "/touch"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg underline decoration-border underline-offset-4"
                >
                  Open Skin in its own window
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        <PostureRail />
      </div>
    </main>
  );
}
