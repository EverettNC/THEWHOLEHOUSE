import { LEAN_DEG, SIT_ACCEL, type SkinFrame, type SkinPosture } from "./types.ts";

export function accelMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function postureOf(args: {
  contacting: boolean;
  motion: boolean;
  gamma: number | null;
  accel: number | null;
}): SkinPosture | null {
  if (!args.contacting && !args.motion) return null;
  if (args.motion && args.gamma != null && Math.abs(args.gamma) > LEAN_DEG) return "lean";
  if (args.motion && args.accel != null && args.accel < SIT_ACCEL) return "sit";
  if (args.contacting) return "fit";
  return "still";
}

export function frameFromSense(args: {
  at: number;
  contacting: boolean;
  pressure: number | null;
  pointerType: string | null;
  motion: boolean;
  beta: number | null;
  gamma: number | null;
  accel: number | null;
}): SkinFrame {
  const live = args.contacting || args.motion;
  return {
    at: args.at,
    contacting: args.contacting,
    pressure: args.contacting ? args.pressure : null,
    pointerType: args.contacting ? args.pointerType : null,
    motion: args.motion,
    beta: args.motion ? args.beta : null,
    gamma: args.motion ? args.gamma : null,
    accel: args.motion ? args.accel : null,
    posture: postureOf(args),
    live,
  };
}
