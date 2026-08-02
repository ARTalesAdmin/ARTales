# ARTales standalone symbol candidate selection v0.1

## Decision boundary

This report records packaging of a deterministic trace as a **candidate for review only**.
It does not approve an ARTales master, lock an asset, create production exports, or authorize
runtime/public integration. Human visual approval remains required before any later,
separate master-lock proposal.

## Selected matrix basis

- Variant id: `smoother`
- Label: `Smoother`
- Potrace: `turdsize=2`, `alphamax=1.1`, `opttolerance=0.4`
- Fill: `#DCA645`
- Background: transparent

Human matrix review selected `smoother` because it preserved the standalone symbol's
identity, had no trace fallback or render failure, and produced the lowest thresholded
mismatch ratio among the tested deterministic variants. This was the best technical
diagnostic result in that bounded matrix, not an automatic aesthetic decision.

Mismatch measures thresholded pixels between a rendered trace and the cleaned mask. It is
renderer- and antialiasing-sensitive and **is not a perceptual quality score**. A lower
value cannot establish brand fidelity, curve quality, legibility, or approval.

## Reproducible packaging

Run:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --config tools/brand/vectorize-reference/config/artales-symbol.v0.1.json \
  --candidate-from-matrix smoother
```

The command reads `smoother` from `trace_matrix`, rebuilds the configured segmentation and
cleaned mask from the checked-in crop, runs potrace with that variant's exact options, and
writes only the candidate SVG and metadata to
`brand/artales/candidates/symbol-pen-drop/`. The package is deterministic and avoids manual
copying from a workflow artifact. Temporary processing and optional render comparison are
not committed as diagnostic output.

## Review still required

Reviewers must compare the candidate with the source crop for silhouette, negative space,
edge continuity, and retention of the pen/drop identity. Small-size behavior must also be
assessed independently. At 16 px, internal detail will likely require a separate,
purpose-built small-size/favicon variant later; this package neither creates nor approves
that variant.

Runtime integration, `public/` assets, favicons, app icons, CSS, exports, promotion, and
master locking are explicitly out of scope.
