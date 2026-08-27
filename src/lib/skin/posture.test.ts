import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frameFromSense, postureOf } from "./posture.ts";

describe("Skin does not invent a pose", () => {
  it("dashes when nothing is on", () => {
    assert.equal(
      postureOf({ contacting: false, motion: false, gamma: 40, accel: 0.01 }),
      null,
    );
    const frame = frameFromSense({
      at: 1,
      contacting: false,
      pressure: 0.8,
      pointerType: "touch",
      motion: false,
      beta: 20,
      gamma: 30,
      accel: 0.01,
    });
    assert.equal(frame.live, false);
    assert.equal(frame.pressure, null);
    assert.equal(frame.posture, null);
  });

  it("fit is contact, lean is tilt, sit is still motion", () => {
    assert.equal(
      postureOf({ contacting: true, motion: false, gamma: 0, accel: null }),
      "fit",
    );
    assert.equal(
      postureOf({ contacting: false, motion: true, gamma: 20, accel: 0.4 }),
      "lean",
    );
    assert.equal(
      postureOf({ contacting: false, motion: true, gamma: 2, accel: 0.04 }),
      "sit",
    );
  });
});
