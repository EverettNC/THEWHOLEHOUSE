import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recoverMangles } from "./mangle.ts";
import { buildKeyterms, FAMILY_NAMES } from "./lexicon.ts";
import { PORCH_HONESTY_RULE } from "./types.ts";

describe("STT mangles", () => {
  it("recovers the porch clip names without touching dialect", () => {
    const raw =
      "I ain't about to sit still. I'm fixing to send this over to Alpha Vox in Broxton, courtier measures, Mike could use a mess of key terms so Inferno and Serafina don't get lost, y'all hear me?";
    const { text, corrections } = recoverMangles(raw);
    assert.match(text, /ain't/);
    assert.match(text, /y'all/);
    assert.match(text, /AlphaVox/);
    assert.match(text, /Brockston/);
    assert.match(text, /Corti/);
    assert.match(text, /might could/);
    assert.match(text, /Seraphina/);
    assert.match(text, /fixin' to/);
    assert.ok(corrections.some((c) => c.to === "Corti"));
  });

  it("keeps ten dollar. does not invent $10", () => {
    const { text } = recoverMangles("That was ten dollar, y'all.");
    assert.equal(text, "That was ten dollar, y'all.");
    assert.doesNotMatch(text, /\$/);
  });

  it("does not flip live to leave", () => {
    const { text } = recoverMangles("I live here. I lived it. Leave me be.");
    assert.match(text, /\blive\b/);
    assert.match(text, /\blived\b/);
    assert.match(text, /\bLeave\b/);
  });

  it("never writes Miss Reed", () => {
    const { text } = recoverMangles("They Miss Reed the whole damn thing.");
    assert.match(text, /misread/);
    assert.doesNotMatch(text, /Miss Reed/);
  });
});

describe("keyterms", () => {
  it("biases Corti, Brockston, live, and the four minds", () => {
    const terms = buildKeyterms().map((t) => t.toLowerCase());
    for (const need of [
      "corti",
      "brockston",
      "live",
      "misread",
      "ain't",
      "grok",
      "harper",
      "lucas",
      "benjamin",
    ]) {
      assert.ok(terms.includes(need), `missing ${need}`);
    }
    assert.ok(FAMILY_NAMES.includes("Grok"));
    assert.ok(!terms.includes("whisper"));
  });
});

describe("honesty", () => {
  it("names xAI STT, keeps the tape off this house, and never uses Whisper", () => {
    assert.match(PORCH_HONESTY_RULE, /xAI STT/);
    assert.match(PORCH_HONESTY_RULE, /does not keep the recording/);
    assert.match(PORCH_HONESTY_RULE, /Whisper is not in this body/);
  });
});
