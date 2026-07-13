import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULTS_DIR = fileURLToPath(new URL("../../i18n/defaults", import.meta.url));
const EXPECTED_LOCALES = ["ar", "de", "de-AT", "en", "es", "fr", "it", "nl", "pl", "pt", "uk"];

// Matches the backend's UI-string key validation.
const KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function loadDefaults(): Map<string, Record<string, string>> {
  return new Map(
    readdirSync(DEFAULTS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => [
        f.replace(/\.json$/, ""),
        JSON.parse(readFileSync(join(DEFAULTS_DIR, f), "utf8")) as Record<string, string>,
      ]),
  );
}

describe("i18n default dictionaries", () => {
  const defaults = loadDefaults();
  const en = defaults.get("en")!;

  it("covers all supported locales", () => {
    assert.deepEqual([...defaults.keys()].sort(), [...EXPECTED_LOCALES].sort());
  });

  it("has an identical key set in every locale", () => {
    const enKeys = Object.keys(en).sort();
    for (const [locale, strings] of defaults) {
      assert.deepEqual(
        Object.keys(strings).sort(),
        enKeys,
        `key set of ${locale}.json diverges from en.json`,
      );
    }
  });

  it("uses only keys the backend accepts", () => {
    for (const key of Object.keys(en)) {
      assert.match(key, KEY_PATTERN, `invalid UI-string key: ${key}`);
    }
  });

  it("has a non-empty translation for every key", () => {
    for (const [locale, strings] of defaults) {
      for (const [key, value] of Object.entries(strings)) {
        assert.equal(typeof value, "string", `${locale}.json ${key} is not a string`);
        assert.ok(value.trim().length > 0, `${locale}.json ${key} is empty`);
      }
    }
  });
});
