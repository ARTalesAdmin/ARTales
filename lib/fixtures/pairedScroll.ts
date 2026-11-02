/**
 * Maps the visible reading position between two independently laid-out editions.
 * Corresponding block starts share a semantic anchor; interpolation preserves
 * a smooth offset inside each block even when typography expands one edition.
 *
 * Measured coordinates are DOM pixels, never guessed character/page budgets.
 */
export function interpolateAnchors(source: readonly number[], target: readonly number[], at: number): number {
  if (source.length < 2 || source.length !== target.length || !Number.isFinite(at)) {
    throw new Error("Invalid paired scroll anchors.");
  }
  for (let i = 0; i < source.length; i++) {
    if (!Number.isFinite(source[i]) || !Number.isFinite(target[i]) ||
      (i > 0 && (source[i] <= source[i - 1] || target[i] < target[i - 1]))) {
      throw new Error("Non-monotonic paired scroll anchors.");
    }
  }
  if (at <= source[0]) return target[0];
  if (at >= source[source.length - 1]) return target[target.length - 1];
  for (let i = 1; i < source.length; i++) {
    if (at <= source[i]) {
      const fraction = (at - source[i - 1]) / (source[i] - source[i - 1]);
      return target[i - 1] + fraction * (target[i] - target[i - 1]);
    }
  }
  return target[target.length - 1];
}

export function alignedScrollTop(args: {
  sourceStarts: readonly number[];
  targetStarts: readonly number[];
  sourceScrollTop: number;
  sourceClientHeight: number;
  sourceScrollHeight: number;
  targetClientHeight: number;
  targetScrollHeight: number;
}): number {
  const { sourceStarts, targetStarts, sourceScrollTop, sourceClientHeight,
    sourceScrollHeight, targetClientHeight, targetScrollHeight } = args;
  if (sourceStarts.length !== targetStarts.length || !sourceStarts.length ||
      sourceClientHeight <= 0 || targetClientHeight <= 0 ||
      sourceScrollHeight < sourceClientHeight || targetScrollHeight < targetClientHeight) {
    throw new Error("Invalid paired scroll geometry.");
  }
  const sourceFocus = Math.min(sourceScrollHeight,
    Math.max(0, sourceScrollTop + sourceClientHeight * 0.22));
  const source = [...sourceStarts, sourceScrollHeight];
  const target = [...targetStarts, targetScrollHeight];
  const mapped = interpolateAnchors(source, target, sourceFocus);
  return Math.max(0, Math.min(targetScrollHeight - targetClientHeight,
    mapped - targetClientHeight * 0.22));
}
