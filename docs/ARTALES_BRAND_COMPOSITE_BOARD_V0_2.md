# ARTales Brand Composite Board v0.2

## Why v0.2 exists

The v0.1 composite board established an initial review snapshot, but its SVG uses external file references. Those references are valid when the board is opened with its neighboring repository assets available, yet GitHub preview does not render them reliably. Reviewers could therefore see the board structure without the symbol, wordmark, lockups, or icons that matter most.

Version 0.2 keeps the structured SVG source and adds a deterministic, self-contained rendering path for an artifact-only PNG. The PNG is **not committed** because binary files are not supported in this Codex PR flow. Instead, the manual GitHub Actions workflow generates the PNG as a downloadable artifact; until an explicit later decision says otherwise, the committed sources are the SVG, JSON metadata, registry, docs, generator, and workflow. The SVG embeds read-only copies of the referenced asset bytes for portable rendering; it does not change the authoritative source assets. The adjacent JSON remains the metadata and SHA-256 provenance source.

## Artifacts and authority

- [`../brand/artales/overview/artales-brand-composite-board.v0.2.svg`](../brand/artales/overview/artales-brand-composite-board.v0.2.svg) — 2800 × 2000 structured documentation source with embedded display data.
- [`../brand/artales/overview/artales-brand-composite-board.v0.2.json`](../brand/artales/overview/artales-brand-composite-board.v0.2.json) — board status, guidance, paths, checksums, and provenance.
- [`../brand/artales/brand-registry.v0.1.json`](../brand/artales/brand-registry.v0.1.json) — current-state pointer for future tooling and review workflows.
- [`../tools/brand/generate-brand-board-preview/generate_brand_board_preview.py`](../tools/brand/generate-brand-board-preview/generate_brand_board_preview.py) — artifact-only PNG generator.
- [`../.github/workflows/artales-generate-brand-board-preview.yml`](../.github/workflows/artales-generate-brand-board-preview.yml) — workflow_dispatch-only artifact workflow named `ARTales Generate Brand Board Preview`.

Individual locked masters remain authoritative for geometry. Exports remain derived delivery assets. Public assets remain the files integrated with browser metadata and the web manifest. Neither a review board nor the registry replaces those authority levels.

## What v0.2 adds

Compared with v0.1, the fuller practical snapshot adds:

- a reliable workflow-generated PNG artifact showing all visual sections, approved masters, current exports, and the public icon ladder;
- the current SVG export library and clear primary-versus-fallback guidance;
- use/avoid guidance and an asset authority ladder;
- explicit runtime status for the favicon and manifest icons;
- typography and outlined-wordmark source context;
- future tokenization candidates, visibly marked **proposal only, not implemented**;
- a registry pointer that records the current develop brand state and SHA-256 provenance.

## Status and intended future use

This is a **review-only** documentation snapshot. It is suitable as a future admin brand-dashboard thumbnail or full preview, but no dashboard integration is part of this change. The registry could later provide a stable input for Syrael/Flow analysis and a human approval workflow; that workflow remains planned, not implemented.

The generated artifact PNG should be reviewed first. Use the SVG when inspecting the structured board source and the JSON when validating provenance or building later repository-aware tooling. Manual upload of a PNG can be considered later only if explicitly needed; it is intentionally not part of this PR.

## Runtime impact

None. This work does not change runtime styling, application UI, CSS variables, design tokens, metadata integration, web manifest integration, public icons, approved masters, or export assets. It does not require database or environment changes.

## Out of scope

- creating or activating design tokens;
- changing runtime styling, CSS variables, or application UI;
- changing or regenerating public/browser/PWA assets;
- changing masters or exports;
- integrating an admin dashboard;
- implementing a Syrael/Flow review workflow;
- changing database, Supabase, or environment configuration;
- production promotion.

## Review checklist

1. Run the manual workflow, download the v0.2 PNG artifact, and confirm that the palette, masters, exports, icon ladder, guidance, authority ladder, registry pointer, and proposal block are visible.
2. Compare displayed masters and exports with their recorded repository paths.
3. Validate both JSON files and verify their recorded SHA-256 values.
4. Confirm the SVG parses as XML and its native size is 2800 × 2000.
5. Confirm that v0.1 remains intact and that no runtime, public, master, or export file changed.
