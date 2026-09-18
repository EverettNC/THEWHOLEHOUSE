/**
 * Spectral + DSP proxies — measured features, not emotions.
 * Rule 13: these are physics. Do not report them as clinical affect.
 */

import {
  arousalProxy,
  christmanLpc,
  christmanZcr,
  lpcFormants,
  smoothnessProxy,
  vadFromDsp,
  voiceQuality,
  type Formants,
  type VadVector,
  type VoiceQuality,
} from "./dsp";

export type SpectralProxies = {
  centroidHz: number;
  rolloffHz: number;
  zcr: number;
  brightness: number;
  noisiness: number;
  arousal: number;
  smoothness: number;
  formants: Formants;
  vad: VadVector | null;
  quality: VoiceQuality | null;
};

let lpcClock = 0;
let lastFormants: Formants = { f1: 0, f2: 0, f3: 0 };

export function measureProxies(
  freqData: Uint8Array,
  timeData: Float32Array,
  sampleRate: number,
  fftSize: number,
  rms: number,
  f0: number | null,
): SpectralProxies {
  const binHz = sampleRate / fftSize;
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < freqData.length; i++) {
    const mag = (freqData[i] ?? 0) / 255;
    weighted += mag * i * binHz;
    total += mag;
  }
  const centroidHz = total > 0.001 ? weighted / total : 0;

  let cum = 0;
  const target = total * 0.85;
  let rolloffHz = 0;
  for (let i = 1; i < freqData.length; i++) {
    cum += (freqData[i] ?? 0) / 255;
    if (cum >= target) {
      rolloffHz = i * binHz;
      break;
    }
  }

  const zcr = christmanZcr(timeData);

  lpcClock += 1;
  if (rms > 0.008 && lpcClock % 3 === 0) {
    // Order must cover the band. The standard rule is ~sampleRate/1000 + 2:
    // at 48 kHz that is 50, not 16. Measured 2026-09-01 against synthesised
    // vowels with known F1/F2 — at order 16 the poles march to Nyquist
    // modelling empty high band and only two are left for the formants
    // (worst F1 error 318 Hz, F2 missed on 3 of 5 vowels). At order ~48 the
    // worst F1 error is 14 Hz and F2 is never missed, for 0.67 ms per frame.
    const order = Math.min(64, Math.max(12, Math.round(sampleRate / 1000) + 2));
    lastFormants = lpcFormants(christmanLpc(timeData, order), sampleRate);
  } else if (rms <= 0.008) {
    lastFormants = { f1: 0, f2: 0, f3: 0 };
  }

  const brightness = Math.max(0, Math.min(1, centroidHz / 4000));
  const noisiness = Math.max(0, Math.min(1, zcr * 8));

  return {
    centroidHz,
    rolloffHz,
    zcr,
    brightness,
    noisiness,
    arousal: arousalProxy(rms),
    smoothness: smoothnessProxy(zcr),
    formants: lastFormants,
    vad: vadFromDsp(rms, zcr),
    quality:
      rms > 0.008 && f0 != null ? voiceQuality(timeData, sampleRate, f0) : null,
  };
}
