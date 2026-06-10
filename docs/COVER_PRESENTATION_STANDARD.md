# ARTales cover presentation standard

Status: v0.10.4a foundation.

## Canonical web cover ratio

ARTales web/book covers use a canonical **2:3** ratio.

Recommended master size for generated covers:

- `1600 × 2400 px`

Minimum practical web export:

- `1000 × 1500 px`

## UI rule

The app should present work covers with the same 2:3 ratio in:

- gallery cards,
- work detail,
- account/library cards,
- future reader/PDF contexts where a front cover is shown.

The UI should not ask the cover generator to compensate for inconsistent crops. The presentation layer is responsible for a stable 2:3 frame.

## Safe zones for generated covers

Keep important elements inside safe zones:

- top: about 8–10%,
- bottom: about 10–12%,
- left/right: about 7–8%.

Title, author and ARTales branding should not sit too close to the edge.

## Current cover model

For now, each work has one primary public cover.

Future extension may support cover variants, but this is intentionally deferred:

- `web_primary`,
- `web_alternate_light`,
- `web_alternate_dark`,
- `print_front`,
- `print_full_wrap`,
- `special_edition`.

User-facing cover switching should not be implemented until the product/editorial meaning of cover variants is clear.

## Storage cleanup note

Current upload path for future work covers is stable by file type:

- `works/{work_slug}/cover/cover.jpg`
- `works/{work_slug}/cover/cover.png`
- `works/{work_slug}/cover/cover.webp`

This reduces duplicate storage objects for repeated uploads of the same format.

The editor also performs best-effort cleanup of cover files uploaded and then replaced/removed within the same editing session. It does not automatically delete older already-saved cover files from previous sessions, because doing so before the work record is saved could break the public cover reference.

A later media maintenance/admin patch can add safe cleanup of historical orphaned cover files.
