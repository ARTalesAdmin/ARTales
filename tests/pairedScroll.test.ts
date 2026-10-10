import assert from "node:assert/strict";
import test from "node:test";
import { interpolateAnchors, alignedScrollTop } from "../lib/fixtures/pairedScroll";

test("anchors interpolate smoothly when ARTales uses more vertical space", () => {
  const source = [40, 100, 160, 220, 400];
  const artales = [60, 180, 380, 680, 1400];
  assert.equal(interpolateAnchors(source, artales, 40), 60);
  assert.equal(interpolateAnchors(source, artales, 70), 120);
  assert.equal(interpolateAnchors(source, artales, 130), 280);
  assert.equal(interpolateAnchors(source, artales, 190), 530);
  assert.equal(interpolateAnchors(source, artales, 400), 1400);
});

test("projection works in either direction and is monotonic", () => {
  const short = [0, 70, 180, 420];
  const long = [0, 230, 620, 1800];
  for (const position of [0, 5, 80, 135, 179, 250, 420]) {
    const back = interpolateAnchors(long, short, interpolateAnchors(short, long, position));
    assert.ok(Math.abs(back - position) < 0.0001);
  }
  const projected = [30, 80, 130, 180].map((top) => alignedScrollTop({
    sourceStarts: [50, 150, 300], targetStarts: [80, 290, 600],
    sourceScrollTop: top, sourceClientHeight: 140, sourceScrollHeight: 600,
    targetClientHeight: 260, targetScrollHeight: 1500,
  }));
  assert.ok(projected.every((value, index) => index === 0 || value >= projected[index - 1]));
});

test("projected scroll clamps to target scroll range, and rejects mismatched anchors", () => {
  const target = alignedScrollTop({
    sourceStarts: [30, 100, 300], targetStarts: [40, 150, 500],
    sourceScrollTop: 10000, sourceClientHeight: 200, sourceScrollHeight: 550,
    targetClientHeight: 250, targetScrollHeight: 900,
  });
  assert.ok(target >= 0 && target <= 650);
  assert.throws(() => interpolateAnchors([1, 1], [1, 2], 2));
  assert.throws(() => interpolateAnchors([1, 2], [1, 2, 3], 2));
  assert.throws(() => alignedScrollTop({
    sourceStarts: [1], targetStarts: [1, 2],
    sourceScrollTop: 0, sourceClientHeight: 100, sourceScrollHeight: 100,
    targetClientHeight: 100, targetScrollHeight: 100,
  }));
});
