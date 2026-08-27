/**
 * Labeled oscillator trials. Known Hz in, what YIN locked (or did not).
 * This is not a speaker seat and not a trained model.
 */

export const CORPUS_KEY = "corti-calib-corpus";
export const CORPUS_CAP = 400;

export type CalibSource = "listen" | "tone" | "train";

export type CalibSample = {
  id: string;
  t: number;
  midi: number;
  expectedHz: number;
  measuredHz: number | null;
  cents: number | null;
  locked: boolean;
  lockFrames: number;
  peakRms: number;
  waveform: string;
  a4: number;
  source: CalibSource;
};

export type CorpusSummary = {
  n: number;
  locked: number;
  unlocked: number;
  medianAbsCents: number | null;
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? null) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

export function centsError(measuredHz: number, expectedHz: number): number | null {
  if (!(measuredHz > 0) || !(expectedHz > 0)) return null;
  return 1200 * Math.log2(measuredHz / expectedHz);
}

export function measureLocks(locks: number[]): number | null {
  return median(locks);
}

export function summarizeCorpus(samples: CalibSample[]): CorpusSummary {
  const locked = samples.filter((s) => s.locked && s.cents != null);
  const abs = locked.map((s) => Math.abs(s.cents as number));
  return {
    n: samples.length,
    locked: locked.length,
    unlocked: samples.length - locked.length,
    medianAbsCents: median(abs),
  };
}

export function loadCorpus(): CalibSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CORPUS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CalibSample[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.expectedHz === "number");
  } catch {
    return [];
  }
}

export function saveCorpus(samples: CalibSample[]): void {
  localStorage.setItem(CORPUS_KEY, JSON.stringify(samples.slice(0, CORPUS_CAP)));
}

export function appendSample(
  samples: CalibSample[],
  next: CalibSample,
): CalibSample[] {
  return [next, ...samples].slice(0, CORPUS_CAP);
}

export function clearCorpusStore(): void {
  localStorage.removeItem(CORPUS_KEY);
}

export function finishTrial(input: {
  midi: number;
  expectedHz: number;
  locks: number[];
  peakRms: number;
  waveform: string;
  a4: number;
  source: CalibSource;
}): CalibSample {
  const measuredHz = measureLocks(input.locks);
  const locked = measuredHz != null && input.locks.length >= 2;
  const hz = locked ? measuredHz : null;
  const cents = hz != null ? centsError(hz, input.expectedHz) : null;
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    t: Date.now(),
    midi: input.midi,
    expectedHz: input.expectedHz,
    measuredHz: hz,
    cents,
    locked,
    lockFrames: input.locks.length,
    peakRms: input.peakRms,
    waveform: input.waveform,
    a4: input.a4,
    source: input.source,
  };
}
