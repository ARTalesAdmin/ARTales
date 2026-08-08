# ARTales Reader visual/token audit v0.1

## Summary

This is a source audit and migration plan for the dedicated ARTales Reader. It
does **not** propose final palette values and makes no runtime change. The reader
is a long-form environment with its own paper, text, toolbar, control, progress,
bookmark and theme semantics; the public-site palette therefore cannot be
copied into it selector by selector.

The current reader is already substantially isolated behind `--reader-*`
custom properties. That is the safest seam for later work. The main risks are
raw values outside that seam, shared renderer rules with light-biased literals,
global button/theme leakage, an older inline-styled overlay, and a CSS file that
contains several chronological override layers. Readability, content fidelity,
focus visibility and long-session eye comfort are higher priorities than brand
prominence. Gold should remain a restrained accent for focus, progress,
bookmarks and small control emphasis—not a body-text or large-surface color.

Audit method: static inventory and searches for reader references, selectors,
custom properties, theme classes, and `hex`/`rgb(a)`/`hsl(a)` literals. Counts
below are occurrence counts, not unique colors, and include token definitions,
gradients and shadows. Runtime computed styles and contrast have not yet been
measured; those belong to implementation preview.

## Reader file inventory

### Primary route and visual owners

| File | Role | Visual relevance |
| --- | --- | --- |
| `app/reader/[slug]/page.tsx` | Server route; selects `preview` or `full`, enforces full-reader access, supplies localized data and content. | State/fixture owner; no reader styles. Unauthorized full requests redirect to login or the work detail access state. |
| `components/reader/ReaderClient.tsx` | Reader shell and interactive state. Imports `reader.css`; composes scroll, page and spread papers, preview notes/CTA, bookmark marker, page headers/footers and side navigation. | Applies theme/width/density/layout/page-fit/focus/turn modifier classes and injects `--reader-font-scale`. |
| `components/reader/ReaderToolbar.tsx` | Brand/title, progress, bookmark/focus/settings controls and preview/full actions. | Main control-state selector source; chooses a light brand asset only for reader dark theme. |
| `components/reader/reader.css` | Dedicated reader stylesheet (1,625 lines at audit time). | Primary visual owner: theme values, paper, toolbar, controls, progress, navigation, focus, responsive/PWA and layout overrides. |
| `components/work/WorkContentRenderer.tsx` | Shared semantic block renderer used in reader and work surfaces. Imports its own stylesheet. | Determines the content classes inside reader paper; changing it is not reader-isolated. |
| `components/work/work-content-renderer.css` | Shared long-form block typography and special content styles. | Secondary visual owner. Reader scopes four `--artales-*` variables into it, but the file also has raw light/dark values. |
| `lib/reader/readerSettings.ts` | Reader settings types, allowed values, defaults and legacy theme normalization. | Defines light/script/dark, width, density and layout modes. Default is light/comfortable/scroll/normal; legacy paper/sepia map to light/script. |
| `lib/reader/readerStorage.ts` | Persists reader settings, progress and bookmarks in local storage. | Theme persistence and preview/full progress-state dependency; no styles. |

### Adjacent and legacy surfaces

| File | Role / audit disposition |
| --- | --- |
| `app/globals.css` | Defines public/global semantic tokens and legacy aliases, global light/dark theme cascades, shared `.artales-button*`, and a duplicate `.artales-reader-work-actions` layout rule. It is loaded by `app/layout.tsx`, so it can affect the reader. |
| `app/layout.tsx` | Establishes `data-artales-theme="light|dark"`, `colorScheme`, theme bootstrapping and global CSS. This is the site theme, distinct from the locally persisted reader theme. |
| `components/work/WorkReaderOverlay.tsx` | Older dialog-style preview/full reader surface with inline visual styles. No current import/consumer was found by static search; retain in inventory until confirmed dead. Its values are not theme-aware. |
| `components/reader/ReaderWorkActions.tsx` | Work-detail entry actions for full access, preview, unlock, membership and save state. It consumes global button classes and is not inside the dedicated reader route. Audit with access entry points, but do not fold it into reader paper tokens. |
| `components/work/WorkDetailClient.tsx` | Current consumer of `ReaderWorkActions`; owns work-detail access/status presentation outside the reader. |
| `lib/i18n/dictionaries/{cs,en}/reader.ts` | Reader control and state labels. Relevant to wrapping fixtures only; i18n changes are explicitly out of scope. |
| `lib/reader/paginateBlocks.ts` | Page/spread behavior and content slicing. Relevant to visual regression fixtures only; parser/pagination behavior is protected non-scope. |
| `lib/rendering/blockFormats.ts` | Provides `readerComfort` and `readerCompact` format presets consumed by the renderer. Behavior is non-scope; both presets need visual fixtures. |

