# ARTales Reader comfort softening v0.1

## Summary and delivery metadata

Manual review of the palette mapping introduced in PR #111 found the Reader
direction acceptable, while all three themes remained slightly more visually
demanding than desired for sustained reading. This develop-only follow-up makes
a small comfort pass over reader-owned source token values. It preserves the
existing semantic alias bridge, selectors, theme identities and behavior.

- **Risk:** high, because the Reader is a critical path even though the runtime
  change is limited to CSS custom-property values.
- **Target:** develop first. Do not promote or merge to `main` automatically.
- **DB:** no.
- **Env:** no.
- **Changed files:** `components/reader/reader.css` tunes reader-owned palette
  values; this document records the decision; and
  `ARTALES_READER_PALETTE_MAPPING_PREVIEW_V0_1.md` links this follow-up.

## Manual preview feedback

- The PR #111 Reader direction is acceptable for the current preview stage.
- Light, script and dark each feel a little more intense than ideal over a long
  reading session.
- The next comparison should favor quiet paper fields, integrated controls and
  restrained accents without sacrificing prose or muted-label readability.
- The three named themes must remain visibly distinct rather than converging on
  a single neutral palette.

## Adjusted token values

Only values inside the root fallback and the light, script and dark theme token
blocks changed. No semantic alias or selected-control mapping changed.

### Root fallback and light

The root fallback continues to follow the light direction. The light theme uses
the same comfort anchors with a separately declared viewport endpoint.

| Token | PR #111 value | Comfort value |
| --- | --- | --- |
| `--reader-outer-bg` | gold radial `.18` / `.16`; `#fdf3e2 → #dbc59d` / `#e7d4a0` | muted brown-gold radial `.10` / `.09`; `#f8f0e4 → #e3d4b8` / `#e4d6b9` |
| `--reader-toolbar-bg` | warm cream `.88` / `.90` | `#f8f0e4` at `.86` |
| `--reader-toolbar-border` | gold-brown `.18` | muted brown-gold `.12` |
| toolbar text / muted | `#272827` / ink `.70` | `#30302e` / matching ink `.70` |
| control bg / border / text | near-white `.68` / `.70`; ink `.18`; `#272827` | paper `.64`; ink `.14`; `#30302e` |
| option / paper | `#fffdf7` | `#faf7ef` |
| paper text / muted | `#272827` / `#6c6258` | `#302f2c` / `#6b6259` |
| paper border / shadow | gold-brown `.24`; dark `.18` / `.16` | muted brown-gold `.16`; neutral warm `.13` |
| accent / strong / soft / bookmark | `#d19738`; `#6c4b18`; bright gold `.28`; `#d19738` | `#b8893f`; `#684c20`; muted gold `.20`; `#b8893f` |

**Rationale and expected effect:** the paper moves away from near-white glare,
while prose remains a high-contrast charcoal rather than black. Lower radial,
border, shadow and accent strength removes visual sharpness around the reading
field. The toolbar remains legible but should sit more quietly inside the warm
viewport.

### Script

| Token | PR #111 value | Comfort value |
| --- | --- | --- |
| `--reader-outer-bg` | brown radial `.20`; `#e9d8b9 → #c9a979` | muted brown radial `.12`; `#eadfc9 → #d4bc95` |
| toolbar bg / border | dark brown `.86`; cream `.22` | softer brown `#513d2d` at `.84`; cream `.16` |
| toolbar text / muted | `#fff3d4`; matching tint `.72` | `#f3e8d4`; matching tint `.72` |
| control bg / border | cream `.09` / `.30` | cream `.07` / `.22` |
| option / paper | `#432b19` / `#f4e5c8` | `#513d2d` / `#f3e8d3` |
| paper text / muted | `#24180d` / `#6f553a` | `#33281d` / `#735f4b` |
| paper border / shadow | brown `.26` / dark brown `.26` | brown `.18` / neutral brown `.20` |
| accent / strong / soft / bookmark | `#b58636`; `#4d2d0d`; gold `.32`; `#b58636` | `#a47b3f`; `#5c4022`; muted gold `.22`; `#a47b3f` |

