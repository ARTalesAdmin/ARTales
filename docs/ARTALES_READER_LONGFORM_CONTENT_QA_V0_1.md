# ARTales Reader long-form content QA v0.1

## Status and boundary

- **Target:** `develop first`; this is a develop-preview audit and polish pass, not approval for `main`.
- **Risk:** medium. The runtime change is narrowly scoped CSS, but it affects long-form content inside the Reader, a critical user path.
- **DB:** no.
- **Env:** no.
- **Behavior:** unchanged.
- **Shared renderer:** `components/work/work-content-renderer.css` is untouched. Every runtime override lives below `.artales-reader__paper .artales-work-content` in `components/reader/reader.css`, so public work-detail rendering keeps its existing presentation.

This pass follows PR #113, whose controls and access-state work was intentionally subtle. With the softer Reader palette accepted for continued work, this audit checks the next boundary: special long-form blocks rendered on Reader paper.

## Content blocks reviewed

- Normal paragraphs and in-content headings, including classic-edition chapter and book-part headings.
- Quotes and block quotes.
- Poems and verse.
- Letters, place/year lines, dates, and signatures.
- Notes and inline footnote references.
- Footnote section text and its separator.
- Dedications, prefaces, afterwords, and acknowledgements.
- Separators and ornaments.
- Images, image borders, and captions.
- Newspaper blocks.
- Tables, captions, header/body cells, borders, and table warnings.
- Reader page headers and footers.
- Other muted or metadata text inside Reader paper.

## Reader-scoped overrides added

The Reader's existing shared-renderer bridge now maps `--artales-text`, `--artales-muted`, `--artales-border`, and `--artales-soft` directly to the corresponding Reader semantic aliases. This is a naming-level cleanup only; it preserves the palette values already supplied to most long-form blocks.

Four narrowly scoped corrections prevent raw, light-biased renderer colors from winning inside script or dark Reader paper:

1. Quote, dedication, and footnote-section text uses `--reader-color-paper-text`.
2. Notes and inline footnote references use the Reader paper soft surface, border, and text aliases.
3. Classic-edition chapter and book-part headings use Reader paper text instead of a fixed dark heading color.
4. Table warnings use the Reader paper soft surface, border, and text aliases rather than the shared renderer's cream/gold/brown warning palette.

These rules introduce no raw palette colors and no new custom properties. Gold is not added as decoration; existing Reader borders remain restrained.

## Light, script, and dark handling

All corrected colors resolve from the active Reader's existing semantic paper aliases. Light and script therefore retain their warm paper character, while dark receives readable text and low-salience surfaces without relying on global renderer theme rules. The overrides do not use a global `[data-artales-theme="dark"]` selector.

## Intentionally unchanged

- Body prose color, typography, line height, font scale, indentation, spacing, and structure.
- Quote, poem, letter, dedication, preface, afterword, and acknowledgement layout or typography.
- Footnote and note sizing, radius, spacing, and content.
- Image presentation and caption styling, which already consume renderer variables mapped to Reader semantic aliases.
- Separators, letter metadata, table captions/cells, newspaper borders, and other muted text, which already consume the mapped renderer variables.
- Page header/footer styling, which already consumes Reader paper muted and border values.
- Parser, block formats, pagination, page fitting, scroll/page/spread behavior, and Reader settings.
- Components, routes, i18n, globals, public or brand assets, packages, DB, environment, Supabase, access, and entitlement logic.
- Public homepage, gallery, and work-detail styling.

## Develop preview checklist

- [ ] Reader light with several long paragraphs and in-content headings.
- [ ] Reader script with several long paragraphs and in-content headings.
- [ ] Reader dark with several long paragraphs and in-content headings.
- [ ] Quote or block quote.
- [ ] Note and inline footnote reference.
- [ ] Footnote list and top separator.
- [ ] Poem or verse with preserved whitespace.
- [ ] Letter, place/year line, date, and signature.
- [ ] Dedication, preface, afterword, and acknowledgement, where available.
- [ ] Separator or ornament.
- [ ] Image, border, and caption, where available.
- [ ] Newspaper block, where available.
- [ ] Table, caption, header/body cells, and warning, where available; visual check only, with no pagination changes.
- [ ] Classic-edition chapter and book-part headings, where available.
- [ ] Page header and footer in light, script, and dark.
- [ ] Focus mode.
- [ ] Scroll, page, and spread basic smoke check.
- [ ] 320 px and 360 px mobile quick checks.
- [ ] Public work detail unchanged in light and dark site themes.

## Rollback path

Revert the single Reader long-form QA/polish commit (or remove the `Reader long-form content QA v0.1` block, restore the four renderer bridge values, and remove this document). No migration, environment change, generated asset cleanup, or data repair is required. After rollback, smoke-test a Reader note, quote, footnote, classic heading, and table warning in dark mode, then confirm public work detail remains unchanged.