Commerce, memberships, entitlements, DB access and preview extraction determine
which state is shown but do not own reader color. They should provide fixtures,
not be edited in a visual migration.

## Current visual architecture

1. The root layout applies global CSS and an HTML light/dark theme.
2. The reader route resolves access and reduces content for preview mode.
3. `ReaderClient` loads independently persisted reader settings and creates a
   scoped class stack such as
   `.artales-reader--theme-dark`, `--width-normal`, `--density-comfortable`,
   `--layout-scroll` and optionally `--focus`/`--turn-*`.
4. `.artales-reader` establishes reader tokens. Light, script and dark modifier
   classes replace their values; descendant selectors mostly consume them.
5. Reader paper rebinds the shared renderer's `--artales-text`,
   `--artales-muted`, `--artales-border` and `--artales-soft` to reader paper
   tokens. This adapter is the important boundary between shell and prose.
6. Later blocks in `reader.css` override earlier layout rules for pagination,
   spread, focus correction, launch/PWA behavior and phone polish. A migration
   must inspect computed output; editing an early declaration may have no effect.

There is no reader setting named `adaptive`. “Adaptive” currently belongs to
the global website theme bootstrap. The reader setting is explicit and locally
persisted (`light`, `script`, `dark`). Consequently, global dark can coexist
with reader light/script and vice versa. Shared selectors such as
`.artales-button` and `[data-artales-theme="dark"] .artales-work-content ...`
can bridge those two systems and are a cascade-risk checkpoint.

## Reader CSS variables and tokens

All dedicated variables are defined in `components/reader/reader.css`:

| Token | Intended role | Notes |
| --- | --- | --- |
| `--reader-font-scale` | Prose scale multiplier | Runtime override from settings; not a color token. |
| `--reader-outer-bg` | Full viewport/stage atmosphere | Gradient per theme; branding here must stay quiet. |
| `--reader-toolbar-bg` | Sticky toolbar surface | Translucent; backdrop and contrast must be tested. |
| `--reader-toolbar-border` | Toolbar/navigation boundary | Also used by page navigation. |
| `--reader-toolbar-text` | Primary toolbar/control-context text | Also derives progress track. |
| `--reader-toolbar-muted` | Author, progress and secondary chrome text | Must remain readable at small sizes. |
| `--reader-control-bg` | Buttons, groups and select surface | Often translucent. |
| `--reader-control-border` | Control boundary/focus-adjacent contrast | Disabled and focus states need non-color cues. |
| `--reader-control-text` | Control labels and select text | Check native select/option behavior. |
| `--reader-control-option-bg` | Native option background | Platform/browser-sensitive. |
| `--reader-paper` | Long-form reading surface | Must not simply alias a marketing card surface. |
| `--reader-paper-text` | Main prose ink | Highest-priority contrast/comfort pair. |
| `--reader-paper-muted` | metadata, preview copy and renderer muted text | Used at small sizes. |
| `--reader-paper-border` | Paper edge and renderer structural border | Passed to shared renderer as `--artales-border`. |
| `--reader-paper-shadow` | Paper elevation | Theme-specific; avoid glow/fatigue in dark. |
| `--reader-accent` | Progress and emphasis | Candidate for restrained brand-gold mapping. |
| `--reader-accent-strong` | Accent text/labels | Do not use as extended prose color. |
| `--reader-accent-soft` | Selected/focus-like control fill | Verify selected state and text contrast. |
| `--reader-bookmark` | Bookmark marker/line | Reader-specific state identity. |

### Shared and legacy tokens consumed inside reader

