/**
 * Skin — the body nerve.
 *
 * Fit, lean, sit. Contact and tilt.
 * Do not invent a pose, a pulse, or a medical claim.
 * If this window has no gyroscope, say so. Press still works.
 */

export const SKIN_ORGAN = "skin" as const;
export const SKIN_FAMILY = "christman-sound" as const;

export type SkinPosture = "sit" | "lean" | "fit" | "still";
export type SkinKind = "pointer" | "motion" | "both";

export type SkinFrame = {
  at: number;
  contacting: boolean;
  pressure: number | null;
  pointerType: string | null;
  motion: boolean;
  beta: number | null;
  gamma: number | null;
  accel: number | null;
  posture: SkinPosture | null;
  live: boolean;
};

export type SkinTake = {
  id: string;
  at: number;
  durationMs: number;
  peakPressure: number;
  posture: SkinPosture;
  kind: SkinKind;
  honesty: {
    skin: SkinKind;
    motion: boolean;
    invented: false;
    rule: string;
  };
};

export type SkinPacket = {
  organ: typeof SKIN_ORGAN;
  family: typeof SKIN_FAMILY;
  kind: "contact";
  take: SkinTake;
};

export const SKIN_HONESTY_RULE =
  "Skin measures contact, lean, sit. No invented pose. No pulse. Pointer is the skin. Motion is the lean.";

export const LEAN_DEG = 12;
export const SIT_ACCEL = 0.15;
export const CONTACT_PRESSURE = 0.04;
