import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, isScalarOnly } from "./classify.ts";
import { LIVE_PROFILES, LIVE_PROFILE_COUNT } from "./profiles.ts";

describe("OpenSmell claim lock", () => {
  it("live inventory is 21", () => {
    assert.equal(LIVE_PROFILES.length, LIVE_PROFILE_COUNT);
    assert.equal(LIVE_PROFILE_COUNT, 21);
  });

  it("does not invent twenty species from a scalar", () => {
    assert.equal(isScalarOnly(null), true);
    assert.equal(isScalarOnly({}), true);
    assert.deepEqual(classify(null), []);
    assert.deepEqual(classify({}), []);
  });

  it("scores a labeled simulation, never as diagnosis", () => {
    const hits = classify({
      acetone: 0.9,
      isoprene: 0.85,
      ammonia: 0.1,
    });
    assert.ok(hits.length >= 1);
    const rage = hits.find((h) => h.profileKey === "rage_cortisol");
    assert.ok(rage);
    assert.equal(typeof rage!.confidence, "number");
    assert.ok(rage!.confidence > 0);
  });

  it("does not name a profile from noise under threshold", () => {
    const hits = classify({
      acetone: 0.05,
      isoprene: 0.04,
      ammonia: 0.02,
    });
    assert.equal(hits.length, 0);
  });
});
