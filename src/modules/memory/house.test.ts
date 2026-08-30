import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ambientCount,
  bodyFromSkin,
  describeHouse,
  earFromFrame,
  eyeFromLive,
  mergeHouse,
  noseFromReading,
  notePartial,
  parsePartial,
  wholeEnvironment,
} from "./house.ts";

describe("fifth stream completeness", () => {
  it("needs place plus two unattended ambient features", () => {
    assert.equal(
      wholeEnvironment({
        sight: true,
        sound: false,
        smell: false,
        body: false,
        place: true,
        time: true,
      }),
      false,
    );
    assert.equal(
      wholeEnvironment({
        sight: true,
        sound: true,
        smell: false,
        body: false,
        place: true,
        time: true,
      }),
      true,
    );
    assert.equal(
      wholeEnvironment({
        sight: true,
        sound: true,
        smell: false,
        body: false,
        place: false,
        time: true,
      }),
      false,
    );
  });

  it("does not count time as ambient", () => {
    assert.equal(
      ambientCount({
        sight: false,
        sound: false,
        smell: false,
        body: false,
        place: true,
        time: true,
      }),
      0,
    );
  });
});

describe("CORTI ear", () => {
  it("never invents a pitch lock", () => {
    const silent = earFromFrame({
      listening: true,
      rms: 0.002,
      zcr: 0.1,
      f0: null,
    });
    assert.equal(silent.locked, false);
    assert.equal(silent.f0, null);

    const guessed = earFromFrame({
      listening: true,
      rms: 0.02,
      zcr: 0.1,
      f0: 150,
    });
    assert.equal(guessed.locked, true);
    assert.equal(guessed.f0, 150);

    const off = earFromFrame({
      listening: false,
      rms: 0.02,
      zcr: 0.1,
      f0: 150,
    });
    assert.equal(off.locked, false);
    assert.equal(off.f0, null);
  });
});

describe("LUCENT eye", () => {
  it("a stock world is not seeing the house", () => {
    const demo = eyeFromLive({
      status: "idle",
      kind: "world",
      transmission: 0.94,
      defocusD: 0,
    });
    assert.equal(demo.seeing, false);
    assert.equal(demo.kind, null);
  });

  it("live camera is sight of the house", () => {
    const live = eyeFromLive({
      status: "live",
      kind: "camera",
      transmission: 0.9,
      defocusD: 0.1,
    });
    assert.equal(live.seeing, true);
    assert.equal(live.kind, "camera");
    assert.equal(live.focused, true);
  });
});

describe("OpenSmell nose", () => {
  it("sample air is not the house", () => {
    const sample = noseFromReading({
      sniffing: true,
      kind: "sample",
      intensity: 0.4,
      baseline: 0.1,
    });
    assert.equal(sample.live, false);
    assert.equal(sample.kind, "sample");
  });

  it("file is a record, not living air", () => {
    const file = noseFromReading({
      sniffing: true,
      kind: "file",
      intensity: 0.7,
      baseline: 0.2,
    });
    assert.equal(file.live, false);
  });

  it("serial sniffing is live house smell", () => {
    const live = noseFromReading({
      sniffing: true,
      kind: "serial",
      intensity: 0.33,
      baseline: 0.12,
    });
    assert.equal(live.live, true);
    assert.ok(live.delta != null && live.delta > 0);
  });

  it("a closed nose does not keep a voltage", () => {
    const closed = noseFromReading({
      sniffing: false,
      kind: "serial",
      intensity: 0.9,
      baseline: 0.1,
    });
    assert.equal(closed.live, false);
    assert.equal(closed.intensity, null);
    assert.equal(closed.kind, null);
  });
});

describe("Skin body", () => {
  it("does not invent a pose when off", () => {
    const off = bodyFromSkin({
      contacting: false,
      motion: false,
      pressure: 0.9,
      beta: 20,
      gamma: 30,
      accel: 0.01,
    });
    assert.equal(off.live, false);
    assert.equal(off.posture, null);
    assert.equal(off.pressure, null);
  });

  it("contact is fit, tilt is lean", () => {
    const fit = bodyFromSkin({
      contacting: true,
      motion: false,
      pressure: 0.6,
      beta: null,
      gamma: null,
      accel: null,
    });
    assert.equal(fit.live, true);
    assert.equal(fit.posture, "fit");
    const lean = bodyFromSkin({
      contacting: false,
      motion: true,
      pressure: null,
      beta: 10,
      gamma: 25,
      accel: 0.4,
    });
    assert.equal(lean.posture, "lean");
  });
});

