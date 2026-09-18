/**
 * Port of christman_dsp.c — The Christman Bare-Metal Audio Engine.
 *
 * The C was never compiled or wired. These four functions are the same
 * math, in TypeScript, with the short-buffer underflow in christman_lpc
 * closed (length - lag underflows when the frame is shorter than order).
 *
 * Comments in the C:
 *   RMS → arousal / dominance proxy
 *   ZCR → valence smoothness proxy
 *   YIN → pitch
 *   LPC → Levinson-Durbin vocal tract
 *
 * Rule 13: these are physics. They are not Giuseppe, not Inferno,
 * not a measured emotion model, and not the 94 / 91 / 87 numbers
 * that live only as a docstring in tonescore_engine.py.
 */

export function christmanRms(audio: ArrayLike<number>): number {
  const n = audio.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = audio[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

export function christmanZcr(audio: ArrayLike<number>): number {
  const n = audio.length;
  if (n < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < n; i++) {
    const a = audio[i - 1] ?? 0;
    const b = audio[i] ?? 0;
    if ((b > 0 && a <= 0) || (b <= 0 && a > 0)) crossings++;
  }
  return crossings / n;
}

/** Levinson-Durbin LPC. Returns a[0..order] with a[0] = 1. */
export function christmanLpc(audio: ArrayLike<number>, order: number): Float32Array {
  const a = new Float32Array(order + 1);
  a[0] = 1;
  const length = audio.length;
  if (length === 0 || order <= 0 || length <= order) return a;

  const r = new Float32Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let s = 0;
    const lim = length - lag;
    for (let i = 0; i < lim; i++) {
      s += (audio[i] ?? 0) * (audio[i + lag] ?? 0);
    }
    r[lag] = s;
  }
  if (r[0] === 0) return a;

  const k = new Float32Array(order + 1);
  let error = r[0];
  for (let i = 1; i <= order; i++) {
    let sum = 0;
    for (let j = 1; j < i; j++) sum += (a[j] ?? 0) * (r[i - j] ?? 0);
    if (error === 0) break;
    const ki = ((r[i] ?? 0) - sum) / error;
    k[i] = ki;
    a[i] = ki;
    const half = Math.floor(i / 2);
    for (let j = 1; j <= half; j++) {
      const aj = a[j] ?? 0;
      const aij = a[i - j] ?? 0;
      a[j] = aj - ki * aij;
      a[i - j] = aij - ki * aj;
    }
    error *= 1 - ki * ki;
  }
  return a;
}

export type Formants = { f1: number; f2: number; f3: number };

/**
 * Formant peaks from |1 / A(ω)|. Same job as extract_frequency_signature
 * in voice_capture_client.py, but from LPC instead of raw FFT band-max.
 * Returns 0 for a slot that has no peak (never invents 150 Hz).
 */
export function lpcFormants(
  coeffs: Float32Array,
  sampleRate: number,
  nfft = 512,
): Formants {
  const half = nfft / 2;
  const mag = new Float32Array(half);
  for (let bin = 1; bin < half; bin++) {
    const w = (Math.PI * bin) / half;
    let re = 0;
    let im = 0;
    for (let i = 0; i < coeffs.length; i++) {
      const c = coeffs[i] ?? 0;
      re += c * Math.cos(w * i);
      im -= c * Math.sin(w * i);
    }
    const den = re * re + im * im;
    mag[bin] = den > 1e-12 ? 1 / Math.sqrt(den) : 0;
  }

  const hzPer = sampleRate / nfft;
  const peaks: { hz: number; mag: number }[] = [];
  for (let bin = 2; bin < half - 1; bin++) {
    const v = mag[bin] ?? 0;
    if (v > (mag[bin - 1] ?? 0) && v >= (mag[bin + 1] ?? 0) && v > 0.4) {
      const hz = bin * hzPer;
      if (hz >= 180 && hz <= 4200) peaks.push({ hz, mag: v });
    }
  }

  const pick = (lo: number, hi: number) => {
    let best = 0;
    let bestMag = 0;
    for (const p of peaks) {
      if (p.hz >= lo && p.hz <= hi && p.mag > bestMag) {
        bestMag = p.mag;
        best = p.hz;
      }
    }
    return best;
  };

  const f1 = pick(200, 1200);
  const f2 = pick(Math.max(700, f1 ? f1 + 180 : 700), 3200);
  const f3 = pick(Math.max(1800, f2 ? f2 + 180 : 1800), 4200);
  return { f1, f2, f3 };
}

/** C comment: RMS for arousal/dominance. Clipped, unlabeled as emotion. */
export function arousalProxy(rms: number): number {
  return Math.max(0, Math.min(1, rms * 10));
}

/** C comment: ZCR for valence smoothness. High ZCR = noisier / less smooth. */
export function smoothnessProxy(zcr: number): number {
  return Math.max(0, Math.min(1, 1 - zcr * 10));
}

/**
 * VAD from christman_dsp.c — not Riley's untrained Linear(1024, 3),
 * not riley_hearing.py string matching, not a 0.5 default.
 *
 *   valence     ← smoothness (inverse ZCR)
 *   arousal     ← RMS
 *   dominance   ← RMS, steeper (same C comment, different scale)
 *
 * Silence returns null. Quiet is not dissociation.
 */
export type VadVector = {
  valence: number;
  arousal: number;
  dominance: number;
  status: "NO_VECTOR" | "IN_BAND" | "HIGH_INTENSITY";
};

export function vadFromDsp(rms: number, zcr: number): VadVector | null {
  if (rms < 0.008) return null;
  const arousal = arousalProxy(rms);
  const valence = smoothnessProxy(zcr);
  const dominance = Math.max(0, Math.min(1, rms * 14));
  const status: VadVector["status"] =
    arousal > 0.85 && valence < 0.28 ? "HIGH_INTENSITY" : "IN_BAND";
  return { valence, arousal, dominance, status };
}

/**
 * The physics ToneScore named and then stubbed:
 *   jitter  — cycle-to-cycle period variation (they returned 0.05)
 *   shimmer — cycle-to-cycle peak amplitude variation
 *   HNR     — harmonic template vs residual (they computed HPSS only)
 *
 * No period lock → null. Never 85. Never 88/22. Never 0.25×92.
 */
export type VoiceQuality = {
  jitter: number;
  shimmer: number;
  hnrDb: number | null;
  cycles: number;
};

export function voiceQuality(
  buf: Float32Array,
  sampleRate: number,
  freqHz: number,
): VoiceQuality | null {
  if (freqHz < 55 || freqHz > 1200) return null;
  const period = sampleRate / freqHz;
  if (period < 8 || period > buf.length / 4) return null;

  const nCycles = Math.floor(buf.length / period);
  if (nCycles < 4) return null;

  const periods: number[] = [];
  const amps: number[] = [];
  let pos = 0;
  for (let c = 0; c < nCycles - 1; c++) {
    const start = Math.round(pos);
    const lo = Math.max(4, Math.floor(period * 0.82));
    const hi = Math.min(Math.ceil(period * 1.18), buf.length - start - 2);
    if (start + hi >= buf.length || hi <= lo) break;

    let bestLag = Math.round(period);
    let best = -Infinity;
    for (let lag = lo; lag <= hi; lag++) {
      const n = Math.min(lag, buf.length - start - lag);
      if (n < 8) continue;
      let corr = 0;
      let e1 = 0;
      let e2 = 0;
      for (let i = 0; i < n; i++) {
        const a = buf[start + i] ?? 0;
        const b = buf[start + i + lag] ?? 0;
        corr += a * b;
        e1 += a * a;
        e2 += b * b;
      }
      const r = corr / (Math.sqrt(e1 * e2) || 1);
      if (r > best) {
        best = r;
        bestLag = lag;
      }
    }
    if (best < 0.25) break;
    periods.push(bestLag / sampleRate);
    let peak = 0;
    const end = Math.min(buf.length, start + bestLag);
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(buf[i] ?? 0));
    amps.push(peak);
    pos += bestLag;
  }

  if (periods.length < 3) return null;
  const meanT = periods.reduce((s, x) => s + x, 0) / periods.length;
  const meanA = amps.reduce((s, x) => s + x, 0) / amps.length;
  if (meanT <= 0 || meanA <= 1e-8) return null;

  let jSum = 0;
  let sSum = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    jSum += Math.abs((periods[i] ?? 0) - (periods[i + 1] ?? 0));
    sSum += Math.abs((amps[i] ?? 0) - (amps[i + 1] ?? 0));
  }
  const denom = periods.length - 1;
  const jitter = jSum / (denom * meanT);
  const shimmer = sSum / (denom * meanA);

  const p = Math.max(8, Math.round(period));
  const nAvg = Math.floor(buf.length / p);
  if (nAvg < 3) return { jitter, shimmer, hnrDb: null, cycles: periods.length };

  const template = new Float32Array(p);
  for (let c = 0; c < nAvg; c++) {
    for (let i = 0; i < p; i++) template[i] += buf[c * p + i] ?? 0;
  }
  for (let i = 0; i < p; i++) template[i] /= nAvg;

  let hE = 0;
  let nE = 0;
  for (let c = 0; c < nAvg; c++) {
    for (let i = 0; i < p; i++) {
      const s = buf[c * p + i] ?? 0;
      const h = template[i] ?? 0;
      hE += h * h;
      const d = s - h;
      nE += d * d;
    }
  }
  const hnrDb = nE > 1e-12 ? 10 * Math.log10(hE / nE) : null;
  return { jitter, shimmer, hnrDb, cycles: periods.length };
}