- Reader paper maps shared renderer tokens `--artales-text`,
  `--artales-muted`, `--artales-border`, and `--artales-soft` to reader values.
  The names are global/legacy, but the scoped values are reader-owned.
- `work-content-renderer.css` defines those same four tokens at its root and
  again under global dark theme. These are fallbacks for non-reader consumers
  and a possible specificity/order interaction.
- Preview CTA anchors use global `.artales-button`; work-detail reader actions
  use `.artales-button` and `.artales-button-secondary*`. They inherit public
  palette semantics instead of dedicated reader access/action semantics.
- `app/globals.css` supplies public semantic `--artales-color-*` tokens plus
  older aliases (`--artales-ink`, `--artales-gold`, `--artales-paper`, etc.).
  Dedicated reader CSS does not currently consume these directly.
- The renderer's typography uses hard-coded Georgia/Times fallbacks, while the
  reader chrome uses Arial/Helvetica and headings use Georgia. These are style
  primitives rather than registered reader typography tokens.

## Raw color/style usage

Static literal counts at audit time:

- `components/reader/reader.css`: **91** hex/`rgb(a)`/`hsl(a)` occurrences.
  Most are the four base/theme token palettes, but exceptions remain in
  descendant selectors.
- `components/work/work-content-renderer.css`: **21** occurrences.
- `components/work/WorkReaderOverlay.tsx`: **17** occurrences in inline styles.

### Dedicated reader selector exceptions

Outside the token definition blocks, raw reader values occur in:

- `.artales-reader-select-label select` translucent white fill;
- dark/script `.artales-reader-primary-link` and pressed focus-button ink;
- page navigation, spread sheets, side navigation and settings-panel shadows;
- dark spread inset highlight/shadow;
- later launch/mobile paper shadows.

These should first be classified as control ink, overlay fill, elevation or
focus semantics; replacing them directly with public gold/paper values would
hide their role. Derived `color-mix()` declarations already use reader tokens
and should generally remain derived rather than becoming more raw literals.

### Shared renderer exceptions that appear inside reader paper

Raw values style base text/muted/border/soft defaults, quotes, notes,
dedications, footnotes, classic-edition headings, image shadows, table warnings,
print ink and global-dark table overrides. Particularly risky are:

- `.artales-quote`, `.artales-note`, `.artales-dedication`,
  `.artales-footnotes` and classic heading colors, which can stay dark even on
  a reader-dark paper unless overridden;
- note backgrounds that assume light paper;
- warning tables with fixed cream/gold/brown values;
- `[data-artales-theme="dark"]` renderer rules keyed to the **global** theme,
  not the selected reader theme.

### Inline legacy overlay

`WorkReaderOverlay` hard-codes its scrim, paper, ink, borders, toolbar, muted
text, close control, CTA and shadow. It is currently disconnected by static
import search. Do not migrate it opportunistically: first decide whether to
remove it in a separate cleanup or formally adopt it as a supported surface.

## Light/dark/adaptive behavior

- **Reader light:** explicit `.artales-reader--theme-light`; warm outer gradient,
  near-white paper and dark ink. This is the persisted default.
- **Reader script:** explicit `.artales-reader--theme-script`; sepia paper and
  brown toolbar. It is a reading mode, not the global light theme. Legacy
  `sepia` preferences normalize to `script`.
- **Reader dark:** explicit `.artales-reader--theme-dark`; deep navy/black outer
  surface and paper with warm off-white text. It also flips the toolbar brand
  lockup to its light variant.
- **Global light/dark/adaptive:** the root HTML attribute and `ThemeScript`
  control site tokens. Adaptive behavior is resolved outside reader settings;
  the reader does not follow system changes automatically once its local
  setting is selected.

The first implementation proposal must explicitly choose one contract:
preserve the independent reader preference (recommended), or introduce a
separate reader `system` option in a later behavioral PR. Do not silently make
reader light mean global adaptive. Test the cross-product of HTML theme and
reader theme until shared renderer/button leakage is removed or documented.

Dark QA must cover sustained prose reading, muted text, italics, notes,
footnotes, tables, images, toolbar translucency, native options, disabled side
navigation, focus outlines and gold accents. Passing a point contrast check is
necessary but not sufficient for eye comfort.

