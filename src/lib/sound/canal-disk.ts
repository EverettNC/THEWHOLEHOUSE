/**
 * The canal's long memory. Server only.
 *
 * The live window in the rack holds two hours and drops its head. This file keeps
 * everything: every measured frame that reaches the house is written to ELEMENTS,
 * one file per hour, so the tape outlives the window and outlives a restart.
 *
 * If ELEMENTS is not mounted, nothing is written and the status says so.
 * There is no fallback disk. A tape on the wrong drive is not the tape.
 */
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ELEMENTS = "/Volumes/ELEMENTS";
export const TAPE_DIR = join(ELEMENTS, "THEWHOLEHOUSE", "canal");

/** Silence longer than this between frames is marked as a gap, not filled. */
const GAP_MS = 2000;

type InFrame = { t: number; rms: number; zcr: number; f0: number | null };

export type DiskFrame = { at: number; rms: number; zcr: number; f0: number | null };

export type DiskStatus = {
  dir: string;
  writing: boolean;
  framesWritten: number;
  lastWriteAt: number | null;
  error: string | null;
};

type DiskState = { status: DiskStatus; chain: Promise<void> };
const mem = globalThis as typeof globalThis & { __houseCanalDisk__?: DiskState };
const state: DiskState = (mem.__houseCanalDisk__ ??= {
  status: { dir: TAPE_DIR, writing: false, framesWritten: 0, lastWriteAt: null, error: null },
  chain: Promise.resolve(),
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hourFile(at: number): string {
  const d = new Date(at);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return join(TAPE_DIR, day, `${pad(d.getHours())}.jsonl`);
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** ELEMENTS counts only when it is its own device, not a folder on the boot disk. */
async function elementsMounted(): Promise<boolean> {
  try {
    const [drive, root] = await Promise.all([stat(ELEMENTS), stat("/")]);
    return drive.isDirectory() && drive.dev !== root.dev;
  } catch {
    return false;
  }
}

/**
 * Write new frames to ELEMENTS. Wall-clock time comes from when the batch landed:
 * the last frame is "now", earlier frames step back by their own spacing. The rack's
 * relative t is rebased across pauses, so it cannot be trusted as a clock.
 */
export function writeCanalFrames(receivedAt: number, frames: InFrame[]): void {
  if (frames.length === 0) return;
  const lastT = frames[frames.length - 1]!.t;
  const rows: DiskFrame[] = frames.map((f) => ({
    at: Math.round(receivedAt - (lastT - f.t)),
    rms: round(Number.isFinite(f.rms) ? f.rms : 0),
    zcr: round(Number.isFinite(f.zcr) ? f.zcr : 0),
    f0: f.f0 != null && Number.isFinite(f.f0) && f.f0 > 0 ? round(f.f0) : null,
  }));

  state.chain = state.chain.then(async () => {
    if (!(await elementsMounted())) {
      state.status.writing = false;
      state.status.error = "ELEMENTS is not mounted. Nothing was written.";
      return;
    }
    const byFile = new Map<string, string[]>();
    for (const row of rows) {
      const file = hourFile(row.at);
      const lines = byFile.get(file) ?? [];
      lines.push(JSON.stringify(row));
      byFile.set(file, lines);
    }
    try {
      for (const [file, lines] of byFile) {
        await mkdir(dirname(file), { recursive: true });
        await appendFile(file, lines.join("\n") + "\n", "utf8");
      }
      state.status.writing = true;
      state.status.framesWritten += rows.length;
      state.status.lastWriteAt = rows[rows.length - 1]!.at;
      state.status.error = null;
    } catch (err) {
      state.status.writing = false;
      state.status.error = err instanceof Error ? err.message : String(err);
    }
  });
}

export function getDiskStatus(): DiskStatus {
  return { ...state.status };
}

/** Keep the loudest frame in each slice, so a tick is not averaged away. */
function loudestPerSlice(frames: DiskFrame[], points: number): DiskFrame[] {
  if (frames.length <= points) return frames;
  const out: DiskFrame[] = [];
  const size = frames.length / points;
  for (let i = 0; i < points; i++) {
    const start = Math.floor(i * size);
    const end = Math.min(frames.length, Math.floor((i + 1) * size));
    let best = frames[start]!;
    for (let j = start + 1; j < end; j++) {
      if (frames[j]!.rms > best.rms) best = frames[j]!;
    }
    out.push(best);
  }
  return out;
}

export async function readCanalRange(from: number, to: number, points: number) {
  const mounted = await elementsMounted();
  const frames: DiskFrame[] = [];
  const seen = new Set<string>();
  const missingHours: string[] = [];
  const firstHour = new Date(from);
  firstHour.setMinutes(0, 0, 0);

  for (let h = firstHour.getTime(); h <= to; h += 3_600_000) {
    const file = hourFile(h);
    if (seen.has(file)) continue;
    seen.add(file);
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch {
      missingHours.push(file.slice(TAPE_DIR.length + 1, -".jsonl".length));
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const row = JSON.parse(line) as DiskFrame;
        if (row.at >= from && row.at <= to) frames.push(row);
      } catch {
        /* A torn line is skipped, not repaired. */
      }
    }
  }

  frames.sort((a, b) => a.at - b.at);
  const gaps: { from: number; to: number }[] = [];
  let prev = from;
  let peakRms = 0;
  for (const f of frames) {
    if (f.at - prev > GAP_MS) gaps.push({ from: prev, to: f.at });
    prev = f.at;
    if (f.rms > peakRms) peakRms = f.rms;
  }
  if (to - prev > GAP_MS) gaps.push({ from: prev, to });

  return {
    mounted,
    from,
    to,
    frameCount: frames.length,
    peakRms,
    gaps,
    missingHours,
    frames: loudestPerSlice(frames, points),
  };
}
