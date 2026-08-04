# ARTales icon artifact generator

This tool renders review candidates from the locked ARTales micro symbol master
without changing the application or committing binary assets. The default output
directory is `artifact-output/artales-icons/v0.1/`.

## Requirements

- Python 3.12
- CairoSVG 2.7.1
- Pillow 10.4.0

Install the pinned renderer versions and run the generator from the repository
root:

```bash
python -m pip install --disable-pip-version-check --no-cache-dir \
  "CairoSVG==2.7.1" "Pillow==10.4.0"
python tools/brand/generate-icon-artifacts/generate_icon_artifacts.py
```

For a disposable local check, select another output directory:

```bash
python tools/brand/generate-icon-artifacts/generate_icon_artifacts.py \
  --output-dir /tmp/artales-icon-artifacts
```

The generator fails if the source master or rendering dependencies are missing,
or if rendering does not produce the requested dimensions. It writes PNG and ICO
candidates, a source-SVG review copy, an artifact README, and a JSON manifest with
SHA-256 checksums. The manifest describes payload files other than itself because
a file cannot contain its own stable checksum.

The GitHub Actions workflow uploads the output for manual review only. It has no
commit, push, pull-request, `public/`, or runtime integration step. Delete locally
generated default output after testing; generated binaries must not be committed.
