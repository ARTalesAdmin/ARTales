# ARTales icon artifact workflow v0.1

## Purpose

`ARTales Generate Icon Artifacts` is a manually dispatched GitHub Actions
workflow for producing favicon and app-icon candidates. It keeps binary review
outputs separate from the repository and does not change runtime behavior.

## Source master

Every icon is rendered as-is from the approved, locked micro symbol master:

`brand/artales/masters/micro-symbol/artales-micro-symbol.master.v1.svg`

The micro master is the approved source for tiny icon contexts. The generator
copies it into the artifact for visual provenance and records its SHA-256 digest
in the manifest. It does not invent or modify icon artwork.

## Generated artifact files

The artifact `artales-icon-artifacts-v0.1` contains:

- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`
- `favicon.ico` (16, 32, and 48 pixel entries)
- `apple-touch-icon-180x180.png`
- `app-icon-192x192.png`
- `app-icon-512x512.png`
- `artales-icons-manifest.v0.1.json`
- `README.md`
- `artales-micro-symbol.source.svg`

The manifest records source and payload SHA-256 values, dimensions, generation
time, workflow identity, and explicit no-runtime/no-database/no-environment flags.

## Why artifact-only

Binary output is less reviewable than its SVG source and should be visually
checked at every target size before public use. The workflow therefore has
read-only repository permission, uploads only a downloadable Actions artifact,
and contains no commit, push, pull-request, or deployment step. No generated
binary belongs in this change.

## Manual follow-up process

1. Run **ARTales Generate Icon Artifacts** manually in GitHub Actions.
2. Download `artales-icon-artifacts-v0.1` from the completed run.
3. Visually review every icon, including the smallest favicon sizes and ICO entries.
4. Manually upload only approved binaries in a new branch and pull request.
5. Integrate files into `public/`, metadata, manifests, or runtime only after
   separate explicit approval.

## Limitations

- CairoSVG and Pillow are pinned to make the Actions renderer controlled, but a
  later intentional dependency update can change raster bytes and checksums.
- The workflow produces square canvases from a tall symbol view box. Reviewers
  must confirm the resulting scale and whitespace are suitable before approval.
- Generation is not visual approval and does not make any candidate production-ready.
- The Actions artifact is retained for 30 days.

## Out of scope

- Committing PNG or ICO files.
- Changes under `public/` or integration with application runtime, metadata, or manifests.
- Changes to components, styles, database, environment variables, or Supabase.
- Deployment, production promotion, or changes to `main`.
- Reader, editor, parser, tables, or pagination work, including patch v0.10.15k.
