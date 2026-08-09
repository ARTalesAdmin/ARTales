# ARTales Reader content blocks typography polish v0.1

## Status and feedback addressed

- **Target:** `develop first`; validate in the develop preview before any production decision.
- **Risk:** medium. The change is Reader-scoped CSS on a critical reading path, with no rendering or pagination logic changes.
- **DB:** no.
- **Env:** no.

This pass addresses bordered annotation panels, collapsed authored line breaks in letters and prefaces, loose prose rhythm, missing Reader-wide justification, and single-column newspaper articles on wide scrolling paper.

## Renderer selectors audited

`WorkContentRenderer` already exposes the hooks needed for a CSS-only change:

- prose: `.artales-paragraph`;
- notes and inline footnotes: `.artales-note` and `.artales-footnote-ref`;
- collected footnotes: `.artales-footnotes`;
- letters and their fields: `.artales-letter`, `.artales-letter-body`, `.artales-letter-place-year`, and `.artales-letter-date-signature`;
- prefaces: `.artales-preface`;
- newspaper articles: `.artales-newspaper`;
- all block wrappers also expose `data-block-type`.

No TSX class hook, block mapping, parser normalization, or renderer behavior needed to change.

## Treatments

### Notes and footnotes

Reader notes and inline footnotes no longer use a visible border. Their low-contrast Reader-token surface, indentation, compact rhythm, annotation sizing, and note label continue to distinguish them from prose. The collected footnote section replaces its hard divider with a subtle inset line derived from the Reader soft-surface token. All colors continue to resolve through active light, script, or dark Reader paper tokens.

### Letters and prefaces

Letter bodies and prefaces use `white-space: pre-line`, preserving authored single line breaks without changing how the renderer splits paragraphs or how ordinary paragraphs behave. Letter prose is justified and slightly tighter while its place/year and signature alignment remain untouched.

The preface now has its own restrained intro measure, spacing, and rhythm rather than inheriting centered plain-paragraph presentation. Its opening paragraph uses muted italic editorial emphasis; remaining prose stays quiet and readable. No decorative ornament or invented kicker was added.

### Newspaper articles

Newspaper articles use two balanced CSS columns on wide scrolling Reader paper, with a responsive gap and a subtle token-based rule. They fall back to one column at 720 px and below, and in page/spread modes where each sliced page has a narrower readable measure. DOM order and assistive-technology reading order are unchanged. This is presentation only and does not alter slicing.

### Justification and global rhythm

Normal prose, letter bodies, notes, inline and collected footnotes, newspaper prose, and preface prose use justification, automatic hyphenation, and safe word wrapping. Headings, captions, metadata, signatures, controls, labels, and reference numbers are excluded. At 520 px and below, prose returns to left alignment and manual hyphenation to avoid stretched word spacing on narrow paper.

Reader prose line height changes conservatively from the shared renderer's `1.75` to `1.62`; the classic preset changes from `1.82` to `1.66`. Letters, prefaces, annotations, footnotes, and newspaper blocks receive nearby compact values appropriate to their roles. Font-scale behavior remains intact at 85%, 100%, and 130%.

## Theme behavior

Every new surface, divider, text, and muted treatment uses existing Reader semantic tokens below `.artales-reader__paper .artales-work-content`. No public/account tokens or new raw colors are introduced. Light, script, and dark therefore retain their existing paper palettes.

## Intentionally unchanged

- Parser behavior and authored-data normalization.
- Pagination, page slicing, page fitting, and scroll/page/spread algorithms.
- Reader settings and persistence.
- Access, entitlement, Supabase, DB, environment, packages, or assets.
- Public work detail, homepage, gallery, account, member, and internal styling.
- Headings, captions, navigation, controls, metadata, and other UI chrome.

The known mobile single-page/spread overflow bug remains a separate issue. This typography pass only adds narrow-width alignment and newspaper-column safety; it does **not** claim to solve mobile pagination or text overflow.

## Develop preview checklist

- [ ] Reader light, script, and dark themes.
- [ ] Normal paragraph block.
- [ ] Note block, footnote reference, and collected footnote section.
- [ ] Letter with intentional single and paragraph line breaks.
- [ ] Preface with intentional formatting.
- [ ] Short and long newspaper/article blocks.
- [ ] Long article on desktop/wide scrolling paper uses two readable columns.
- [ ] Article on mobile/narrow paper uses one column.
- [ ] Font scale 85%, 100%, and 130%.
- [ ] Scroll mode.
- [ ] Page mode.
- [ ] Spread mode on desktop.
- [ ] Mobile quick check, while treating the known page/spread overflow as separate.
- [ ] Public work detail remains unchanged.
- [ ] Reader settings still load, change, and persist normally.

## Rollback path

Revert the typography-polish commit. There are no migrations, environment changes, generated assets, or data repairs. After rollback, smoke-test normal prose, a letter, a note/footnote, a preface, and a long newspaper article in all three Reader themes and confirm the public work detail remains unchanged.
