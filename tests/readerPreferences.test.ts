import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FIXTURE_READING_PREFERENCES,
  normalizeFixtureReadingPreferences,
} from "../lib/fixtures/readerPreferences";

test("fixture starts in continuous light reading mode", () => {
  assert.deepEqual(normalizeFixtureReadingPreferences(null), DEFAULT_FIXTURE_READING_PREFERENCES);
});

test("all real Reader themes and both fixture formats normalize unchanged", () => {
  for (const theme of ["light", "script", "dark"] as const) {
    for (const formatMode of ["a4", "continuous"] as const) {
      assert.deepEqual(normalizeFixtureReadingPreferences({ theme, formatMode, fontScale: 1.05 }),
        { theme, formatMode, fontScale: 1.05 });
    }
  }
});

test("untrusted or stale preference values fall back safely and bound font scale", () => {
  assert.deepEqual(normalizeFixtureReadingPreferences({ theme: "cyan", formatMode: "broken", fontScale: 500 }),
    { formatMode: "continuous", theme: "light", fontScale: 1.3 });
  assert.deepEqual(normalizeFixtureReadingPreferences({ theme: "dark", fontScale: -200 }),
    { formatMode: "continuous", theme: "dark", fontScale: 0.85 });
  assert.deepEqual(normalizeFixtureReadingPreferences({ fontScale: "large" }),
    DEFAULT_FIXTURE_READING_PREFERENCES);
});
