# ARTales icon artifact generator

This directory contains the deterministic, manual-only generator used by the
ARTales icon artifact workflow. It reads the locked micro-symbol SVG and writes
reviewable PNG and ICO files to an ignored output directory. Generated files
are downloadable GitHub Action artifacts; the tool does not publish or install
them in `public/` or in the application.

## Run locally

Python 3.12 and the `CairoSVG` and `Pillow` packages are required.

```bash
python -m pip install CairoSVG Pillow
python tools/brand/generate-icon-artifacts/generate_icon_artifacts.py
```

To keep local output outside the repository, pass `--output-dir`:

```bash
python tools/brand/generate-icon-artifacts/generate_icon_artifacts.py \
  --output-dir /tmp/artales-icon-artifacts
```

The output contains transparent square PNG previews at 16, 32, 48, 180, 192,
and 512 pixels, a multi-resolution ICO file, and `manifest.json` with source
and output SHA-256 checksums. Output files are review artifacts, not approved
production icons.
