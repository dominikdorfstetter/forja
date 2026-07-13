import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readI18n, withStatus } from "../client-i18n.ts";

const FALLBACKS = { submit: "Submit", failed: "Failed (status {status})." };

describe("readI18n", () => {
  it("overlays fallbacks with the server-rendered values", () => {
    const result = readI18n(JSON.stringify({ submit: "Absenden" }), FALLBACKS);
    assert.deepEqual(result, { submit: "Absenden", failed: "Failed (status {status})." });
  });

  it("returns the fallbacks when the attribute is missing", () => {
    assert.deepEqual(readI18n(undefined, FALLBACKS), FALLBACKS);
  });

  it("returns the fallbacks when the attribute is malformed", () => {
    assert.deepEqual(readI18n("{not json", FALLBACKS), FALLBACKS);
  });
});

describe("withStatus", () => {
  it("fills the {status} placeholder", () => {
    assert.equal(withStatus("Failed (status {status}).", 429), "Failed (status 429).");
  });

  it("leaves templates without a placeholder untouched", () => {
    assert.equal(withStatus("Network error.", 500), "Network error.");
  });
});
