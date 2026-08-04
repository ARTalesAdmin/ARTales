# ARTales composite brand boards

## Snapshots

- **v0.1** is the initial 2400 × 1600 snapshot of the documented palette, locked masters, and public icon ladder. Its externally referenced assets may not appear reliably in GitHub's SVG preview.
- **v0.2** is the fuller practical overview. It adds the current export library, usage guidance, runtime status, asset authority, proposal-only tokenization candidates, and a current-state registry pointer.

The v0.2 SVG board was visually accepted by the project owner on 2026-08-04 as the current ARTales develop brand snapshot. The PNG preview workflow remains available for future artifact-only review, but a PNG artifact was not required for this checkpoint. The adjacent v0.2 SVG is the structured documentation source, while the v0.2 JSON records metadata, provenance, and human review status.

The repository registry at [`../brand-registry.v0.1.json`](../brand-registry.v0.1.json) points future admin dashboard, Syrael/Flow review, and analysis tooling to the current develop snapshot, approved masters, exports, and runtime icon set. It is a pointer only and is not integrated into runtime code.

## Authority and limitations

- Review boards are documentation snapshots for human review. They are **not token sources**, runtime sources of truth, or final brand manuals.
- Individual locked masters remain authoritative for geometry and intended use.
- Exports are derived delivery assets; public assets are integrated browser/PWA files.
- Colors and future token names shown here are documented values or proposals, not active CSS variables or design tokens.
- v0.2 does not change masters, exports, public files, runtime styling, or UI.

## Files

- `artales-brand-composite-board.v0.1.svg` — initial structured review board.
- `artales-brand-composite-board.v0.1.json` — v0.1 metadata and provenance.
- `artales-brand-composite-board.v0.2.svg` — self-contained 2800 × 2000 structured board source.
- `artales-brand-composite-board.v0.2.json` — v0.2 metadata, guidance, artifact-only PNG status, and SHA-256 provenance.
- `../../../tools/brand/generate-brand-board-preview/` — local/manual preview generator for the artifact-only PNG.
- `../../../.github/workflows/artales-generate-brand-board-preview.yml` — workflow_dispatch-only preview artifact workflow.
- `../brand-registry.v0.1.json` — machine-readable current-state pointer.

## v0.2 review checklist

1. Run the manual preview workflow, download the artifact-only PNG, and open it at fit-to-window and 100% zoom.
2. Confirm all nine palette values and three contrast examples.
3. Confirm the five masters, seven SVG exports, and 16/32/48/180/192/512 icon ladder render.
4. Review the use/avoid notes, authority ladder, and proposal-only token candidates.
5. Use the metadata JSON and registry for paths and checksums; do not edit a master or runtime asset during board review.
