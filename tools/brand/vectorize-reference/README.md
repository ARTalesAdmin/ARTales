# Deterministic reference vectorization helper

This local tool turns an approved raster reference into reproducible review artifacts. It is a deterministic image-processing helper, **not an AI drawing tool**. It does not redraw, approve, replace, or promote an ARTales logo.

## Requirements

- Python 3.9 or newer.
- [Pillow](https://pillow.readthedocs.io/) for mask and overlay generation.
- Optional: the `potrace` executable on `PATH` for an SVG trace candidate.

No dependency is added to the application by this scaffold. If Pillow is unavailable, install it in an isolated local environment, for example:

```bash
python -m venv .venv-vectorize
. .venv-vectorize/bin/activate
python -m pip install Pillow
```

Without Pillow, config-only validation still works and generation exits with a clear message. Without `potrace`, masks, the overlay, and the JSON report are still produced; the report records that tracing was skipped.

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

## Inputs and configuration

The checked-in configs point only to existing extracted reference crops. Each config fixes:

- the reference role and input path;
- segmentation mode, sampled color, and RGB-distance tolerance;
- morphological opening and closing radii;
- output directory and filenames;
- an explicit, unapproved review state.

`background_distance` treats pixels farther than the configured distance from the background sample as foreground. `target_color_distance` selects pixels close to the configured target color. RGB values and tolerances are evidence-based working parameters, not approved brand tokens.

## Generated outputs

A normal run creates a config-specific directory below `tools/brand/vectorize-reference/output/` containing:

1. a binary segmentation mask;
2. a cleaned binary mask;
3. an SVG trace candidate when `potrace` is available;
4. a red mask-on-source overlay;
5. a JSON diagnostic report with dimensions, pixel counts, ratios, paths, and trace status.

The output directory is intentionally ignored except for its `.gitkeep`. Generated files are local diagnostics, are not brand masters, and must not be treated as approved.

## Known limitations

- RGB-distance segmentation does not infer object meaning and can retain compression noise or omit antialiased edge pixels.
- Morphological cleanup can remove fine detail or alter boundaries; the overlay must be reviewed at useful zoom levels.
- The overlay compares the cleaned mask to the raster source. It is not a perceptual quality score.
- `potrace` availability and version are external to the repository. Its SVG output is only a candidate.
- The current metrics measure coverage and cleanup changes; they do not establish brand fidelity or approval.

## Future Brand Lab integration

A future Brand Lab / Asset Lab service can call this CLI as a sandboxed worker: write a reviewed config, invoke the process, parse the JSON report, and display the source, masks, overlay, and optional trace. A UI must preserve the same review boundary: execution creates candidates only; a human approval and a separate pull request are required before any later promotion. The CLI must not be run inside the public application request path.
