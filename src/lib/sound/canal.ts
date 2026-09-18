/**
 * The canal tape. Corti measures. Sound keeps every frame while the mic is open.
 * An utterance close is a card on top of the tape. The tape does not wait for it.
 * Null F0 is a hole, not a zero.
 */
import type { TapeFrame } from "@/lib/audio/vocalization";

export const FRAME_MS = 50;
/** Two hours at 20 Hz. Head drops after that. The drop is marked. */
export const MAX_FRAMES = 144_000;
export const DRAW_FRAMES = 800;

const RULE =
  "Corti measures. The canal keeps the tape. Kind does not cross.";

export type CanalBatch = {
  listening: boolean;
  startedAt: number;
  frames: TapeFrame[];
};

export type CanalRecord = {
  organ: "canal";
  family: "christman-sound";
  honesty: {
    corti: "present";
    kind: "dropped";
    rule: string;
  };
  startedAt: number;
  durationMs: number;
  peakRms: number;
  f0: number | null;
  listening: boolean;
  truncated: boolean;
  frameCount: number;
  tape: TapeFrame[];
};

function emptyRecord(startedAt: number, listening: boolean): CanalRecord {
  return {
    organ: "canal",
    family: "christman-sound",
    honesty: { corti: "present", kind: "dropped", rule: RULE },
    startedAt,
    durationMs: 0,
    peakRms: 0,
    f0: null,
    listening,
    truncated: false,
    frameCount: 0,
    tape: [],
  };
}

function lastLock(frames: TapeFrame[], fallback: number | null): number | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f0 = frames[i]?.f0;
    if (f0 != null && Number.isFinite(f0) && f0 > 0) return f0;
  }
  return fallback;
}

function rebase(record: CanalRecord, frames: TapeFrame[]): TapeFrame[] {
  if (frames.length === 0) return frames;
  const last = record.tape[record.tape.length - 1];
  if (!last) return frames;
  const first = frames[0]!;
  if (first.t > last.t) return frames;
  const shift = last.t + FRAME_MS - first.t;
  return frames.map((frame) => ({ ...frame, t: frame.t + shift }));
}

export function downsampleTape(tape: TapeFrame[], n: number): TapeFrame[] {
  if (n <= 0) return [];
  if (tape.length <= n) return tape.slice();
  const out: TapeFrame[] = [];
  const last = tape.length - 1;
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * last) / (n - 1));
    out.push(tape[idx]!);
  }
  return out;
}

export function appendCanal(record: CanalRecord | null, batch: CanalBatch): CanalRecord {
  const next = record
    ? {
        ...record,
        tape: record.tape.slice(),
        listening: Boolean(batch.listening),
      }
    : emptyRecord(batch.startedAt || Date.now(), Boolean(batch.listening));

  const incoming = record ? rebase(record, batch.frames) : batch.frames;
  for (const frame of incoming) {
    const rms = Number.isFinite(frame.rms) ? frame.rms : 0;
    const zcr = Number.isFinite(frame.zcr) ? frame.zcr : 0;
    const f0 =
      frame.f0 != null && Number.isFinite(frame.f0) && frame.f0 > 0 ? frame.f0 : null;
    next.tape.push({ t: frame.t, rms, zcr, f0 });
    if (rms > next.peakRms) next.peakRms = rms;
  }
  if (next.tape.length > MAX_FRAMES) {
    next.tape = next.tape.slice(next.tape.length - MAX_FRAMES);
    next.truncated = true;
  }
  next.frameCount = next.tape.length;
  next.durationMs = next.tape.length > 0 ? next.tape[next.tape.length - 1]!.t : 0;
  next.f0 = lastLock(incoming, next.f0);
  next.listening = Boolean(batch.listening);
  return next;
}

export function drawTape(record: CanalRecord | null): TapeFrame[] {
  if (!record) return [];
  return downsampleTape(record.tape, DRAW_FRAMES);
}

export class CanalRecorder {
  private listening = false;
  private origin: number | null = null;
  private lastKeep: number | null = null;
  private startedAt = 0;
  private peakRms = 0;
  private f0: number | null = null;
  private truncated = false;
  private frames: TapeFrame[] = [];

  start(now: number) {
    this.listening = true;
    if (this.origin == null) {
      this.origin = now;
      this.startedAt = Date.now();
    }
  }

  stop() {
    this.listening = false;
  }

  step(now: number, rms: number, zcr: number, f0: number | null): TapeFrame | null {
    if (!this.listening || this.origin == null) return null;
    if (this.lastKeep != null && now - this.lastKeep < FRAME_MS) return null;
    this.lastKeep = now;
    const lock = f0 != null && Number.isFinite(f0) && f0 > 0 ? f0 : null;
    const frame: TapeFrame = {
      t: now - this.origin,
      rms: Number.isFinite(rms) ? rms : 0,
      zcr: Number.isFinite(zcr) ? zcr : 0,
      f0: lock,
    };
    this.frames.push(frame);
    if (frame.rms > this.peakRms) this.peakRms = frame.rms;
    if (lock != null) this.f0 = lock;
    if (this.frames.length > MAX_FRAMES) {
      this.frames.shift();
      this.truncated = true;
    }
    return frame;
  }

  snapshot(): CanalRecord {
    return {
      organ: "canal",
      family: "christman-sound",
      honesty: { corti: "present", kind: "dropped", rule: RULE },
      startedAt: this.startedAt,
      durationMs: this.frames.length > 0 ? this.frames[this.frames.length - 1]!.t : 0,
      peakRms: this.peakRms,
      f0: this.f0,
      listening: this.listening,
      truncated: this.truncated,
      frameCount: this.frames.length,
      tape: this.frames.slice(),
    };
  }
}
