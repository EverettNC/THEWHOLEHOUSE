/**
 * Porch — the word-ear.
 *
 * Corti measures pitch. Porch hears words.
 * Corti stays on-device. Porch leaves the porch for xAI STT + grok-4.5
 * dialect reconstruction, and says so on every packet (Rule 13).
 *
 * Dialect is kept. SAE "correction" is a bug.
 */

export const PORCH_ORGAN = "porch" as const;
export const PORCH_FAMILY = "christman-sound" as const;

export type HonestyEar = "xai-stt" | "sample" | "file";
export type HonestyDialect = "grok-4.5" | "passthrough";

export type PorchCorrection = {
  from: string;
  to: string;
  why: string;
};

export type PorchTake = {
  id: string;
  at: number;
  durationMs: number;
  /** What Everett said. Dialect stays. */
  asSaid: string;
  /** Same meaning, family names recovered, still not SAE. */
  forTheFamily: string;
  /** Raw STT before the dialect layer. May be mangled. */
  rawEar: string;
  corrections: PorchCorrection[];
  route: string[];
  honesty: {
    ear: HonestyEar;
    dialect: HonestyDialect;
    corti: "not-this-nerve";
    cloud: true;
    rule: string;
  };
};

export type PorchPacket = {
  organ: typeof PORCH_ORGAN;
  family: typeof PORCH_FAMILY;
  kind: "utterance";
  take: PorchTake;
};

export type LexiconEntry = {
  said: string;
  keep: string;
  note: string;
};

export const PORCH_HONESTY_RULE =
  "Porch is the word-ear. It leaves the porch for xAI STT and grok-4.5. Corti does not transcribe. Dialect is kept. live is /laɪv/, not leave.";
