/**
 * Lucent's long sight. Server only.
 *
 * The rack holds one frame — the thing Lucent sees right now. Each new frame
 * replaces it, so without this the afternoon she covered is gone. This file keeps
 * the frames: each seeing frame is written to ELEMENTS as its own JPEG, foldered
 * by day and hour, with a per-hour index.jsonl line pointing at it.
 *
 * Frames are throttled — one every MIN_GAP_MS at most — so a 20fps camera does not
 * bury the drive. A frame identical to the last kept one is skipped; a still room
 * is not re-written forty times a second.
 *
 * If ELEMENTS is not mounted, nothing is written and the status says so.
 */
import { appendFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export const ELEMENTS = "/Volumes/ELEMENTS";
export const SIGHT_DIR = join(ELEMENTS, "THEWHOLEHOUSE", "lucent");

/** At most one kept frame this often. The eye does not need every twitch. */
const MIN_GAP_MS = 1000;

export type SightStatus = {
  dir: string;
  writing: boolean;
  framesWritten: number;
  lastWriteAt: number | null;
  error: string | null;
};

type SightState = {
  status: SightStatus;
  lastAt: number;
  lastHash: string;
  chain: Promise<void>;
};
const mem = globalThis as typeof globalThis & { __houseLucentDisk__?: SightState };
const state: SightState = (mem.__houseLucentDisk__ ??= {
  status: { dir: SIGHT_DIR, writing: false, framesWritten: 0, lastWriteAt: null, error: null },
  lastAt: 0,
  lastHash: "",
  chain: Promise.resolve(),
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stamp(at: number) {
  const d = new Date(at);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hour = pad(d.getHours());
  const name = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(
    d.getMilliseconds() / 10,
  )}`;
  return { day, hour, name };
}

async function elementsMounted(): Promise<boolean> {
  try {
    const [drive, root] = await Promise.all([stat(ELEMENTS), stat("/")]);
    return drive.isDirectory() && drive.dev !== root.dev;
  } catch {
    return false;
  }
}

/**
 * Keep one sight frame. b64 may carry a data: prefix; only the base64 payload is
 * stored. A frame matching the last kept one, or arriving inside MIN_GAP_MS, is
 * dropped — the drive keeps change, not every repeat.
 */
export function writeLucentFrame(input: {
  at: number;
  b64: string;
  width: number;
  height: number;
  kind: string | null;
}): void {
  const raw = (input.b64 || "").split(",").pop() || "";
  if (!raw) return;
  if (input.at - state.lastAt < MIN_GAP_MS) return;
  const hash = createHash("sha1").update(raw).digest("hex");
  if (hash === state.lastHash) {
    state.lastAt = input.at;
    return;
  }
  state.lastAt = input.at;
  state.lastHash = hash;

  state.chain = state.chain.then(async () => {
    if (!(await elementsMounted())) {
      state.status.writing = false;
      state.status.error = "ELEMENTS is not mounted. Nothing was written.";
      return;
    }
    const { day, hour, name } = stamp(input.at);
    const dir = join(SIGHT_DIR, day, hour);
    const jpg = join(dir, `${name}.jpg`);
    const index = join(SIGHT_DIR, day, `${hour}.jsonl`);
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(jpg, Buffer.from(raw, "base64"));
      const line = JSON.stringify({
        at: input.at,
        file: jpg.slice(SIGHT_DIR.length + 1),
        width: input.width,
        height: input.height,
        kind: input.kind,
      });
      await mkdir(dirname(index), { recursive: true });
      await appendFile(index, line + "\n", "utf8");
      state.status.writing = true;
      state.status.framesWritten += 1;
      state.status.lastWriteAt = input.at;
      state.status.error = null;
    } catch (err) {
      state.status.writing = false;
      state.status.error = err instanceof Error ? err.message : String(err);
    }
  });
}

export function getSightStatus(): SightStatus {
  return { ...state.status };
}

export type SightEntry = {
  at: number;
  file: string;
  width: number;
  height: number;
  kind: string | null;
};

/** The index of frames in a range — times and file paths, not the bytes. */
export async function readSightRange(from: number, to: number, limit: number) {
  const mounted = await elementsMounted();
  const entries: SightEntry[] = [];
  const seen = new Set<string>();
  const missingHours: string[] = [];
  const firstHour = new Date(from);
  firstHour.setMinutes(0, 0, 0);

  for (let h = firstHour.getTime(); h <= to; h += 3_600_000) {
    const d = new Date(h);
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const file = join(SIGHT_DIR, day, `${pad(d.getHours())}.jsonl`);
    if (seen.has(file)) continue;
    seen.add(file);
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch {
      missingHours.push(`${day}/${pad(d.getHours())}`);
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const row = JSON.parse(line) as SightEntry;
        if (row.at >= from && row.at <= to) entries.push(row);
      } catch {
        /* A torn line is skipped, not repaired. */
      }
    }
  }

  entries.sort((a, b) => a.at - b.at);
  let kept = entries;
  if (entries.length > limit) {
    const out: SightEntry[] = [];
    const size = entries.length / limit;
    for (let i = 0; i < limit; i++) out.push(entries[Math.floor(i * size)]!);
    kept = out;
  }
  return { mounted, from, to, frameCount: entries.length, missingHours, frames: kept };
}
