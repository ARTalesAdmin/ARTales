# Deterministic reference vectorization helper

This local tool turns an approved raster reference into reproducible review artifacts. It is a deterministic image-processing helper, **not an AI drawing tool**. It does not redraw, approve, replace, or promote an ARTales logo.

## Requirements

- Python 3.9 or newer.
- [Pillow](https://pillow.readthedocs.io/) for mask and overlay generation.
- Optional: the `potrace` executable on `PATH` for an SVG trace candidate.
- Optional: CairoSVG, `rsvg-convert`, or ImageMagick for rasterizing that candidate on the review board.

No dependency is added to the application by this scaffold. If Pillow is unavailable, install it in an isolated local environment, for example:

```bash
python -m venv .venv-vectorize
. .venv-vectorize/bin/activate
python -m pip install Pillow
```

Without Pillow, config-only validation still works and generation exits with a clear message. Without `potrace`, masks, the overlay, review board, and JSON report are still produced; the board and report record that tracing was skipped. A missing SVG renderer is also non-fatal: the board retains its source and mask panels and clearly labels the trace fallback.

## Run the tool

From the repository root:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --config tools/brand/vectorize-reference/config/artales-symbol.v0.1.json
```

Validate a config and its input without generating artifacts:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --config tools/brand/vectorize-reference/config/artales-symbol.v0.1.json \
  --validate-config
```

The other supplied configs cover the light and dark lockups. Repository-relative input and output paths are resolved from the repository root, so execution does not depend on the caller's working directory.

### Compare symbol trace parameters

The standalone symbol config also contains a bounded, named `trace_matrix`. Run all of
its variants with:

```bash
python tools/brand/vectorize-reference/vectorize_reference.py \
  --config tools/brand/vectorize-reference/config/artales-symbol.v0.1.json \
  --matrix
```

Matrix mode first produces the same base mask diagnostics as a single run, then traces the
identical cleaned mask with the `current`, `smoother`, `cleaner`, and `stricter` potrace
settings. Each variant is written below `matrix/<variant-id>/` with its SVG, optional
render, metrics, and optional 128, 64, 32, and 16 px previews. The output root also receives
`symbol-trace-matrix-report.json` and `symbol-trace-matrix-board.png`, which compare SVG
structure, render availability, thresholded mask mismatch, fallbacks, and small-size views.

Variant ids are restricted to safe lowercase filenames, and every potrace value uses the
same bounds as single mode. A config without `trace_matrix` fails clearly when `--matrix`
is requested. Renderer absence remains non-fatal and is shown on the board and in reports.
These controlled parameter changes are deterministic diagnostics intended to support human
comparison without manual or generative redraw drift. The matrix does not select, approve,
lock, or promote a variant, candidate, or master; mismatch is not a perceptual quality score.

## Run through GitHub Actions

Open **Actions → ARTales reference vectorization diagnostics → Run workflow**, choose one of the supplied configs, and start the manual run. After it completes, download the config-named artifact from the run's **Artifacts** section; it contains the generated diagnostics from `tools/brand/vectorize-reference/output/`.

Workflow artifacts are diagnostics only, not approved brand masters. Integrating them into runtime or public assets remains out of scope and requires a separate review and change.

## Inputs and configuration

The checked-in configs point only to existing extracted reference crops. Each config fixes:

- the reference role and input path;
- segmentation mode, sampled color, and RGB-distance tolerance;
- morphological opening and closing radii;
- foreground trace mode, single fill color, and transparent background;
- output directory and filenames;
- an explicit, unapproved review state.

`background_distance` treats pixels farther than the configured distance from the background sample as foreground. `target_color_distance` selects pixels close to the configured target color. RGB values and tolerances are evidence-based working parameters, not approved brand tokens.

The cleaned mask represents selected foreground as white. Because `potrace` traces black
pixels, the tool deterministically inverts only its temporary PBM input: selected artwork
becomes black for tracing and the background becomes white. The emitted SVG therefore
contains the positive foreground artwork with the configured fill and no background shape;
SVG transparency is preserved by omitting a background element.

The lockup configs produce a single-color, mask-level diagnostic trace. They do not recover
or approve the lockups' multiple source colors. Every generated SVG remains a diagnostic
candidate, not an approved master.

### Potrace tuning

The optional `trace.potrace` object supports only three bounded CLI parameters:

- `turdsize` (integer, 0–100) removes pixel specks up to the configured area;
- `alphamax` (number, 0.0–1.333) controls corner smoothing; and
- `opttolerance` (number, 0.0–10.0) controls curve optimization tolerance.

The supplied configs use the conservative starting values `2`, `1.0`, and `0.2`. Lockup
values remain diagnostic defaults rather than wordmark optimization. The tool passes a
configured value to potrace using its matching long CLI option and records options as used
only after potrace succeeds. An older or incompatible potrace fails the trace step with its
CLI error in the report instead of silently ignoring an option. Changing these parameters
creates a reproducible diagnostic run, not a brand decision or a manually refined candidate.
The same validation applies independently to every `trace_matrix[].potrace` object.

## Generated outputs

A normal run creates a config-specific directory below `tools/brand/vectorize-reference/output/` containing:

1. a binary segmentation mask;
2. a cleaned binary mask;
3. an SVG trace candidate when `potrace` is available;
4. a red mask-on-source overlay;
5. a labelled PNG review board; and
6. a JSON diagnostic report with dimensions, pixel counts, ratios, paths, trace status,
   foreground-polarity metadata, review-board capabilities, preview sizes, and fallbacks.

The report's `trace_svg_analysis` object records file presence and size, path count, root
dimensions/viewBox, fill values, and detectable image, text, or rectangle elements. XML
parse failures are reported without aborting the rest of the run. `trace_comparison` records
the thresholded trace-render versus cleaned-mask mismatch pixels and ratio when rendering
is available, or an explicit reason when it is not. `small_size_diagnostics` records the
preview sizes and a non-binding detail warning. These fields support comparisons between
parameterized runs; mismatch is sensitive to renderer and antialiasing behavior and is not
a perceptual logo-quality score or approval threshold.

The review board places the source crop, raw mask, cleaned mask, and mask overlay side by
side. When an SVG renderer is available it also shows the trace, a translucent
source/trace comparison, and a thresholded mismatch view (red means expected mask pixels
missing from the trace; blue means additional traced pixels). That mismatch is sensitive
to rasterization and antialiasing and is a visual aid, not a perceptual score. The final row
shows 128, 64, 32, and 16 px previews using the trace when it can be rendered, or a clearly
labelled cleaned-mask fallback otherwise. Reviewers should inspect silhouette, negative
space, edge changes, and survival of internal detail rather than treating any panel as an
automatic pass/fail decision.

The output directory is intentionally ignored except for its `.gitkeep`. Generated files,
including review boards, matrix outputs, reports, previews, and SVG traces, are local diagnostics and unapproved artifacts.
The board neither approves nor promotes a candidate as a brand master.

## Known limitations

- RGB-distance segmentation does not infer object meaning and can retain compression noise or omit antialiased edge pixels.
- Morphological cleanup can remove fine detail or alter boundaries; the overlay must be reviewed at useful zoom levels.
- The overlay compares the cleaned mask to the raster source. It is not a perceptual quality score.
- `potrace` availability and version are external to the repository. Its SVG output is only a candidate.
- The metrics measure coverage, cleanup changes, SVG structure, and render/mask mismatch; they do not establish brand fidelity or approval.

Final refinement and master creation remain separate, human-reviewed work. They must not be
replaced by agent redraw, generative reconstruction, or an automatic metric threshold.

## Future Brand Lab integration

A future Brand Lab / Asset Lab service can call this CLI as a sandboxed worker: write a reviewed config, invoke the process, parse the JSON report, and display the source, masks, overlay, and optional trace. A UI must preserve the same review boundary: execution creates candidates only; a human approval and a separate pull request are required before any later promotion. The CLI must not be run inside the public application request path.