describe("house merge", () => {
  it("Corti alone is not whole-environment", () => {
    const tick = mergeHouse(
      earFromFrame({ listening: true, rms: 0.02, zcr: 0.12, f0: null }),
      null,
      null,
      null,
      1,
    );
    assert.equal(tick.completeness.place, true);
    assert.equal(tick.completeness.sound, true);
    assert.equal(tick.completeness.sight, false);
    assert.equal(tick.completeness.smell, false);
    assert.equal(tick.completeness.body, false);
    assert.equal(tick.wholeEnvironment, false);
    assert.match(tick.text, /No pitch lock/);
  });

  it("Corti plus Lucent is whole-environment", () => {
    const tick = mergeHouse(
      earFromFrame({ listening: true, rms: 0.02, zcr: 0.12, f0: null }),
      eyeFromLive({
        status: "live",
        kind: "camera",
        transmission: 0.9,
        defocusD: 0.2,
      }),
      null,
      null,
      2,
    );
    assert.equal(tick.wholeEnvironment, true);
    assert.equal(tick.completeness.sight, true);
    assert.equal(tick.completeness.sound, true);
  });

  it("OpenSmell sample does not fill smell", () => {
    const tick = mergeHouse(
      null,
      null,
      noseFromReading({
        sniffing: true,
        kind: "sample",
        intensity: 0.5,
        baseline: 0.1,
      }),
      null,
      3,
    );
    assert.equal(tick.completeness.smell, false);
    assert.match(tick.text, /Sample air/);
  });

  it("Skin contact plus OpenSmell serial is whole-environment", () => {
    const tick = mergeHouse(
      null,
      null,
      noseFromReading({
        sniffing: true,
        kind: "serial",
        intensity: 0.4,
        baseline: 0.1,
      }),
      bodyFromSkin({
        contacting: true,
        motion: false,
        pressure: 0.5,
        beta: null,
        gamma: null,
        accel: null,
      }),
      4,
    );
    assert.equal(tick.completeness.smell, true);
    assert.equal(tick.completeness.body, true);
    assert.equal(tick.wholeEnvironment, true);
  });

  it("notePartial keeps all four organs", () => {
    notePartial({
      source: "corti",
      t: 10,
      corti: earFromFrame({ listening: true, rms: 0.03, zcr: 0.1, f0: null }),
    });
    notePartial({
      source: "lucent",
      t: 11,
      lucent: eyeFromLive({
        status: "live",
        kind: "camera",
        transmission: 0.8,
        defocusD: 1,
      }),
    });
    notePartial({
      source: "opensmell",
      t: 12,
      smell: noseFromReading({
        sniffing: true,
        kind: "serial",
        intensity: 0.3,
        baseline: 0.1,
      }),
    });
    const merged = notePartial({
      source: "skin",
      t: 13,
      skin: bodyFromSkin({
        contacting: true,
        motion: false,
        pressure: 0.4,
        beta: null,
        gamma: null,
        accel: null,
      }),
    });
    assert.equal(merged.corti?.listening, true);
    assert.equal(merged.lucent?.seeing, true);
    assert.equal(merged.smell?.live, true);
    assert.equal(merged.skin?.live, true);
    assert.equal(merged.wholeEnvironment, true);
  });

  it("rejects junk on the wire", () => {
    assert.equal(parsePartial(null), null);
    assert.equal(parsePartial({ source: "fusion", t: 1 }), null);
  });

  it("does not claim a note when the ear is quiet", () => {
    const text = describeHouse(
      earFromFrame({ listening: true, rms: 0.001, zcr: 0, f0: null }),
      eyeFromLive({
        status: "denied",
        kind: "camera",
        transmission: 0,
        defocusD: 0,
      }),
    );
    assert.doesNotMatch(text, /150/);
    assert.match(text, /Corti open. Quiet./);
    assert.match(text, /Eye not seeing/);
  });
});

describe("Porch in the building", () => {
  it("lands words without inventing a pitch", () => {
    const tick = notePartial({
      source: "porch",
      t: 9,
      porch: {
        speaking: true,
        asSaid: "I ain't leaving. I live here.",
        at: 9,
      },
    });
    assert.equal(tick.porch?.asSaid, "I ain't leaving. I live here.");
    assert.equal(tick.completeness.sound, true);
    assert.match(tick.text, /Porch: I ain't leaving/);
  });
});
