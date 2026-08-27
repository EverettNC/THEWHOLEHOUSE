/**
 * Port of open_smell2.classify.
 * coverage × mean_intensity × specificity. Alert at 0.7.
 * A single MQ-135 scalar does not become twenty species.
 */
import { LIVE_PROFILES } from "./profiles.ts";
import {
  ALERT_THRESHOLD,
  CLASSIFY_TOP_N,
  DETECT_THRESHOLD,
  MIN_CONFIDENCE,
  SENSOR_CHANNELS,
  type SensorChannel,
  type SmellHit,
} from "./types.ts";

const MAX_SIG = Math.sqrt(
  Math.max(1, ...LIVE_PROFILES.map((p) => p.channels.length)),
);

export function channelCount(channels: Partial<Record<SensorChannel, number>> | null): number {
  if (!channels) return 0;
  let n = 0;
  for (const key of SENSOR_CHANNELS) {
    const v = channels[key];
    if (typeof v === "number" && Number.isFinite(v)) n += 1;
  }
  return n;
}

export function isScalarOnly(channels: Partial<Record<SensorChannel, number>> | null): boolean {
  return channelCount(channels) === 0;
}

export function classify(
  channels: Partial<Record<SensorChannel, number>> | null,
  opts?: { detectThreshold?: number; minConfidence?: number; topN?: number },
): SmellHit[] {
  if (!channels || isScalarOnly(channels)) return [];
  const detect = opts?.detectThreshold ?? DETECT_THRESHOLD;
  const min = opts?.minConfidence ?? MIN_CONFIDENCE;
  const topN = opts?.topN ?? CLASSIFY_TOP_N;

  const detected = new Map<SensorChannel, number>();
  for (const key of SENSOR_CHANNELS) {
    const raw = channels[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const v = Math.max(0, Math.min(1, raw));
    if (v >= detect) detected.set(key, v);
  }
  if (detected.size === 0) return [];

  const hits: SmellHit[] = [];
  for (const profile of LIVE_PROFILES) {
    const matched: SensorChannel[] = [];
    let intensitySum = 0;
    for (const ch of profile.channels) {
      const v = detected.get(ch);
      if (v == null) continue;
      matched.push(ch);
      intensitySum += v;
    }
    if (matched.length === 0) continue;
    const coverage = matched.length / profile.channels.length;
    const meanIntensity = intensitySum / matched.length;
    const specificity = Math.sqrt(matched.length) / MAX_SIG;
    const confidence = Math.min(1, coverage * meanIntensity * specificity);
    if (confidence < min) continue;
    hits.push({
      profileKey: profile.key,
      condition: profile.condition,
      category: profile.category,
      severity: profile.severity,
      matchedChannels: matched,
      coverage,
      meanIntensity,
      specificity,
      confidence,
      alert: confidence >= ALERT_THRESHOLD,
    });
  }

  hits.sort((a, b) => b.confidence - a.confidence);
  return hits.slice(0, topN);
}
