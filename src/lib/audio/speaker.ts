/**
 * Per-speaker seat. Explicit. Cold until seated.
 * I will not infer a voice from one grunt.
 */

import type { VocalEvent } from "./vocalization";

export type SpeakerSeat = {
  samples: number;
  f0Median: number;
  f0Low: number;
  f0High: number;
  restRms: number;
  f1: number;
  f2: number;
  seatedAt: number;
};

export type VsSeat = {
  status: "COLD" | "SEATED";
  f0DeltaHz: number | null;
  rmsRatio: number | null;
};

const KEY = "corti-speaker-seat";
export const MIN_VOICED_TO_SEAT = 3;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[i] ?? 0;
}

export function loadSeat(): SpeakerSeat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SpeakerSeat;
    if (!s.f0Median || s.samples < MIN_VOICED_TO_SEAT) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSeat(seat: SpeakerSeat): void {
  localStorage.setItem(KEY, JSON.stringify(seat));
}

export function clearSeat(): void {
  localStorage.removeItem(KEY);
}

export function seatFromEvents(
  events: VocalEvent[],
  restRms: number,
): SpeakerSeat | null {
  const f0s = events.filter((e) => e.voiced && e.f0 != null).map((e) => e.f0 as number);
  if (f0s.length < MIN_VOICED_TO_SEAT) return null;
  const f1s = events.filter((e) => e.f1 > 0).map((e) => e.f1);
  const f2s = events.filter((e) => e.f2 > 0).map((e) => e.f2);
  return {
    samples: f0s.length,
    f0Median: median(f0s),
    f0Low: percentile(f0s, 0.1),
    f0High: percentile(f0s, 0.9),
    restRms: restRms > 0 ? restRms : 0,
    f1: f1s.length ? median(f1s) : 0,
    f2: f2s.length ? median(f2s) : 0,
    seatedAt: Date.now(),
  };
}

export function compareToSeat(ev: VocalEvent, seat: SpeakerSeat | null): VsSeat {
  if (!seat) {
    return { status: "COLD", f0DeltaHz: null, rmsRatio: null };
  }
  return {
    status: "SEATED",
    f0DeltaHz: ev.f0 != null ? ev.f0 - seat.f0Median : null,
    rmsRatio: seat.restRms > 1e-6 ? ev.peakRms / seat.restRms : null,
  };
}