**Rationale and expected effect:** script keeps its sepia identity, brown chrome
and parchment field, but the lighter viewport endpoint and softer toolbar make
it feel less dense. Paper ink is eased from near-black brown while retaining
comfortable prose contrast. Gold-brown detail remains identifiable without
dominating the page.

### Dark

| Token | PR #111 value | Comfort value |
| --- | --- | --- |
| `--reader-outer-bg` | gold radial `.12`; `#0f1315 → #141414` | muted gold radial `.07`; `#171817 → #1b1a18` |
| toolbar bg / border | near-black `.88`; gold `.20` | soft black-brown `.86`; muted gold `.12` |
| toolbar text / muted | `#fdf3e2`; cream `.74` | `#e5ddcf`; matching tint `.72` |
| control bg / border / text | cream `.06`; gold `.30`; `#fdf3e2` | warm text `.05`; muted gold `.20`; `#e5ddcf` |
| option / paper | `#141414` | `#1d1c1a` |
| paper text / muted | `#f7ecd8`; matching tint `.74` | `#e0d8ca`; matching tint `.72` |
| paper border / shadow | gold `.20`; black `.42` | muted gold `.12`; black `.30` |
| accent / strong / soft / bookmark | `#e0aa47`; `#dca645`; gold `.18`; `#dca645` | `#b58a4b`; `#c19a60`; muted gold `.13`; `#b58a4b` |

**Rationale and expected effect:** lifting the viewport and paper from crushing
black reduces edge contrast, while warmer, dimmer prose avoids white glare.
Muted text remains clearly separated from the paper. Lower gold saturation,
border opacity and shadow density should reduce glow and peripheral pull while
preserving progress, bookmark and selected-control recognition.

## Intentionally unchanged

- No selectors, cascade order, semantic aliases, layout, spacing, type scale or
  line height changed.
- No page, spread, scroll, pagination, parser, table or generated-header logic
  changed, including the cancelled v0.10.15k patch.
- No Reader settings behavior or persistence, focus-ring design, disabled-state
  design, preview CTA, access or entitlement behavior changed.
- No TSX, routes, i18n, shared renderer CSS, global CSS, public/gallery/detail
  styling, `WorkReaderOverlay`, assets or brand materials changed.
- No DB, environment, Supabase, package or deployment configuration changed.
- Gold remains an accent only. Body prose continues to resolve from
  `--reader-paper-text`.

## Develop preview checklist

- [ ] Read representative prose in **light** for 3–5 minutes; confirm the paper
  is warm rather than stark and prose remains easy to scan.
- [ ] Read representative prose in **script** for 3–5 minutes; confirm the sepia
  identity remains distinct without feeling heavy.
- [ ] Read representative prose in **dark** for 3–5 minutes; confirm there is no
  white glare, muddy muted text or distracting gold glow.
- [ ] Check toolbar controls in light, script and dark.
- [ ] Check progress at start, middle and end.
- [ ] Check the bookmark marker and bookmark action.
- [ ] Open and close the settings panel in every theme.
- [ ] Check the preview CTA when the available work/access state exposes it.
- [ ] Check focus mode.
- [ ] Smoke-check scroll, page and spread modes without changing their behavior.
- [ ] Quick-check 320 px and 360 px mobile widths.
- [ ] Quick-check a representative desktop width.
- [ ] Confirm body text is not gold and muted labels remain readable.

The checklist requires a deployed develop preview and representative Reader
content. Automated source validation cannot replace the timed comfort review.

## Rollback path

Revert the single comfort-softening commit or its PR to restore the exact PR
#111 palette values and remove this follow-up documentation. No migration,
configuration, package, asset or data rollback is needed. After reverting,
parse the CSS and smoke-check all three themes, selected controls, progress and
bookmarks in develop. There are no irreversible steps.
