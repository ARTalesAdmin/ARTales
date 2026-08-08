# ARTales Reader palette mapping preview v0.1

## Summary and delivery metadata

This is the first intentional visual change to the dedicated ARTales Reader.
It conservatively maps reader-owned source tokens, reached through the semantic
alias layer from the previous passes, toward the approved ARTales identity.
The change is a **develop-only preview** and must not be promoted to `main`
automatically.

- **Risk:** high, because the reader is a critical path even though this change
  is limited to CSS custom-property values.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.
- **Changed files:** `components/reader/reader.css` changes only reader-owned
  token values and token-block comments; the three reader token documents
  record the follow-up and preview contract.

PRs #107, #108, #109 and #110 established the visual audit, proposed the
reader-owned semantic model, added value-preserving aliases, and moved a safe
selector subset onto those aliases. This preview changes the source values
behind that existing bridge. It does not remove legacy `--reader-*` variables,
change alias direction, or broaden selector consumption.

## Old and new token values

The root fallback follows the light reading direction so an unthemed or initial
reader render remains coherent. Theme classes remain explicit and independent.
Values not listed here are unchanged.

### Root fallback

| Reader-owned token | Old | New |
| --- | --- | --- |
| viewport radial / linear | `rgba(217, 183, 110, .22)`; `#f4ead7 → #dbc59d` | `rgba(224, 170, 71, .18)`; `#fdf3e2 → #dbc59d` |
| toolbar bg / border | `rgba(255, 250, 240, .86)` / `rgba(13, 21, 40, .12)` | `rgba(253, 243, 226, .88)` / `rgba(181, 134, 54, .18)` |
| toolbar text / muted | `#071226` / `rgba(13, 21, 40, .66)` | `#272827` / `rgba(39, 40, 39, .70)` |
| control bg / border / text | white `.62` / navy `.16` / `#071226` | `#fffdf7` `.68` / ink `.18` / `#272827` |
| option / paper / paper text | `#fffaf0` / `#fffaf0` / `#17130f` | `#fffdf7` / `#fffdf7` / `#272827` |
| paper border | brown-gold `.22` | `#b58636` at `.24` |
| accent / soft / bookmark | `#987331` / `#ead39b` / `#9c6a2d` | `#d19738` / `#e0aa47` at `.28` / `#d19738` |

### Reader light

| Reader-owned token | Old | New |
| --- | --- | --- |
| viewport radial / linear | `rgba(217, 183, 110, .18)`; `#f7f1e6 → #e7d4a0` | `rgba(224, 170, 71, .16)`; `#fdf3e2 → #e7d4a0` |
| toolbar bg / border | `rgba(255, 250, 240, .90)` / navy `.12` | `rgba(253, 243, 226, .90)` / `#b58636` at `.18` |
| toolbar text / muted | `#071226` / navy `.66` | `#272827` / ink `.70` |
| control bg / border / text | white `.64` / navy `.16` / `#071226` | `#fffdf7` `.70` / ink `.18` / `#272827` |
| native option | `#fffaf0` | `#fffdf7` |
| paper text / border / shadow ink | `#17130f` / brown-gold `.22` / brown-black `.16` | `#272827` / `#b58636` at `.24` / literary ink `.16` |
| accent / soft / bookmark | `#987331` / `#ead39b` / `#a56d24` | `#d19738` / `#e0aa47` at `.28` / `#d19738` |

The near-white `#fffdf7` paper remains less saturated than the surrounding
Paper-led viewport. Dark literary ink is used for prose, toolbar and controls;
gold remains confined to progress, bookmarks, selected surfaces, borders and
small labels. Existing warm muted prose stays unchanged because it is already
comfortable and readable against the paper.

### Reader script

| Reader-owned token | Old | New |
| --- | --- | --- |
| accent | `#7e501a` | `#b58636` |
| accent soft | `#d7b36d` | `#b58636` at `.32` |
| bookmark | `#7e341a` | `#b58636` |

Script keeps its sepia viewport, brown toolbar, parchment paper, brown prose,
muted text, borders and shadows. It is intentionally not made identical to
light mode. Only its small accents move toward the restrained darker approved
gold, while the existing dark accent text and selected-control ink mapping are
retained for legibility.

### Reader dark

