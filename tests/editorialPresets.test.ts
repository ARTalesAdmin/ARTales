import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_PRESETS, getEditorialPreset, routeFixtureIssue } from "../lib/fixtures/editorialPresets";

test("editorial presets have unique stable IDs with unknown and other fallback", () => {
  assert.equal(new Set(EDITORIAL_PRESETS.map((item) => item.id)).size, EDITORIAL_PRESETS.length);
  assert.equal(getEditorialPreset("unknown").needsNote, true);
  assert.equal(getEditorialPreset("invented").id, "unknown");
  assert.equal(getEditorialPreset("page.bad_break").boundary, true);
});

test("the editor never chooses a worker: safe known recipes dispatch instantly", () => {
  assert.equal(routeFixtureIssue("type.verse_spacing", "poem"), "instant_local");
  assert.equal(routeFixtureIssue("type.paragraph_spacing", "paragraph"), "instant_local");
  assert.equal(routeFixtureIssue("type.heading_spacing", "chapter"), "instant_local");
  assert.equal(routeFixtureIssue("type.verse_spacing", "chapter"), "deferred_fixture");
  assert.equal(routeFixtureIssue("page.bad_break", "paragraph"), "deferred_fixture");
  assert.equal(routeFixtureIssue("line.wrapping", "paragraph"), "deferred_fixture");
  assert.equal(routeFixtureIssue("unknown", "paragraph"), "deferred_fixture");
  assert.equal(routeFixtureIssue("other", "poem"), "deferred_fixture");
});
