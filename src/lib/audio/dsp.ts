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
 * Roots of the LPC polynomial, as {hz, bandwidthHz}, ascending by hz.
 *
 * christmanLpc returns Levinson-Durbin coefficients in the convention
 *   A(z) = 1 - SUM a_k z^-k
 * so the polynomial whose roots are the vocal-tract poles is, in descending
 * powers of z:  [1, -a1, -a2, ... -ap].
 *
 * Solved by Durand-Kerner. Each conjugate pair is one resonance:
 *   hz = angle(z) * sr / 2pi        bandwidth = -(sr/pi) * ln|z|
 *
 * Continuous frequencies — no FFT bin to snap to. A pole is a pole.
 */
export function lpcRoots(
  coeffs: Float32Array,
  sampleRate: number,
): { hz: number; bandwidthHz: number }[] {
  const p = coeffs.length - 1;
  if (p < 2) return [];

  // Descending-power coefficients of z^p - a1 z^(p-1) - ... - ap.
  const c: number[] = [1];
  for (let k = 1; k <= p; k++) c.push(-(coeffs[k] ?? 0));
  // Strip leading zeros beyond the first (degree drop) and trailing zeros
  // (roots at the origin carry no resonance).
  let deg = p;
  while (deg > 0 && Math.abs(c[deg] ?? 0) < 1e-12) deg--;
  if (deg < 2) return [];

  // Durand-Kerner from the standard 0.4+0.9i spiral.
  const re = new Float64Array(deg);
  const im = new Float64Array(deg);
  for (let i = 0; i < deg; i++) {
    const r = Math.pow(0.4 * 0.4 + 0.9 * 0.9, (i + 1) / 2);
    const th = (i + 1) * Math.atan2(0.9, 0.4);
    re[i] = r * Math.cos(th);
    im[i] = r * Math.sin(th);
  }

  const evalPoly = (x: number, y: number): [number, number] => {
    let ar = 0;
    let ai = 0;
    for (let k = 0; k <= deg; k++) {
      const nr = ar * x - ai * y + (c[k] ?? 0);
      ai = ar * y + ai * x;
      ar = nr;
    }
    return [ar, ai];
  };

  for (let iter = 0; iter < 200; iter++) {
    let moved = 0;
    for (let i = 0; i < deg; i++) {
      const xi = re[i] ?? 0;
      const yi = im[i] ?? 0;
      let [nr, ni] = evalPoly(xi, yi);
      let dr = 1;
      let di = 0;
      for (let j = 0; j < deg; j++) {
        if (j === i) continue;
        const ux = xi - (re[j] ?? 0);
        const uy = yi - (im[j] ?? 0);
        const t = dr * ux - di * uy;
        di = dr * uy + di * ux;
        dr = t;
      }
      const den = dr * dr + di * di;
      if (den < 1e-30) continue;
      const qr = (nr * dr + ni * di) / den;
      const qi = (ni * dr - nr * di) / den;
      re[i] = xi - qr;
      im[i] = yi - qi;
      moved = Math.max(moved, Math.abs(qr) + Math.abs(qi));
    }
    if (moved < 1e-12) break;
  }

  const out: { hz: number; bandwidthHz: number }[] = [];
  for (let i = 0; i < deg; i++) {
    const x = re[i] ?? 0;
    const y = im[i] ?? 0;
    if (y <= 0) continue; // one of each conjugate pair
    const mag = Math.hypot(x, y);
    if (!(mag > 0) || mag >= 1) continue; // unstable / on the circle
    const hz = (Math.atan2(y, x) * sampleRate) / (2 * Math.PI);
    const bandwidthHz = (-(sampleRate / Math.PI) * Math.log(mag));
    if (!Number.isFinite(hz) || !Number.isFinite(bandwidthHz)) continue;
    out.push({ hz, bandwidthHz });
  }
  out.sort((a, b) => a.hz - b.hz);
  return out;
}

/** A resonance wider than this is not a formant — it is spectral tilt or noise. */
const MAX_FORMANT_BW_HZ = 500;

/**
 * Formants from the poles of A(z).
 *
 * Was: peaks of |1/A(w)| sampled on a 512-point grid, with A evaluated as
 * 1 + SUM a_k — the wrong sign for Levinson's output. That spectrum has no
 * local maxima at all, so every slot returned 0 on real vowels, while noise
 * ripple occasionally cleared the absolute 0.4 cut and produced a number in
 * the f2 slot that was never a formant. Proven 2026-09-01 against synthesised
 * vowels with known F1/F2 and against pure noise.
 *
 * Now: solve for the poles directly. Continuous Hz, and a bandwidth per pole
 * so a wide root can be rejected instead of reported.
 *
 * Contract unchanged: returns 0 for a slot that has no pole (never invents
 * 150 Hz). `nfft` is retained for call-site compatibility and is unused —
 * root-finding has no grid.
 */
export function lpcFormants(
  coeffs: Float32Array,
  sampleRate: number,
  _nfft = 512,
): Formants {
  const poles = lpcRoots(coeffs, sampleRate).filter(
    (r) => r.bandwidthHz > 0 && r.bandwidthHz <= MAX_FORMANT_BW_HZ && r.hz >= 180 && r.hz <= 4200,
  );

  /** Lowest surviving pole in the band — formants are assigned in order. */
  const pick = (lo: number, hi: number) => {
    for (const r of poles) if (r.hz >= lo && r.hz <= hi) return r.hz;
    return 0;
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