| Reader-owned token | Old | New |
| --- | --- | --- |
| viewport radial / linear | warm cream `.16`; `#05070b → #0b1324` | `#e0aa47` at `.12`; `#0f1315 → #141414` |
| toolbar bg / border | near-black `.84` / warm cream `.18` | `#0f1315` at `.88` / `#e0aa47` at `.20` |
| toolbar text / muted | `#fff8e7` / `.68` | `#fdf3e2` / `.74` |
| control bg / border / text | warm white `.05` / cream `.28` / `#fff8e7` | Paper `.06` / gold `.30` / `#fdf3e2` |
| native option / paper | `#111827` / `#111827` | `#141414` / `#141414` |
| paper muted / border | paper tint `.66` / cream `.18` | paper tint `.74` / gold `.20` |
| accent / strong / soft / bookmark | `#e7d4a0` / `#f1d89d` / cream `.18` / `#d6a846` | `#e0aa47` / `#dca645` / `#e0aa47` at `.18` / `#dca645` |

Dark mode moves away from blue-black toward Ink/Night and Deep Dark. Its prose
remains the existing warm off-white rather than pure white; muted text opacity
increases to avoid muddy small labels. Gold is low-area and low-glow: progress,
bookmarks, small control accents and restrained translucent boundaries only.

## Readability and reader independence

The public homepage palette was not copied as a component recipe. A public
header and promotional surfaces optimize for scanning and brand recognition;
a reader must prioritize a stable paper field, quiet chrome, long-form contrast
and reduced glare. The approved colors therefore act as anchors inside three
reader-specific palettes rather than replacing every surface one-for-one.

Reader light, script and dark remain explicit settings. No system preference,
global site theme, adaptive behavior or global token dependency was added.
Consequently, every reader theme must be checked under both global site themes,
but its selected palette should not change with the site theme.

Body prose resolves from `--reader-paper-text` and never from a gold token.
Muted prose remains distinct from accent color. Existing semantic aliases,
legacy bridges, selector order and cascade remain in place. The selected-control
mapping is intentionally retained; only the source accent value changes and
must be verified in preview before any later selected-state redesign.

## Expected visible effect

- Light gains a warmer Paper-led viewport, quieter translucent toolbar, dark
  neutral literary ink and clearer restrained gold progress/bookmark accents.
- Script retains its visibly separate sepia atmosphere, with only small accent
  values aligned toward darker ARTales gold.
- Dark becomes neutral Ink/Night rather than blue-black, with warm non-white
  prose, more readable muted labels and controlled gold details.
- Layout, typography metrics and behavior should remain pixel-position stable;
  only color and the light-theme shadow tint should visibly change.

## Intentionally deferred

This preview does not change shared renderer special blocks, preview CTA or
leaking global `.artales-button` styles, focus-ring design, disabled-state
design, mobile polish, pagination or page fit, `WorkReaderOverlay`, access
panels outside the reader, typography or line height, parser/table/generated
header behavior, or settings persistence. It also does not change components,
routes, i18n, global CSS, assets, DB, environment, Supabase, package files,
entitlements or reader behavior.

## Preview checklist

The following is the required manual develop-preview matrix; it is not claimed
as complete until a deployed preview with representative content is available.

- [ ] Reader light mode.
- [ ] Reader script mode.
- [ ] Reader dark mode.
- [ ] Global site light with reader light, script and dark.
- [ ] Global site dark with reader light, script and dark.
- [ ] Preview reader start and preview reader end CTA.
- [ ] Full reader, if available.
- [ ] Toolbar controls and settings panel open/closed.
- [ ] Progress at start, middle and end.
- [ ] Bookmark marker and bookmark action.
- [ ] Scroll, page and spread layouts.
- [ ] Focus mode.
- [ ] Font scale 85%, 100% and 130%.
- [ ] Narrow, normal and wide width.
- [ ] Comfortable and compact density.
- [ ] 320 px and 360 px mobile.
- [ ] Tablet portrait and landscape.
- [ ] Desktop.
- [ ] Czech and English labels.
- [ ] Long paragraphs, quote, note, footnote, and table/warning if available.
- [ ] Keyboard-visible controls and selected controls in every reader theme.
- [ ] Confirm body text is never gold and small muted text remains readable.

## Validation

Automated checks cover CSS parsing, custom-property graph cycles, whitespace and
scope. Visual checks remain required in the develop preview because local data
and access state determine which representative works and full-reader paths are
available. No production or `main` deployment is part of this change.

## Rollback

Revert the single palette-preview commit or PR. This restores the previous
reader-owned token values and removes the follow-up documentation without data,
configuration, package, asset or migration work. After rollback, parse the CSS
again and smoke-check light, script and dark in the develop preview, including
selected controls, progress and bookmarks. No irreversible step exists.
