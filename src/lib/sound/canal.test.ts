/**
 * Canal tape. The canal records the measured signal while Corti listens.
 * An utterance close is a card. It is not the tape.
 * Run: node --experimental-strip-types --test src/lib/sound/canal.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CanalRecorder,
  appendCanal,
  downsampleTape,
  FRAME_MS,
  MAX_FRAMES,
} from "./canal.ts";

describe("CanalRecorder — silence is still a measurement", () => {
  it("records frames without an utterance close", () => {
    const rec = new CanalRecorder();
    rec.start(0);
    const kept: number[] = [];
    for (let t = 0; t <= 500; t += 10) {
      const frame = rec.step(t, 0.002, 0.04, null);
      if (frame) kept.push(frame.t);
    }
    assert.ok(kept.length >= 8, `frames=${kept.length}`);
    assert.ok(kept.every((t) => t % FRAME_MS === 0 || t === 0 || t >= FRAME_MS));
    const snap = rec.snapshot();
    assert.equal(snap.listening, true);
    assert.ok(snap.tape.length >= 8);
    assert.ok(snap.tape.every((f) => f.f0 === null));
    assert.equal(snap.f0, null);
  });

  it("does not record while the mic is down", () => {
    const rec = new CanalRecorder();
    assert.equal(rec.step(0, 0.08, 0.04, 140), null);
    rec.start(0);
    rec.stop();
    assert.equal(rec.step(80, 0.08, 0.04, 140), null);
    assert.equal(rec.snapshot().listening, false);
    assert.equal(rec.snapshot().tape.length, 0);
  });
});

describe("appendCanal — the rack is the archive", () => {
  it("starts a record from the first batch", () => {
    const rec = appendCanal(null, {
      listening: true,
      startedAt: 1000,
      frames: [
        { t: 0, rms: 0.01, zcr: 0.04, f0: null },
        { t: 50, rms: 0.02, zcr: 0.04, f0: 140 },
      ],
    });
    assert.equal(rec.family, "christman-sound");
    assert.equal(rec.organ, "canal");
    assert.equal(rec.frameCount, 2);
    assert.equal(rec.tape.length, 2);
    assert.equal(rec.f0, 140);
    assert.equal(rec.peakRms, 0.02);
    assert.equal(rec.listening, true);
  });

  it("concatenates later batches — hours do not wait for a close", () => {
    const first = appendCanal(null, {
      listening: true,
      startedAt: 1000,
      frames: [{ t: 0, rms: 0.01, zcr: 0.04, f0: null }],
    });
    const next = appendCanal(first, {
      listening: true,
      startedAt: 1000,
      frames: [{ t: 50, rms: 0.03, zcr: 0.05, f0: null }],
    });
    assert.equal(next.frameCount, 2);
    assert.equal(next.tape[1]?.rms, 0.03);
    assert.equal(next.peakRms, 0.03);
    assert.equal(next.f0, null);
  });

  it("keeps the tape when listening stops", () => {
    const first = appendCanal(null, {
      listening: true,
      startedAt: 1000,
      frames: [{ t: 0, rms: 0.04, zcr: 0.04, f0: 110 }],
    });
    const stopped = appendCanal(first, {
      listening: false,
      startedAt: 1000,
      frames: [],
    });
    assert.equal(stopped.listening, false);
    assert.equal(stopped.frameCount, 1);
    assert.equal(stopped.f0, 110);
  });

  it("drops the head at the cap and marks truncated — does not invent frames", () => {
    const seed = appendCanal(null, {
      listening: true,
      startedAt: 1,
      frames: [{ t: 0, rms: 0.01, zcr: 0.04, f0: null }],
    });
    const flood = Array.from({ length: MAX_FRAMES }, (_, i) => ({
      t: (i + 1) * FRAME_MS,
      rms: 0.02,
      zcr: 0.04,
      f0: null,
    }));
    const rec = appendCanal(seed, {
      listening: true,
      startedAt: 1,
      frames: flood,
    });
    assert.equal(rec.tape.length, MAX_FRAMES);
    assert.equal(rec.frameCount, MAX_FRAMES);
    assert.equal(rec.truncated, true);
    assert.notEqual(rec.tape[0]?.t, 0);
  });
});

describe("downsampleTape", () => {
  it("keeps holes — a null F0 stays null", () => {
    const tape = [
      { t: 0, rms: 0.01, zcr: 0.04, f0: 140 },
      { t: 50, rms: 0.01, zcr: 0.04, f0: null },
      { t: 100, rms: 0.01, zcr: 0.04, f0: 140 },
    ];
    const out = downsampleTape(tape, 3);
    assert.equal(out.length, 3);
    assert.equal(out[1]?.f0, null);
  });
});
