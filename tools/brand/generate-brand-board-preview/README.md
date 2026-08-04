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

Install repository dependencies so the `sharp` renderer is available, then run:

```bash
npm ci
python tools/brand/generate-brand-board-preview/generate_brand_board_preview.py
```

The output directory is ignored by convention as generated review material. Delete it after inspection unless it is explicitly needed outside the repository.

## GitHub Actions use

Run the manual workflow `ARTales Generate Brand Board Preview`. It uses `workflow_dispatch`, renders the PNG, uploads the three files above as the `artales-brand-board-preview-v0.2` artifact, and does not commit, push, or open a PR.
