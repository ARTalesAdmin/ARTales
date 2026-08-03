# Libre Baskerville Regular font source package

## Purpose

This package was created from the Libre Baskerville source files manually supplied through the
repository. It provides a verified, auditable input for deterministic generation of the ARTales
**Option A — Classic literary serif** outline wordmark candidate in a later change.

Only `LibreBaskerville-Regular.ttf` is included because Regular is the only style needed for the
selected wordmark direction. No additional weights and no variable font are part of this package.

## Package contents

- `LibreBaskerville-Regular.ttf` — the supplied Libre Baskerville Regular generation source;
- `OFL.txt` — the supplied SIL Open Font License 1.1 text;
- `README.upstream.txt` — the supplied upstream README; and
- `libre-baskerville.font-source.v0.1.json` — package status, intended use, boundaries, and
  SHA-256 verification metadata.

The exact SHA-256 values for all three supplied source files are recorded in the JSON metadata.
They allow a later generation change to confirm that it is using the reviewed inputs without
alteration.

## Boundaries and next approval gate

This is a controlled generation-source package, not a runtime webfont package. The font is not
copied to `public/`, referenced by CSS, or integrated into the website.

No wordmark outline is generated in this change. Adding the font source does not approve or
create a wordmark master, lockup candidate, or lockup master. A later, separate change must use
the verified Regular file to generate a deterministic outline candidate, record its generation
parameters, and submit the resulting geometry for human visual approval before any master can be
considered.
