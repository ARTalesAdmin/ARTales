import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FIXTURE_READING_PREFERENCES,
  normalizeFixtureReadingPreferences,
  getProfileReaderSettings,
  resolveFixtureReadingPreferences,
} from "../lib/fixtures/readerPreferences";
import { defaultReaderSettings } from "../lib/reader/readerSettings";

test("first-time user without stored Reader or profile settings sees setup once", () => {
  assert.deepEqual(normalizeFixtureReadingPreferences(null), DEFAULT_FIXTURE_READING_PREFERENCES);
  const setup = resolveFixtureReadingPreferences({});
  assert.equal(setup.needsFirstRunSetup, true);
  assert.deepEqual(setup.preferences, DEFAULT_FIXTURE_READING_PREFERENCES);
});

test("existing shared Reader preference never shows the fixture setup again", () => {
  const shared = { ...defaultReaderSettings, theme: "dark" as const, fontScale: 1.25 };
  const resolved = resolveFixtureReadingPreferences({
    sharedReaderSettings: shared,
    profileDefaults: { reader_theme: "script", reader_font_scale: 0.9 },
    savedFixtureFormat: "a4",
  });
  assert.equal(resolved.needsFirstRunSetup, false);
  assert.deepEqual(resolved.preferences, { theme: "dark", fontScale: 1.25, formatMode: "a4" });
  assert.equal(resolved.sharedReaderSettings.width, shared.width);
});

test("profile Reader preferences serve as fallback on a new device, no prompt", () => {
  const profileDefaults = {
    reader_theme: "script",
    reader_width: "wide",
    reader_density: "compact",
    reader_font_scale: 1.12,
  };
  const resolved = resolveFixtureReadingPreferences({ profileDefaults });
  assert.equal(resolved.needsFirstRunSetup, false);
  assert.deepEqual(resolved.preferences, { theme: "script", fontScale: 1.12, formatMode: "continuous" });
  assert.equal(resolved.sharedReaderSettings.width, "wide");
  assert.equal(resolved.sharedReaderSettings.density, "compact");
});

test("older confirmed fixture preferences migrate to the shared Reader base", () => {
  const resolved = resolveFixtureReadingPreferences({
    previousFixtureSettings: { confirmed: true, theme: "dark", fontScale: 1.2, formatMode: "a4" },
  });
  assert.equal(resolved.needsFirstRunSetup, false);
  assert.equal(resolved.preferences.theme, "dark");
  assert.equal(resolved.preferences.formatMode, "a4");
  assert.equal(resolved.sharedReaderSettings.layoutMode, defaultReaderSettings.layoutMode);
});

test("unconfirmed legacy state does not falsely acknowledge onboarding", () => {
  const resolved = resolveFixtureReadingPreferences({
    previousFixtureSettings: { confirmed: false, theme: "script", fontScale: 1.1, formatMode: "continuous" },
  });
  assert.equal(resolved.needsFirstRunSetup, true);
});

test("all Reader color themes and both fixture formats survive normalization", () => {
  for (const theme of ["light", "script", "dark"] as const) {
    for (const formatMode of ["a4", "continuous"] as const) {
      assert.deepEqual(normalizeFixtureReadingPreferences({ theme, formatMode, fontScale: 1.05 }),
        { theme, formatMode, fontScale: 1.05 });
    }
  }
});

test("invalid profile, broken format and oversized font cannot poison preferences", () => {
  assert.equal(getProfileReaderSettings({ reader_theme: "invalid", reader_font_scale: null }), null);
  assert.deepEqual(normalizeFixtureReadingPreferences({ theme: "cyan", formatMode: "broken", fontScale: 500 }),
    { formatMode: "continuous", theme: "light", fontScale: 1.3 });
  assert.deepEqual(normalizeFixtureReadingPreferences({ theme: "dark", fontScale: -200 }),
    { formatMode: "continuous", theme: "dark", fontScale: 0.85 });
  assert.deepEqual(normalizeFixtureReadingPreferences({ fontScale: "large" }),
    DEFAULT_FIXTURE_READING_PREFERENCES);
});
