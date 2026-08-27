/**
 * Live delivery. Corti already measured. This posts the KEY.
 * Does not recompute F0, attack, or porosity.
 */
import type { AcousticKey } from "./alphavox-router";

const DEFAULT_URL = "http://127.0.0.1:5485/api/nonverbal/acoustic";

export function acousticEndpoint(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_ALPHAVOX_ACOUSTIC_URL as string | undefined);
  return fromEnv || DEFAULT_URL;
}

export function postAcousticKey(key: AcousticKey): void {
  if (key === "unknown") return;
  const url = acousticEndpoint();
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AlphaVox acoustic live post failed:", message);
  });
}