## Long-form reading risks

The protected reading layer includes paragraphs; book-part and chapter titles;
quotes; poetry; letters and signatures; newspaper columns; place lines;
separators; notes; footnotes; dedication/preface/afterword/acknowledgement;
images/captions; tables/warnings; fallback content; and generated page
headers/footers. Comfort/compact presets, font scaling, narrow/normal/wide
measure, scroll/page/spread layouts and print rules all affect it.

Risks:

- palette changes can lower prose or muted-copy contrast and make dark reading
  glaring, muddy or over-warm during long sessions;
- raw renderer colors may contradict scoped reader paper tokens;
- justified text, indentation, line height and measure interact with font scale,
  locale, long words and small viewports;
- paper borders/shadows/gradients can dominate content if public-card styling is
  imported wholesale;
- poetry whitespace, letter signatures, multi-column newspaper blocks, images,
  footnotes and tables require representative fixtures;
- page/spread sizing is coupled to pagination output. The cancelled table/
  generated-header pagination patch must not be revived in visual work;
- print styling is shared and must remain unchanged unless separately scoped.

Readability acceptance should evaluate text/background contrast, muted text,
line length, line height, font scale extremes, hierarchy, link/focus visibility,
long-session comfort and content fidelity—not brand-token coverage alone.

## Controls/access-state risks

Controls include the sticky toolbar, brand/title/author metadata, progress,
settings disclosure, text-size buttons, layout/theme/width/density selects,
bookmark create/go/update/clear, focus mode, preview continuation, exit, page/
spread side navigation, disabled states and bookmark marker.

Access states span preview notes/end CTA, entitled full reader, unauthorized
full redirects (signed-out registration versus signed-in membership required),
and work-detail preview/unlock/membership actions. The route has no paywall panel
inside reader paper; the access panels live on login/work/account surfaces and
must not be restyled as though they were prose.

Key risks are global `.artales-button` leakage in preview CTA; low-contrast
translucent controls; tiny muted/progress text; gold being mistaken for a
primary fill everywhere; missing or subtle focus-visible treatment; native
select option mismatches; disabled navigation relying mainly on opacity; and
brand variant selection in script mode. Verify preview and full modes separately
without changing entitlement logic.

## Mobile risks

Reader CSS has overlapping breakpoints at 980, 820, 640 and 560px plus
standalone-display and safe-area rules. Later declarations intentionally refine
earlier ones. Mobile makes paper edge-to-edge, rearranges/wraps toolbar actions,
shrinks progress, collapses title/author in some focus states, changes page/
spread presentation, repositions side navigation and bookmark marker, and uses
dynamic viewport/safe-area sizing.

Check 320px and 360px narrow devices, a common phone, tablet portrait/landscape,
and desktop. Test browser chrome expansion, standalone PWA, notch/safe areas,
200% zoom, long Czech/English labels, horizontal control scrolling, touch target
size, paper padding, clipped page headers/footers, overlaying side controls and
focus mode exit/settings reachability. A palette-only change can still expose
layering and translucency failures on these layouts.

## Suggested migration phases

1. **Audit only (this PR).** Inventory ownership, theme boundaries, literals,
   states, risks and fixtures. No runtime edits.
2. **Reader token definitions / mapping proposal.** Define reader-owned semantic
   roles and proposed relationships to approved public brand primitives. Include
   contrast targets and cross-theme computed examples; no broad selector edits.
3. **Value-preserving reader token alias pass.** Move remaining dedicated-reader
   raw control/shadow values behind named reader aliases without changing
   computed output. Keep shared renderer changes separate where possible.
4. **Reader light/dark palette mapping.** Map light/script/dark values deliberately
   and resolve the global-theme/reader-theme boundary. Gold remains restrained.
5. **Reader controls/access panel polish.** Toolbar, focus/progress/bookmarks,
   preview CTA and adjacent entry/access states, with full keyboard/state QA.
6. **Long-form text readability QA.** Validate and, only with explicit scope,
   correct renderer prose/special-block values across representative content.
