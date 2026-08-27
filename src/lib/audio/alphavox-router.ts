/**
 * AlphaVox Acoustic Router — Corti client only.
 *
 * Grunt / groan labels live here. They do not enter family Sound.
 * Stimming lives here as a cadence flag. It does not enter family Sound.
 *
 * Output is a KEY for AlphaVox NonverbalEngine.process_sound:
 *   grunt_distress | grunt_acknowledge | grunt_frustration | vocal_stimming
 *   | unknown
 *
 * These gates are deterministic measurements, not a heuristic.
 * Elevation is measured F0. Attack is measured milliseconds to peak.
 * Porosity is measured ZCR. A missing lock does not become 180 Hz.
 *
 * vocal_stimming is self-regulation, not HOLD_SPACE.
 * unknown means no key. AlphaVox must not speak for it.
 */

import type { VocalEvent } from "./vocalization";

export type AcousticKey =
  | "grunt_distress"
  | "grunt_acknowledge"
  | "grunt_frustration"
  | "vocal_stimming"
  | "unknown";

export function analyzeGruntPhysics(ev: VocalEvent): AcousticKey {
  if (ev.kind !== "grunt" && ev.kind !== "groan") return "unknown";

  const porosity = ev.zcr;
  const f0 = ev.f0;

  if (f0 != null && f0 > 250 && ev.attackMs < 15 && porosity > 0.15) {
    return "grunt_distress";
  }

  if (
    f0 != null &&
    f0 >= 90 &&
    f0 <= 200 &&
    ev.attackMs >= 15 &&
    porosity < 0.12
  ) {
    return "grunt_acknowledge";
  }

  if (ev.durationMs > 600 && porosity > 0.13) {
    return "grunt_frustration";
  }

  return "unknown";
}

export function detectVocalStimming(events: VocalEvent[]): boolean {
  if (events.length < 4) return false;

  const recent = events.slice(0, 4);
  const gaps: number[] = [];
  for (let i = 0; i < recent.length - 1; i++) {
    const a = recent[i];
    const b = recent[i + 1];
    if (a === undefined || b === undefined) return false;
    gaps.push(Math.abs(a.startedAt - b.startedAt));
  }

  const mean = gaps.reduce((sum, val) => sum + val, 0) / gaps.length;
  let variance = 0;
  for (const g of gaps) variance += (g - mean) ** 2;
  variance /= gaps.length;
  const stdDevMs = Math.sqrt(variance);

  return stdDevMs < 120;
}

export function routeForAlphaVox(events: VocalEvent[]): AcousticKey {
  if (detectVocalStimming(events)) return "vocal_stimming";
  const newest = events[0];
  if (!newest) return "unknown";
  return analyzeGruntPhysics(newest);
}
