/**
 * Compact YIN pitch detector (de Cheveigné & Kawahara, 2002).
 * Returns the strongest periodic fundamental in the buffer, or null.
 */
export function detectPitchYin(
  buf: Float32Array,
  sampleRate: number,
  threshold = 0.13,
): { freq: number; probability: number } | null {
  const size = buf.length;
  const half = Math.floor(size / 2);
  if (half < 32) return null;

  const yin = new Float32Array(half);
  for (let tau = 1; tau < half; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const d = buf[i]! - buf[i + tau]!;
      sum += d * d;
    }
    yin[tau] = sum;
  }

  let running = 0;
  yin[0] = 1;
  for (let tau = 1; tau < half; tau++) {
    running += yin[tau]!;
    yin[tau] = running > 0 ? (yin[tau]! * tau) / running : 1;
  }

  const tauMin = Math.max(2, Math.floor(sampleRate / 1800));
  const tauMax = Math.min(half - 2, Math.floor(sampleRate / 55));

  let tauEst = -1;
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (yin[tau]! < threshold) {
      while (tau + 1 < tauMax && yin[tau + 1]! < yin[tau]!) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) return null;

  // Prefer the shortest period that is still a dip (classic YIN octave error).
  for (let k = 4; k >= 2; k--) {
    const cand = Math.round(tauEst / k);
    if (cand >= tauMin && (yin[cand] ?? 1) < threshold * 1.4) {
      tauEst = cand;
      break;
    }
  }

  const s0 = yin[tauEst - 1]!;
  const s1 = yin[tauEst]!;
  const s2 = yin[tauEst + 1]!;
  const denom = 2 * s1 - s2 - s0;
  const better = denom !== 0 ? tauEst + (s2 - s0) / (2 * denom) : tauEst;
  if (better <= 0) return null;

  const freq = sampleRate / better;
  const probability = 1 - s1;
  if (freq < 55 || freq > 1800 || probability < 0.55) return null;
  return { freq, probability };
}

export function interpolateBin(
  mags: Uint8Array,
  bin: number,
  sampleRate: number,
  fftSize: number,
): number {
  const y0 = mags[bin - 1] ?? 0;
  const y1 = mags[bin] ?? 0;
  const y2 = mags[bin + 1] ?? 0;
  const denom = 2 * (2 * y1 - y0 - y2);
  const delta = denom !== 0 ? (y2 - y0) / denom : 0;
  return ((bin + delta) * sampleRate) / fftSize;
}

export type PartialTone = {
  freq: number;
  amp: number;
  bin: number;
};

export function findPartials(
  mags: Uint8Array,
  sampleRate: number,
  fftSize: number,
  count = 6,
): PartialTone[] {
  const nyquist = sampleRate / 2;
  const minBin = Math.max(2, Math.floor((55 / nyquist) * (mags.length - 1)));
  const maxBin = Math.min(
    mags.length - 2,
    Math.floor((8000 / nyquist) * (mags.length - 1)),
  );
  const peaks: PartialTone[] = [];

  for (let i = minBin; i <= maxBin; i++) {
    const v = mags[i] ?? 0;
    if (v < 28) continue;
    if (v >= (mags[i - 1] ?? 0) && v >= (mags[i + 1] ?? 0)) {
      peaks.push({
        freq: interpolateBin(mags, i, sampleRate, fftSize),
        amp: v / 255,
        bin: i,
      });
    }
  }

  peaks.sort((a, b) => b.amp - a.amp);
  const picked: PartialTone[] = [];
  for (const p of peaks) {
    if (picked.some((q) => Math.abs(q.freq - p.freq) / p.freq < 0.03)) continue;
    picked.push(p);
    if (picked.length >= count) break;
  }
  picked.sort((a, b) => a.freq - b.freq);
  return picked;
}

export function rmsLevel(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / Math.max(1, buf.length));
}