7. **Mobile reader polish.** Resolve evidence-backed responsive, PWA and safe-area
   defects without touching pagination/parser behavior.
8. **Final reader visual review.** Complete fixture matrix, accessibility and
   long-session review; document exceptions and promotion decision separately.

Each phase should be a reviewable PR into `develop`, with its own value/state
baseline and rollback. Do not combine semantic mapping, visual decisions and
pagination/renderer behavior changes.

## Recommended first implementation PR

Prepare a **reader token definitions and mapping proposal** (phase 2), still
documentation-first. Define semantic groups for viewport, toolbar, paper/prose,
muted metadata, controls, focus, progress, bookmark, borders and elevation for
light/script/dark. For every proposed alias record current value, proposed
source (reader-owned or approved public primitive), consumers, theme behavior,
contrast expectation and whether the first code pass must be value-preserving.

Do not change `work-content-renderer.css` in that PR unless the proposal proves
a reader-scoped override is required. Do not introduce adaptive behavior, alter
settings persistence, polish access flows, change typography metrics, or touch
pagination. The following code PR should be phase 3 only: alias current literals
with screenshots showing computed-value equivalence.

## Preview checklist

### Evidence and fixtures

- [ ] Deploy the exact `develop` preview commit; record SHA, URL, browser,
  viewport, locale, auth state, global HTML theme and reader theme.
- [ ] Use a stable long-form work containing chapters, long paragraphs, italics,
  quote, poem, letter/signature, separator, note, footnote, image/caption and
  table/warning; record missing fixture types.
- [ ] Capture before/after at identical scroll/page position after hydration,
  fonts and images settle.

### Theme/state matrix

- [ ] Reader light, script and dark under both global light and global dark;
  separately check initial system/adaptive global load.
- [ ] Preview start/end CTA and entitled full reader; signed-out and signed-in
  unauthorized full-reader redirects and their destination access messaging.
- [ ] Scroll, page and spread; comfortable/compact; narrow/normal/wide; font
  scale 85%, 100% and 130%; focus mode on/off.
- [ ] No bookmark; saved bookmark marker; go/update/clear; progress at start,
  middle and end; first/last disabled page controls.
- [ ] Settings expanded/collapsed; native select open; hover, active,
  focus-visible and disabled states for every reachable control.

### Readability and responsive review

- [ ] Prose, muted text and special blocks remain comfortably readable; gold is
  limited to small accents and never substitutes for body ink.
- [ ] Dark paper avoids pure-white glare, muddy muted copy, excessive glow and
  invisible borders; assess a sustained reading session, not screenshots only.
- [ ] Keyboard order, visible focus, non-color state cues, 200% zoom and reduced
  motion remain usable.
- [ ] Check 320/360px phone, common mobile, tablet portrait/landscape and desktop;
  include standalone PWA and safe areas where available.
- [ ] Czech and English labels do not clip or make core controls unreachable.
- [ ] Page headers/footers, side navigation, bookmark marker, paper edges and
  toolbar do not overlap content.
- [ ] Verify no layout shift or color flash on reload, back/forward and reader
  theme persistence.
- [ ] Confirm work detail and other shared-renderer consumers have no unintended
  visual change.

### Promotion gate

- [ ] Attach labeled evidence and computed token/contrast results to the PR.
- [ ] List failed, waived, unavailable and not-run checks explicitly.
- [ ] Confirm no parser, table pagination, generated-header, entitlement, DB,
  environment, asset or public-shell behavior entered the diff.
- [ ] Obtain explicit review in `develop`; do not merge or promote to `main`
  automatically.

## Explicit non-scope

This audit changes no reader CSS, global CSS, app code, components, routes,
i18n, public/brand assets, package files, DB, environment, Supabase, commerce,
membership, entitlements, editor, parser or reader behavior. It does not choose
final token values, claim contrast compliance, add tooling, remove the legacy
overlay, introduce an adaptive reader option, or revive the cancelled
**v0.10.15k — Table Pagination & Generated Header Fix**.

Delivery metadata: **Risk: low** (documentation only); **Target: develop
first**; **DB: no**; **Env: no**. Rollback is a revert of this documentation
commit; there is no runtime, data, asset, package or environment rollback.
