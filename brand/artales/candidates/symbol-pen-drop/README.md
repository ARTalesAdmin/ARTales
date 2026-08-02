# ARTales symbol pen/drop candidates

This folder contains **candidate-only** standalone symbol assets prepared for human visual
review. Nothing here is a locked or approved master, and presence here does not imply any
runtime or `public/` integration.

## Current review state

`symbol-pen-drop.smoother.candidate.v0.1` is an unapproved deterministic regeneration of
the `smoother` trace-matrix variant. Its metadata state is
`awaiting_human_visual_review`. The SVG and JSON are review evidence, not production
exports or brand approval.

## Next steps

1. Review silhouette, negative space, curve continuity, and identity against the source.
2. Inspect behavior at 128, 64, 32, and 16 px. A separate small-size/favicon variant will
   likely be needed later; this candidate does not approve one.
3. Record an explicit human decision before proposing any master preparation or lock in a
   separate, controlled change.
4. Treat export generation and runtime/public integration as separate out-of-scope work.

Regenerate the package from the repository root with:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --config tools/brand/vectorize-reference/config/artales-symbol.v0.1.json \
  --candidate-from-matrix smoother
```
