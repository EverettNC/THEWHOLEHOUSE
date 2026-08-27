/**
 * Vocalization events — ticks, grunts, groans as measured envelopes.
 *
 * A grunt is  duration + F0 + formants + attack/decay + a tape.
 * Kind labels are duration/voicing bins, not pain vs annoyance.
 * Giuseppe / Inferno / Sierra are not running here.
 */

export type VocalKind = "tick" | "grunt" | "groan" | "hiss" | "voiced" | "noise";

export type TapeFrame = {
  t: number;
  rms: number;
  zcr: number;
  f0: number | null;
};

export type VocalEvent = {
  id: number;
  kind: VocalKind;
  startedAt: number;
  durationMs: number;
  peakRms: number;
  attackMs: number;
  decayMs: number;
  f0: number | null;
  f1: number;
  f2: number;
  zcr: number;
  voiced: boolean;
  tape: TapeFrame[];
};

const ONSET = 0.016;
const OFFSET = 0.0065;
const MIN_MS = 30;
const TAPE_CAP = 360;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

function classify(
  ms: number,
  voiced: boolean,
  zcr: number,
  f0: number | null,
): VocalKind {
  if (!voiced && zcr > 0.16 && ms < 140) return "tick";
  if (!voiced && zcr > 0.12) return "hiss";
  if (voiced && ms < 95) return "tick";
  if (voiced && ms < 430 && (f0 ?? 180) < 230) return "grunt";
  if (voiced && ms >= 430) return "groan";
  if (voiced) return "voiced";
  return "noise";
}

type Active = {
  startedAt: number;
  peakRms: number;
  riseAt: number;
  attackMs: number;
  f0s: number[];
  zcrs: number[];
  f1: number;
  f2: number;
  tape: TapeFrame[];
};

export class VocalTracker {
  private active: Active | null = null;
  private nextId = 1;
  events: VocalEvent[] = [];

  get open(): boolean {
    return this.active != null;
  }

  durationMs(now: number): number {
    return this.active ? now - this.active.startedAt : 0;
  }

  step(
    now: number,
    rms: number,
    zcr: number,
    f0: number | null,
    f1: number,
    f2: number,
  ): VocalEvent | null {
    if (!this.active) {
      if (rms >= ONSET) {
        this.active = {
          startedAt: now,
          peakRms: rms,
          riseAt: now,
          attackMs: 0,
          f0s: f0 ? [f0] : [],
          zcrs: [zcr],
          f1,
          f2,
          tape: [{ t: 0, rms, zcr, f0 }],
        };
      }
      return null;
    }

    const a = this.active;
    if (rms > a.peakRms) a.peakRms = rms;
    if (a.attackMs === 0 && a.peakRms > 0 && rms >= a.peakRms * 0.85) {
      a.attackMs = Math.max(4, now - a.riseAt);
    }
    if (f0) a.f0s.push(f0);
    a.zcrs.push(zcr);
    if (f1) a.f1 = f1;
    if (f2) a.f2 = f2;
    if (a.tape.length < TAPE_CAP) {
      a.tape.push({ t: now - a.startedAt, rms, zcr, f0 });
    }

    if (rms < OFFSET && now - a.startedAt >= MIN_MS) {
      return this.close(now);
    }
    return null;
  }

  private close(now: number): VocalEvent {
    const a = this.active!;
    this.active = null;
    const durationMs = now - a.startedAt;
    const voiced = a.f0s.length >= 2;
    const f0 = voiced ? median(a.f0s) : null;
    const zcr = a.zcrs.reduce((s, x) => s + x, 0) / Math.max(1, a.zcrs.length);
    const ev: VocalEvent = {
      id: this.nextId++,
      kind: classify(durationMs, voiced, zcr, f0),
      startedAt: a.startedAt,
      durationMs,
      peakRms: a.peakRms,
      attackMs: a.attackMs || Math.min(18, durationMs * 0.2),
      decayMs: Math.max(0, durationMs - (a.attackMs || 0)),
      f0,
      f1: a.f1,
      f2: a.f2,
      zcr,
      voiced,
      tape: a.tape,
    };
    this.events = [ev, ...this.events].slice(0, 8);
    return ev;
  }
}
