import { SENSOR_CHANNELS, type SensorChannel, type SmellClaim, type SmellKind, type SmellReading } from "./types";

export type ParsedSmell = SmellReading & { note?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function analogToIntensity(n: number): number {
  if (n > 1 && n <= 1023) return clamp01(n / 1023);
  if (n > 1 && n <= 4095) return clamp01(n / 4095);
  return clamp01(n);
}

export function parseChannels(raw: unknown): Partial<Record<SensorChannel, number>> | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const out: Partial<Record<SensorChannel, number>> = {};
  let n = 0;
  for (const key of SENSOR_CHANNELS) {
    const v = num(rec[key]);
    if (v == null) continue;
    out[key] = analogToIntensity(v);
    n += 1;
  }
  return n > 0 ? out : null;
}

export function parseSmellPayload(raw: unknown, fallbackKind: SmellKind): ParsedSmell | null {
  const rec = asRecord(raw);
  if (!rec) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return {
        kind: fallbackKind,
        claim: fallbackKind === "sample" ? "record" : "living",
        intensity: analogToIntensity(raw),
        baseline: null,
        channels: null,
        at: Date.now(),
      };
    }
    return null;
  }

  const kind: SmellKind =
    rec.kind === "serial" || rec.kind === "file" || rec.kind === "sample"
      ? rec.kind
      : fallbackKind;
  const claim: SmellClaim =
    rec.claim === "simulation" || rec.claim === "record" || rec.claim === "living"
      ? rec.claim
      : kind === "sample"
        ? "record"
        : kind === "file"
          ? "record"
          : "living";

  const channels = parseChannels(rec.channels ?? rec);
  const intensityRaw = num(rec.intensity) ?? num(rec.aout) ?? num(rec.value);
  const fromChannels =
    channels &&
    SENSOR_CHANNELS.reduce((s, k) => s + (channels[k] ?? 0), 0) /
      Math.max(1, Object.keys(channels).length);
  const intensity = analogToIntensity(intensityRaw ?? fromChannels ?? 0);
  const baseline = num(rec.baseline);

  if (intensityRaw == null && !channels) return null;

  return {
    kind,
    claim,
    intensity,
    baseline,
    channels,
    at: Date.now(),
    note: typeof rec.note === "string" ? rec.note : undefined,
  };
}

export function parseSmellText(text: string, fallbackKind: SmellKind): ParsedSmell | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return parseSmellPayload(JSON.parse(trimmed) as unknown, fallbackKind);
  } catch {
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1];
    const n = num(last);
    if (n == null) return null;
    return parseSmellPayload(n, fallbackKind);
  }
}

export function serialLineToIntensity(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseSmellPayload(JSON.parse(trimmed) as unknown, "serial");
    return parsed?.intensity ?? null;
  } catch {
    const n = num(trimmed.split(/[,\s]+/).pop());
    return n == null ? null : analogToIntensity(n);
  }
}
