/**
 * Corti physics tests. Fail loud. No canned green.
 * Run: node --experimental-strip-types --test src/lib/audio/corti.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arousalProxy,
  christmanLpc,
  christmanRms,
  christmanZcr,
  lpcFormants,
  smoothnessProxy,
  vadFromDsp,
  voiceQuality,
} from "./dsp.ts";
import { analyzeNote, freqToMidi, freqToPlace, midiToFreq, placeToFreq } from "./notes.ts";
import { compareToSeat, MIN_VOICED_TO_SEAT, seatFromEvents } from "./speaker.ts";
import { VocalTracker, type VocalEvent } from "./vocalization.ts";
import { detectPitchYin } from "./yin.ts";
import { centsError, finishTrial, summarizeCorpus } from "./corpus.ts";
import {
  analyzeGruntPhysics,
  detectVocalStimming,
  routeForAlphaVox,
} from "./alphavox-router.ts";

const SR = 48000;

function sine(freq: number, seconds: number, amp = 0.5, sr = SR): Float32Array {
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
}

function silence(n: number): Float32Array {
  return new Float32Array(n);
}

function noise(n: number, amp = 0.4): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * amp;
  return out;
}

describe("christman_rms", () => {
  it("silence is 0", () => {
    assert.equal(christmanRms(silence(2048)), 0);
  });
  it("empty is 0", () => {
    assert.equal(christmanRms([]), 0);
  });
  it("unit sine RMS is 1/√2", () => {
    const r = christmanRms(sine(440, 0.1, 1));
    assert.ok(Math.abs(r - Math.SQRT1_2) < 0.01, `rms=${r}`);
  });
  it("half-amp sine is half", () => {
    const a = christmanRms(sine(220, 0.1, 1));
    const b = christmanRms(sine(220, 0.1, 0.5));
    assert.ok(Math.abs(b / a - 0.5) < 0.02, `${b}/${a}`);
  });
});

describe("christman_zcr", () => {
  it("DC is 0", () => {
    const buf = new Float32Array(1024);
    buf.fill(0.3);
    assert.equal(christmanZcr(buf), 0);
  });
  it("short buffer is 0", () => {
    assert.equal(christmanZcr(new Float32Array(1)), 0);
  });
  it("1 kHz sine at 48 kHz is ~0.0417", () => {
    const z = christmanZcr(sine(1000, 0.2, 0.5));
    assert.ok(Math.abs(z - 2 / 48) < 0.005, `zcr=${z}`);
  });
  it("noise is rougher than a sine", () => {
    assert.ok(christmanZcr(noise(4096)) > christmanZcr(sine(220, 4096 / SR)));
  });
});

describe("christman_lpc", () => {
  it("a[0] is always 1", () => {
    const a = christmanLpc(sine(220, 0.05), 12);
    assert.equal(a[0], 1);
    assert.equal(a.length, 13);
  });
  it("short buffer does not underflow — returns a[0]=1 rest 0", () => {
    const a = christmanLpc(new Float32Array(8), 14);
    assert.equal(a[0], 1);
    for (let i = 1; i < a.length; i++) assert.equal(a[i], 0);
  });
  it("silence returns a[0]=1", () => {
    const a = christmanLpc(silence(2048), 12);
    assert.equal(a[0], 1);
  });
});

describe("lpcFormants", () => {
  it("never invents 150 Hz", () => {
    const f = lpcFormants(new Float32Array([1, 0, 0, 0]), 48000);
    assert.notEqual(f.f1, 150);
    assert.notEqual(f.f2, 150);
    assert.ok(f.f1 === 0 || f.f1 >= 180);
  });
  it("zeros stay zero", () => {
    const f = lpcFormants(new Float32Array([1]), 16000);
    assert.deepEqual(f, { f1: 0, f2: 0, f3: 0 });
  });
});

describe("YIN", () => {
  it("locks A3 (220 Hz) within 2 Hz", () => {
    const p = detectPitchYin(sine(220, 0.12), SR);
    assert.ok(p, "no lock on a clean 220 Hz sine");
    assert.ok(Math.abs(p.freq - 220) < 2, `freq=${p.freq}`);
    assert.ok(p.probability > 0.7, `p=${p.probability}`);
  });
  it("locks C4 (261.63 Hz) within 2 Hz", () => {
    const p = detectPitchYin(sine(261.63, 0.12), SR);
    assert.ok(p, "no lock on C4");
    assert.ok(Math.abs(p.freq - 261.63) < 2, `freq=${p.freq}`);
  });
  it("does not jump A2 (110 Hz) up an octave", () => {
    const p = detectPitchYin(sine(110, 0.18), SR);
    assert.ok(p, "no lock on 110");
    assert.ok(Math.abs(p.freq - 110) < 2, `freq=${p.freq}`);
  });
  it("silence is null — not 150 Hz", () => {
    const p = detectPitchYin(silence(4096), SR);
    assert.equal(p, null);
  });
  it("tiny sine is still periodic — YIN locks; RMS floor is what refuses it", () => {
    const buf = sine(220, 0.12, 0.0001);
    const p = detectPitchYin(buf, SR);
    assert.ok(p, "a clean sine is periodic even when quiet");
    assert.ok(Math.abs(p.freq - 220) < 2);
    const rms = christmanRms(buf);
    assert.ok(rms < 0.008, `rms=${rms} should be below the live floor`);
    assert.equal(vadFromDsp(rms, christmanZcr(buf)), null);
  });
  it("white noise does not invent a note", () => {
    const p = detectPitchYin(noise(4096, 0.3), SR);
    assert.equal(p, null);
  });
});

describe("notes", () => {
  it("440 is A4", () => {
    const n = analyzeNote(440);
    assert.equal(n.name, "A4");
    assert.ok(n.inTune);
    assert.ok(Math.abs(n.cents) < 1);
  });
  it("261.63 is C4", () => {
    const n = analyzeNote(261.63);
    assert.equal(n.name, "C4");
  });
  it("432 A4 preset maps 432 → A4", () => {
    const n = analyzeNote(432, 432);
    assert.equal(n.name, "A4");
  });
  it("midi ↔ freq round-trips A4", () => {
    assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9);
    assert.ok(Math.abs(freqToMidi(440) - 69) < 1e-9);
  });
});

describe("VAD — silence is not 0.5 NORMAL", () => {
  it("rms 0 → null", () => {
    assert.equal(vadFromDsp(0, 0), null);
  });
  it("rms 0.007 → null (below floor)", () => {
    assert.equal(vadFromDsp(0.007, 0.05), null);
  });
  it("never returns valence 0.5 on empty", () => {
    const v = vadFromDsp(0, 0);
    assert.equal(v, null);
  });
  it("live sine energy is IN_BAND", () => {
    const rms = christmanRms(sine(220, 0.08, 0.4));
    const zcr = christmanZcr(sine(220, 0.08, 0.4));
    const v = vadFromDsp(rms, zcr);
    assert.ok(v, "should have a vector");
    assert.equal(v.status, "IN_BAND");
    assert.ok(v.arousal > 0 && v.arousal <= 1);
    assert.ok(v.valence > 0 && v.valence <= 1);
  });
  it("loud + rough is HIGH_INTENSITY, not Inferno", () => {
    const v = vadFromDsp(0.2, 0.2);
    assert.ok(v);
    assert.equal(v.status, "HIGH_INTENSITY");
  });
  it("proxies clip to [0,1]", () => {
    assert.equal(arousalProxy(0), 0);
    assert.equal(arousalProxy(10), 1);
    assert.equal(smoothnessProxy(0), 1);
    assert.equal(smoothnessProxy(1), 0);
  });
});

describe("voice quality — the numbers ToneScore stubbed", () => {
  it("no lock → null, not 0.05 / 88 / 22", () => {
    assert.equal(voiceQuality(silence(4096), SR, 0), null);
    assert.equal(voiceQuality(sine(220, 0.1), SR, 20), null);
    assert.equal(voiceQuality(sine(220, 0.1), SR, 4000), null);
  });
  it("clean 220 Hz sine has low jitter, measurable HNR", () => {
    const q = voiceQuality(sine(220, 0.2, 0.6), SR, 220);
    assert.ok(q, "clean sine must produce quality");
    assert.ok(q.jitter < 0.02, `jitter=${q.jitter} (Riley stubbed 0.05)`);
    assert.ok(q.shimmer < 0.05, `shimmer=${q.shimmer}`);
    assert.ok(q.hnrDb != null && q.hnrDb > 10, `hnr=${q.hnrDb}`);
    assert.notEqual(q.jitter, 0.05);
    assert.ok(q.cycles >= 3);
  });
  it("never returns the Riley composite 85", () => {
    const q = voiceQuality(sine(261.63, 0.2, 0.5), SR, 261.63);
    assert.ok(q);
    assert.notEqual(q.jitter, 85);
    assert.notEqual(q.shimmer, 85);
    assert.notEqual(q.hnrDb, 85);
  });
});

describe("vocalization tracker", () => {
  it("silence never opens", () => {
    const t = new VocalTracker();
    for (let i = 0; i < 20; i++) t.step(i * 16, 0.001, 0.01, null, 0, 0);
    assert.equal(t.open, false);
    assert.equal(t.events.length, 0);
  });
  it("voiced 200 ms low F0 is a grunt (duration bin, not pain)", () => {
    const t = new VocalTracker();
    let ev = null as ReturnType<VocalTracker["step"]>;
    for (let i = 0; i < 16; i++) {
      ev = t.step(i * 16, 0.08, 0.04, 140, 500, 1400) ?? ev;
    }
    ev = t.step(16 * 16, 0.002, 0.04, 140, 500, 1400) ?? ev;
    assert.ok(ev, "event should close");
    assert.equal(ev.kind, "grunt");
    assert.ok(ev.voiced);
    assert.ok(ev.f0 != null && ev.f0 > 100 && ev.f0 < 180);
    assert.ok(ev.tape.length >= 3, `tape=${ev.tape.length}`);
    assert.equal(ev.tape[0]?.t, 0);
    assert.ok(ev.tape.some((f) => f.f0 === 140));
  });
  it("voiced 500 ms is a groan", () => {
    const t = new VocalTracker();
    let ev = null as ReturnType<VocalTracker["step"]>;
    for (let i = 0; i < 36; i++) ev = t.step(i * 16, 0.08, 0.03, 130, 400, 1200) ?? ev;
    ev = t.step(36 * 16, 0.001, 0.03, 130, 400, 1200) ?? ev;
    assert.ok(ev);
    assert.equal(ev.kind, "groan");
    assert.ok(ev.durationMs >= 430);
  });
  it("short unvoiced high ZCR is a tick", () => {
    const t = new VocalTracker();
    let ev = null as ReturnType<VocalTracker["step"]>;
    for (let i = 0; i < 4; i++) ev = t.step(i * 16, 0.05, 0.22, null, 0, 0) ?? ev;
    ev = t.step(4 * 16, 0.001, 0.22, null, 0, 0) ?? ev;
    assert.ok(ev);
    assert.equal(ev.kind, "tick");
    assert.equal(ev.f0, null);
    assert.ok(ev.tape.every((f) => f.f0 === null));
  });
  it("long unvoiced high ZCR is a hiss", () => {
    const t = new VocalTracker();
    let ev = null as ReturnType<VocalTracker["step"]>;
    for (let i = 0; i < 14; i++) ev = t.step(i * 16, 0.06, 0.2, null, 0, 0) ?? ev;
    ev = t.step(14 * 16, 0.001, 0.2, null, 0, 0) ?? ev;
    assert.ok(ev);
    assert.equal(ev.kind, "hiss");
    assert.equal(ev.voiced, false);
  });
});

describe("chromatic lock — train the ear on concert pitch", () => {
  const names: [number, string][] = [
    [110, "A2"],
    [130.81, "C3"],
    [196, "G3"],
    [220, "A3"],
    [246.94, "B3"],
    [261.63, "C4"],
    [293.66, "D4"],
    [329.63, "E4"],
    [349.23, "F4"],
    [392, "G4"],
    [440, "A4"],
    [523.25, "C5"],
  ];
  for (const [hz, name] of names) {
    it(`locks ${name} (${hz} Hz)`, () => {
      const p = detectPitchYin(sine(hz, 0.16), SR);
      assert.ok(p, `no lock on ${name}`);
      assert.ok(Math.abs(p.freq - hz) < 2.5, `${name} got ${p.freq}`);
      const n = analyzeNote(p.freq);
      assert.equal(n.name, name);
    });
  }
});

describe("Greenwood place", () => {
  it("apex is lower than base", () => {
    assert.ok(freqToPlace(200) < freqToPlace(2000));
    assert.ok(Math.abs(placeToFreq(freqToPlace(1000)) - 1000) < 2);
  });
});

describe("speaker seat", () => {
  const voiced = (f0: number, id: number): VocalEvent => ({
    id,
    kind: "voiced",
    startedAt: 0,
    durationMs: 200,
    peakRms: 0.08,
    attackMs: 12,
    decayMs: 180,
    f0,
    f1: 500,
    f2: 1400,
    zcr: 0.04,
    voiced: true,
    tape: [{ t: 0, rms: 0.08, zcr: 0.04, f0 }],
  });

  it("refuses to seat on fewer than 3 voiced events", () => {
    assert.equal(seatFromEvents([voiced(140, 1), voiced(142, 2)], 0.002), null);
    assert.equal(MIN_VOICED_TO_SEAT, 3);
  });

  it("seats median F0 from three voiced events", () => {
    const seat = seatFromEvents(
      [voiced(130, 1), voiced(150, 2), voiced(140, 3)],
      0.003,
    );
    assert.ok(seat);
    assert.equal(seat.f0Median, 140);
    assert.equal(seat.samples, 3);
    assert.equal(seat.restRms, 0.003);
  });

  it("cold compare invents nothing", () => {
    const vs = compareToSeat(voiced(140, 1), null);
    assert.equal(vs.status, "COLD");
    assert.equal(vs.f0DeltaHz, null);
    assert.equal(vs.rmsRatio, null);
  });

  it("seated compare is a delta, not an emotion", () => {
    const seat = seatFromEvents(
      [voiced(140, 1), voiced(140, 2), voiced(140, 3)],
      0.02,
    );
    assert.ok(seat);
    const vs = compareToSeat(voiced(160, 4), seat);
    assert.equal(vs.status, "SEATED");
    assert.equal(vs.f0DeltaHz, 20);
    assert.ok(vs.rmsRatio != null && Math.abs(vs.rmsRatio - 4) < 0.01);
  });
});

describe("calib corpus — known Hz vs lock", () => {
  it("cents is 0 on exact lock", () => {
    assert.equal(centsError(440, 440), 0);
  });
  it("one semitone up is +100 cents", () => {
    const c = centsError(440 * 2 ** (1 / 12), 440);
    assert.ok(c != null && Math.abs(c - 100) < 0.01, `cents=${c}`);
  });
  it("refuses to invent cents on a miss", () => {
    assert.equal(centsError(0, 440), null);
    assert.equal(centsError(440, 0), null);
  });
  it("one lock is not a measurement", () => {
    const s = finishTrial({
      midi: 69,
      expectedHz: 440,
      locks: [440],
      peakRms: 0.2,
      waveform: "sine",
      a4: 440,
      source: "train",
    });
    assert.equal(s.locked, false);
    assert.equal(s.measuredHz, null);
    assert.equal(s.cents, null);
    assert.equal(s.lockFrames, 1);
  });
  it("two locks median, no default", () => {
    const s = finishTrial({
      midi: 69,
      expectedHz: 440,
      locks: [438, 442],
      peakRms: 0.2,
      waveform: "sine",
      a4: 440,
      source: "train",
    });
    assert.equal(s.locked, true);
    assert.equal(s.measuredHz, 440);
    assert.ok(s.cents != null && Math.abs(s.cents) < 0.01);
  });
  it("empty corpus summary does not fake accuracy", () => {
    const sum = summarizeCorpus([]);
    assert.equal(sum.n, 0);
    assert.equal(sum.locked, 0);
    assert.equal(sum.medianAbsCents, null);
  });
});

describe("alphavox router — client only", () => {
  it("does not invent 180 Hz when f0 is null", () => {
    const key = analyzeGruntPhysics({
      id: 1,
      kind: "grunt",
      startedAt: 0,
      durationMs: 200,
      peakRms: 0.05,
      attackMs: 8,
      decayMs: 192,
      f0: null,
      f1: 0,
      f2: 0,
      zcr: 0.2,
      voiced: false,
      tape: [],
    });
    assert.notEqual(key, "grunt_distress");
    assert.equal(key, "unknown");
  });

  it("distress needs a lock plus sharp attack plus strain", () => {
    const key = analyzeGruntPhysics({
      id: 2,
      kind: "grunt",
      startedAt: 0,
      durationMs: 200,
      peakRms: 0.08,
      attackMs: 8,
      decayMs: 192,
      f0: 280,
      f1: 600,
      f2: 1600,
      zcr: 0.18,
      voiced: true,
      tape: [],
    });
    assert.equal(key, "grunt_distress");
  });

  it("rhythmic cadence is vocal_stimming, not HOLD_SPACE", () => {
    const ring = [0, 200, 400, 600].map((t, i) => ({
      id: i,
      kind: "grunt" as const,
      startedAt: t,
      durationMs: 80,
      peakRms: 0.03,
      attackMs: 20,
      decayMs: 60,
      f0: 140,
      f1: 400,
      f2: 1200,
      zcr: 0.08,
      voiced: true,
      tape: [],
    }));
    assert.equal(detectVocalStimming(ring), true);
    assert.equal(routeForAlphaVox(ring), "vocal_stimming");
  });
});

