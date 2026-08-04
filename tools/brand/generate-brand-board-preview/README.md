# ARTales Brand Board Preview Generator

This tool renders `brand/artales/overview/artales-brand-composite-board.v0.2.svg` into a PNG preview for human review.

The generated PNG is **artifact-only**. It must not be committed from the Codex PR flow, because binary files are not supported there.

## Default output

```text
artifact-output/artales-brand-board-preview/v0.2/artales-brand-composite-board.v0.2.png
artifact-output/artales-brand-board-preview/v0.2/README.md
artifact-output/artales-brand-board-preview/v0.2/artales-brand-board-preview-manifest.v0.2.json
```

## Local use

Install repository dependencies, then install the workflow-only `sharp` renderer without saving it to `package.json` or `package-lock.json`:

```bash
npm ci
npm install --no-save sharp@0.33.5
python tools/brand/generate-brand-board-preview/generate_brand_board_preview.py
```

The output directory is ignored by convention as generated review material. Delete it after inspection unless it is explicitly needed outside the repository. Do not commit the generated PNG or other binary preview files.

## GitHub Actions use

Run the manual workflow `ARTales Generate Brand Board Preview`. It uses `workflow_dispatch`, runs `npm ci`, installs `sharp@0.33.5` with `npm install --no-save` for artifact rendering only, renders the PNG, uploads the three files above as the `artales-brand-board-preview-v0.2` artifact, and does not commit, push, or open a PR.
