# ARTales Reader semantic token definitions and mapping proposal v0.1

## 1. Summary

This document proposes a reader-owned semantic token model. It is a definition
and mapping proposal, **not** a runtime palette application. It follows the
source audit delivered in PR #107 and should be read together with
`ARTALES_READER_VISUAL_TOKEN_AUDIT_V0_1.md`.

No visual change is intended in this PR. The current CSS remains the source of
truth until a separately reviewed implementation changes it. The model is
purposefully organized around reading roles rather than the public homepage
palette: long-session comfort, prose fidelity, legible metadata and visible
keyboard focus take priority over brand prominence.

## 2. Reader token groups

| Group | Semantic responsibility | Boundary |
| --- | --- | --- |
| Viewport / outer atmosphere | Background behind the paper and page/spread stage | Quiet framing only; it must not compete with prose. |
| Toolbar | Sticky chrome surface, primary text and separating edge | Independent of the global site header and global theme. |
| Toolbar metadata | Author, mode, progress text and other small secondary labels | Requires explicit small-text review in every reader theme. |
| Paper / reading surface | Continuous, page and spread sheet backgrounds | Comfort-tuned reading surface, not a marketing-card alias. |
| Prose / body text | Primary long-form ink | Highest-priority sustained-reading pair with paper. |
| Muted prose / annotations / metadata | Captions, preview copy, headers, footers and secondary content | May need separate prose-muted and paper-metadata roles after measurement. |
| Structural borders | Paper edge, headers/footers and shared-renderer dividers | Must remain perceptible without decorating every block. |
| Controls | Button/group/select surface, border and label | Reader-local interactive chrome. |
| Control selected/active | Pressed focus control, primary reader action and future selected settings | Separate fill, border and text roles; state cannot rely on color alone. |
| Focus-visible | Keyboard focus ring and optional offset/halo | Dedicated role, never inferred only from selected state. |
| Progress | Track, fill and small progress label | Gold may be used for the fill as a restrained accent. |
| Bookmarks | Marker, rule, action state and marker text | Distinct state identity; gold/brown may remain localized. |
| Preview/access CTA | End-of-preview action and supporting copy | Reader-scoped semantics must eventually prevent global `.artales-button` leakage. |
| Page/spread navigation | Navigation panel, controls, status and disabled state | Includes bottom page navigation and floating side navigation. |
| Elevation/shadow | Paper, panel, navigation and bookmark elevation; spread gutter | Theme-aware depth, without dark-mode glow. |
| Native select/options | Closed select inset plus native option surface/text | Browser/OS behavior must be checked, not inferred from CSS alone. |
| Shared-renderer special content | Quotes, notes, dedication, footnotes, classic headings, images and warning tables | Reader-scoped adapter/overrides only; public work-detail consumers remain unchanged. |

## 3. Current reader token inventory

Values below are declarations in `components/reader/reader.css`. “Light” means
the explicit light modifier, not the unmodified root fallback. Consumer lists
name selector groups rather than every repeated chronological override.

| Existing token | Current role and consumers | Light | Script | Dark | Disposition |
| --- | --- | --- | --- | --- | --- |
| `--reader-font-scale` | Prose size multiplier in `.artales-work-content` and the phone override | `1` (then inline setting) | same | same | Remain as-is; it is a behavioral dimension token, not a color alias. |
| `--reader-outer-bg` | `.artales-reader` viewport/stage background | warm radial over `#f7f1e6 → #e7d4a0` | brown radial over `#e9d8b9 → #c9a979` | gold-tinted radial over `#05070b → #0b1324` | Alias to `--reader-color-viewport-bg`; old name can bridge one phase. |
| `--reader-toolbar-bg` | Sticky toolbar, page/side navigation and settings-panel derived fills | `rgba(255,250,240,.9)` | `rgba(67,43,25,.86)` | `rgba(5,7,11,.84)` | Alias; later split toolbar from navigation/panel surfaces. |
| `--reader-toolbar-border` | Toolbar edge, page/side navigation and settings-panel derived borders | `rgba(13,21,40,.12)` | `rgba(249,230,186,.22)` | `rgba(241,216,157,.18)` | Alias; later split toolbar edge from floating-panel borders if measurements require it. |
| `--reader-toolbar-text` | Root/chrome text, title, navigation text and derived progress track | `#071226` | `#fff3d4` | `#fff8e7` | Alias; progress track needs its own semantic split. |
| `--reader-toolbar-muted` | Author, progress/status and page-nav labels | `rgba(13,21,40,.66)` | `rgba(255,243,212,.72)` | `rgba(255,248,231,.68)` | Alias to toolbar metadata; consider a later small-progress split. |
| `--reader-control-bg` | Settings toggle, control groups, ghost/top/page buttons and derived progress surface | `rgba(255,255,255,.64)` | `rgba(255,243,212,.09)` | `rgba(255,248,231,.05)` | Direct control alias; progress container may later split. |
| `--reader-control-border` | Controls, progress container and page buttons | `rgba(13,21,40,.16)` | `rgba(255,243,212,.3)` | `rgba(241,216,157,.28)` | Direct control alias. |
| `--reader-control-text` | Control labels, select/option text and navigation buttons | `#071226` | `#fff3d4` | `#fff8e7` | Direct control alias. |
| `--reader-control-option-bg` | Native `<option>` background | `#fffaf0` | `#432b19` | `#111827` | Alias to a native-option surface; keep separate from closed control fill. |
| `--reader-paper` | Scroll/page/spread reading sheet | `#fffdf7` | `#f4e5c8` | `#111827` | Alias to paper background; name needs explicit color/role semantics. |
| `--reader-paper-text` | Paper ink, prose and scoped `--artales-text`; also derives `--artales-soft` | `#17130f` | `#24180d` | `#f7ecd8` | Alias to paper text; the derived soft surface needs its own adapter token. |
| `--reader-paper-muted` | Preview text, page metadata and scoped `--artales-muted` | `#6c6258` | `#6f553a` | `rgba(247,236,216,.66)` | Alias; new split may be needed between prose annotations and tiny page metadata. |
| `--reader-paper-border` | Paper edge, preview dividers, page rules, spread gutter derivations and scoped `--artales-border` | `rgba(165,126,56,.22)` | `rgba(104,68,29,.26)` | `rgba(241,216,157,.18)` | Alias; retain one structural role initially, split special-block borders only if QA supports it. |
| `--reader-paper-shadow` | Base paper elevation | `0 28px 90px rgba(39,29,18,.16)` | `0 28px 90px rgba(52,31,16,.26)` | `0 32px 120px rgba(0,0,0,.42)` | Alias to paper shadow; spread and panel shadows need new roles. |
| `--reader-accent` | Progress fill, script/dark mode labels, primary fill and active focus fill | `#987331` | `#7e501a` | `#e7d4a0` | Needs semantic splits: progress, selected control and small emphasis are not one role. |
| `--reader-accent-strong` | Light-theme mode/settings labels, primary/selected text and bookmark marker text | `#6c4b18` | `#4d2d0d` | `#f1d89d` | Needs split into selected text and bookmark/metadata text roles. |
| `--reader-accent-soft` | Light selected/primary fill and border | `#ead39b` | `#d7b36d` | `rgba(241,216,157,.18)` | Alias initially to selected fill/border, then measure text pairing. |
| `--reader-bookmark` | Marker edge, gradient, dot, rule and derived marker shadow | `#a56d24` | `#7e341a` | `#d6a846` | Alias to bookmark; derived bookmark surface/shadow can remain computed. |

The root `.artales-reader` fallback has a slightly different warm palette from
explicit light (notably paper `#fffaf0` and shadow alpha `.18`). Phase 3 must
preserve that fallback too, even though hydrated settings normally add an
explicit theme class; this table does not silently redefine it as light.

## 4. Proposed semantic token names

The names deliberately extend the existing `--reader-*` namespace and map back
to an existing variable, derived value or identified literal. They are not
unmapped “final” names.

### Core surfaces and text

- `--reader-color-viewport-bg` ← `--reader-outer-bg`
- `--reader-color-toolbar-bg` ← `--reader-toolbar-bg`
- `--reader-color-toolbar-border` ← `--reader-toolbar-border`
- `--reader-color-toolbar-text` ← `--reader-toolbar-text`
- `--reader-color-toolbar-muted` ← `--reader-toolbar-muted`
- `--reader-color-paper-bg` ← `--reader-paper`
- `--reader-color-paper-text` ← `--reader-paper-text`
- `--reader-color-paper-muted` ← `--reader-paper-muted`
- `--reader-color-paper-border` ← `--reader-paper-border`
- `--reader-color-paper-soft` ← current scoped `color-mix(...paper-text 6%, transparent)`

### Controls and states

- `--reader-color-control-bg` ← `--reader-control-bg`
- `--reader-color-control-border` ← `--reader-control-border`
- `--reader-color-control-text` ← `--reader-control-text`
- `--reader-color-control-selected-bg` ← `--reader-accent-soft` in light; `--reader-accent` in script/dark
- `--reader-color-control-selected-border` ← the same current selected fill
- `--reader-color-control-selected-text` ← `--reader-accent-strong` in light; literal `#0d1528` in script/dark
- `--reader-color-focus-ring` ← no dedicated current value; candidate alias must be introduced value-preservingly only where a ring already exists
- `--reader-color-control-disabled-text` ← no dedicated current color; disabled navigation currently uses opacity
- `--reader-opacity-control-disabled` ← current page-nav `.42` (side navigation uses `.2` and needs separate evaluation)

### Progress, bookmark, access and navigation

- `--reader-color-progress-track` ← current `color-mix(...toolbar-text 18%, transparent)`
- `--reader-color-progress-fill` ← `--reader-accent`
- `--reader-color-progress-text` ← `--reader-toolbar-muted`
- `--reader-color-bookmark` ← `--reader-bookmark`
- `--reader-color-bookmark-text` ← `--reader-accent-strong`
- `--reader-color-access-cta-bg`, `-border`, `-text` ← currently unresolved because preview CTA uses global `.artales-button`; reserve the roles but do not apply them in phase 3
- `--reader-color-navigation-bg`, `-border`, `-text`, `-muted` ← derived/current toolbar tokens

### Elevation and native controls

- `--reader-shadow-paper` ← `--reader-paper-shadow`
- `--reader-shadow-panel` ← raw settings-panel shadow
- `--reader-shadow-navigation` ← raw page/side navigation shadows
- `--reader-shadow-spread` ← raw spread sheet shadows and derived gutter inset
- `--reader-color-native-option-bg` ← `--reader-control-option-bg`
- `--reader-color-native-option-text` ← `--reader-control-text`
- `--reader-color-native-select-inset` ← raw `rgba(255,255,255,.14)`

Aliases for special renderer blocks are intentionally not finalized. Their
necessary granularity depends on representative content and computed-style
inspection; phase 2 records the boundary rather than inventing values.

## 5. Current value mapping

Every core proposed token below has a current source. All rows marked “yes” must
preserve computed values in phase 3. `L / S / D` means light / script / dark.

| Proposed token | Current source | Current L / S / D | Value-preserving in phase 3? | Expected consumers and contrast/readability note |
| --- | --- | --- | --- | --- |
| `--reader-color-viewport-bg` | `--reader-outer-bg` | existing theme gradients listed in §3 | Yes | Reader root/stage. Atmospheric only; do not judge as a prose pair. |
| `--reader-color-toolbar-bg` | `--reader-toolbar-bg` | `.9` warm white / `.86` brown / `.84` near-black | Yes | Sticky toolbar. Translucency must be measured over its actual backdrop. |
| `--reader-color-toolbar-border` | `--reader-toolbar-border` | dark `.12` / cream `.22` / cream `.18` | Yes | Toolbar boundary. Perceptibility is required but is not text contrast. |
| `--reader-color-toolbar-text` | `--reader-toolbar-text` | `#071226` / `#fff3d4` / `#fff8e7` | Yes | Title and primary chrome text; check translucent background combinations. |
| `--reader-color-toolbar-muted` | `--reader-toolbar-muted` | dark `.66` / cream `.72` / cream `.68` | Yes | Author and metadata. Small text needs measurement, not visual assumption. |
| `--reader-color-paper-bg` | `--reader-paper` | `#fffdf7` / `#f4e5c8` / `#111827` | Yes | All reading sheets. Comfort is assessed in sustained use. |
| `--reader-color-paper-text` | `--reader-paper-text` | `#17130f` / `#24180d` / `#f7ecd8` | Yes | Body prose and shared renderer text. Primary contrast pair. |
| `--reader-color-paper-muted` | `--reader-paper-muted` | `#6c6258` / `#6f553a` / warm white `.66` | Yes | Preview/annotation/page metadata. Measure smallest sizes separately. |
| `--reader-color-paper-border` | `--reader-paper-border` | brown `.22` / brown `.26` / cream `.18` | Yes | Paper and structural rules. Must not become high-salience decoration. |
| `--reader-color-paper-soft` | `color-mix(in srgb, paper-text 6%, transparent)` | computed per theme | Yes | Scoped shared-renderer `--artales-soft`; verify notes and other blocks. |
| `--reader-color-control-bg` | `--reader-control-bg` | white `.64` / cream `.09` / cream `.05` | Yes | Reader buttons/groups/selects. Test hover/underlay and toolbar blur. |
| `--reader-color-control-border` | `--reader-control-border` | dark `.16` / cream `.30` / cream `.28` | Yes | Control boundaries; focus cannot depend on this alone. |
| `--reader-color-control-text` | `--reader-control-text` | `#071226` / `#fff3d4` / `#fff8e7` | Yes | Control labels and select text. Test at 12px and zoom. |
| `--reader-color-control-selected-bg` | accent-soft (L), accent (S/D) | `#ead39b` / `#7e501a` / `#e7d4a0` | Yes | Primary link and pressed focus control. State also needs `aria-pressed`/shape. |
| `--reader-color-control-selected-border` | current selected background | same as selected background | Yes | Selected boundary; retaining same fill/border is intentional baseline only. |
| `--reader-color-control-selected-text` | accent-strong (L), literal (S/D) | `#6c4b18` / `#0d1528` / `#0d1528` | Yes | Selected labels. Literal capture is the purpose of the split. |
| `--reader-color-focus-ring` | no consistent dedicated source | not defined / not defined / not defined | N/A—define, do not apply | Keyboard focus. Phase 3 must not create a new visual ring; later state PR must measure it. |
| `--reader-color-progress-track` | mix of toolbar text at 18% | computed / computed / computed | Yes | Six-pixel track; non-text state must remain discernible. |
| `--reader-color-progress-fill` | `--reader-accent` | `#987331` / `#7e501a` / `#e7d4a0` | Yes | Progress fill only; appropriate restrained-gold candidate. |
| `--reader-color-progress-text` | `--reader-toolbar-muted` | dark `.66` / cream `.72` / cream `.68` | Yes | Small progress label; measure independently from author text. |
| `--reader-color-bookmark` | `--reader-bookmark` | `#a56d24` / `#7e341a` / `#d6a846` | Yes | Marker edge, dot and rule. Do not spread into prose. |
| `--reader-color-bookmark-text` | `--reader-accent-strong` | `#6c4b18` / `#4d2d0d` / `#f1d89d` | Yes | Marker label; assess against its derived translucent surface. |
| `--reader-color-navigation-bg` | toolbar bg mixed 88% for page nav; control bg for buttons; toolbar bg for side nav | computed/current per theme | Yes, with sub-role aliases if needed | Page/spread navigation containers. Avoid one alias masking distinct layers. |
| `--reader-color-navigation-border` | `--reader-toolbar-border` | same as toolbar border | Yes | Floating navigation boundary. Disabled controls need more than opacity. |
| `--reader-color-navigation-text` | toolbar/control text by element | current values above | Yes | Navigation buttons/status. Keep status muted separate. |
| `--reader-color-native-option-bg` | `--reader-control-option-bg` | `#fffaf0` / `#432b19` / `#111827` | Yes | Native option list; verify OS/browser rendering. |
| `--reader-color-native-option-text` | `--reader-control-text` | `#071226` / `#fff3d4` / `#fff8e7` | Yes | Native options. Forced colors and platform defaults may override it. |
| `--reader-color-native-select-inset` | raw literal | `rgba(255,255,255,.14)` / same / same | Yes | Closed select internal surface; its uniform literal may not be a final choice. |
| `--reader-shadow-paper` | `--reader-paper-shadow` | values in §3 | Yes | Base reading surface. Dark sustained reading should avoid glow. |
| `--reader-shadow-panel` | raw settings-panel shadow | `0 18px 45px rgba(13,21,40,.08)` in all themes | Yes | Settings panel. Later dark-specific adjustment requires measured evidence. |
| `--reader-shadow-navigation` | raw page/side-nav shadows plus dark override | light/script dark-ink shadows; dark black override | Yes | Floating page and side controls. Distinct page/side aliases are acceptable if required for equivalence. |
| `--reader-shadow-spread` | raw outer shadows plus border-derived inset; dark raw override | side-specific dark-ink / same / black + white inset | Yes | Open-book depth. No geometry or page behavior changes. |
| `--reader-color-access-cta-*` | global `.artales-button` cascade | depends on global theme, not reader theme | No application in phase 3 | Preview CTA. First capture cross-theme computed styles; resolve in a later access/control PR. |

The existing root fallback values must also be copied exactly when aliases are
implemented. No row authorizes changing a hex, alpha, gradient, mix percentage
or shadow.

## 6. Relationship to the ARTales brand palette

- **Paper:** reader paper may relate conceptually to approved ARTales Paper, but
  it must be comfort-tuned for long sessions and need not equal the public page
  Paper primitive. Public card/background values are not direct reader inputs.
- **Ink:** reader prose may relate to Ink, provided the paper/ink pair is measured
  in each reading mode. Body ink remains neutral and stable; it is not replaced
  by Gold.
- **Gold:** use only as restrained progress, focus, bookmark or small-control
  emphasis. It is not body text, a large paper fill, or a dominant toolbar fill.
- **Dark:** avoid pure-white glare, muddy low-contrast muted text, excessive glow
  and large bright-gold regions. Warm off-white is only a current baseline, not
  a claim of comfort or compliance.
- **Script/sepia:** preserve it as a purposeful reading mode with its own paper,
  ink and chrome relationships. It is not merely the public brand theme with a
  brown overlay.

Approved brand primitives may become documented sources during a later palette
phase, but only after reader-specific contrast and comfort review. The public
homepage palette must never be copied directly into reader selectors.

## 7. Shared renderer boundary

This PR does not rewrite `work-content-renderer.css`. Reader paper currently
adapts shared content by scoping `--artales-text`, `--artales-muted`,
`--artales-border` and `--artales-soft` to reader paper values. The proposed
paper text, muted, border and soft roles formalize that adapter without changing
it.

Later QA should inspect reader-scoped rendering of quotes, notes, dedications,
footnotes, classic-edition headings, image/caption treatments, tables and table
warnings. These blocks contain raw or global-dark assumptions identified by PR
#107. If overrides are necessary, place the minimum reader-scoped adapter rules
behind reader semantics; do not broadly retheme the shared stylesheet. Public
work-detail pages and every other `WorkContentRenderer` consumer must remain
unchanged. Shared renderer work should be a separate PR unless equivalence in a
reader-only alias pass is impossible without it.

## 8. Global theme boundary

The reader theme contract remains explicit and locally persisted as `light`,
`script` or `dark`. The global site theme remains separate. Therefore every
reader theme must be checked under both global light and global dark, especially
where shared renderer rules or global buttons cross the boundary.

This proposal does not add adaptive/system reader behavior and does not make
reader light follow the global setting. Any new setting, persistence migration,
system preference response or behavior change requires a separate PR.

## 9. Access/control state boundary

- The preview CTA currently risks global `.artales-button` palette leakage. The
  proposal reserves reader access-action roles but does not restyle or change
  the entitlement path.
- Bookmark, progress, focus and selected states require their own semantic roles.
  Gold can distinguish these small states, but state meaning must also remain in
  structure, labels, `aria-pressed`, position or progress geometry.
- Disabled page navigation currently uses opacity (`.42`; floating side controls
  use another opacity). A later control PR must verify text/icon discernibility
  and ensure disabled state is not communicated by color alone.
- Native selects and `<option>` elements require browser, OS, forced-colors and
  both global-theme combinations in QA. The option background cannot be assumed
  to control every native popup.
- Every keyboard-reachable control needs an obvious, persistent
  `:focus-visible` indication with adequate contrast against both control and
  surrounding surfaces. Current CSS does not provide one consistent reader-wide
  ring, so this proposal does not claim it does.

## 10. Contrast and QA targets

These are proposed targets and review gates, **not claims of current
compliance**. Measure computed colors against the actual composited background;
translucent layers require their real underlay.

| Area | Proposed target / comfort review |
| --- | --- |
| Body prose | At least WCAG AA normal-text contrast (4.5:1); additionally complete sustained-reading review at representative line length and 85/100/130% scale. |
| Muted prose and annotations | At least 4.5:1 when normal-sized; do not weaken it merely because it is “muted.” Test captions, notes and preview copy. |
| Toolbar text | Primary labels at least 4.5:1 on the composited toolbar; title truncation and blur must not obscure meaning. |
| Small progress text | Target at least 4.5:1 at its rendered 12px size; inspect start/middle/end and narrow widths. |
| Disabled controls | Preserve enough discernibility to identify the control and state; do not count disabled text toward an unsupported compliance claim, and require non-color/interaction cues. |
| Focus-visible | Target at least 3:1 contrast change against adjacent colors, a clearly visible perimeter, and no clipping/occlusion; verify keyboard-only navigation and forced colors. |
| Dark sustained reading | Avoid pure-white glare, muddy muted copy, glow and bright large surfaces; combine measurements with an extended reading session. |
| Script sustained reading | Preserve comfortable ink/paper separation without excessive brown-on-brown muddiness; assess prose, italics and annotations over time. |

Large-text exceptions should not be used to lower the normal prose or small
chrome target. Record measurement tooling, browser, computed values, alpha
compositing assumptions, font size/weight and failures in the implementation PR.

## 11. Recommended phase 3 implementation

The next code PR should be a **value-preserving reader alias pass**:

1. Add the mapped aliases at the reader root and explicit light/script/dark
   theme blocks, including the unthemed root fallback.
2. Point dedicated-reader consumers and remaining reader-only raw
   control/shadow values to those aliases without changing computed values.
3. Capture before/after computed values and screenshots for representative
   states; treat any visual delta as a regression, not palette progress.
4. Keep shared-renderer changes separate unless the alias pass demonstrably
   cannot remain reader-local.
5. Do **not** map the final brand palette, polish controls/access CTA, change
   mobile behavior, change typography/layout, or touch reader settings,
   pagination or parser behavior.

A focus token may be declared for the model, but phase 3 must not apply a new
ring where none exists; focus treatment belongs to the later state-polish PR.

## 12. Preview checklist

### Evidence

- [ ] Record exact preview SHA/URL, browser/OS, viewport, locale, auth state,
  global theme and reader theme.
- [ ] Use stable long-form fixtures containing chapters, long paragraphs,
  italics, quote, poem, letter/signature, separator, note, dedication, footnote,
  image/caption and table/warning; record missing block types.
- [ ] Capture before/after at the same hydrated position after fonts/images load;
  compare computed token values, not screenshots alone.

### Theme, access and settings matrix

- [ ] Reader light, script and dark.
- [ ] Global light and global dark crossed with every reader theme.
- [ ] Preview and entitled full mode; verify preview start/end CTA separately.
- [ ] Scroll, page and spread layouts.
- [ ] Comfortable and compact density.
- [ ] Narrow, normal and wide measure.
- [ ] Font scale 85%, 100% and 130%.
- [ ] Focus mode on/off.
- [ ] Bookmark absent/saved marker and go/update/clear actions.
- [ ] Progress at start, middle and end.
- [ ] Settings open/closed and each native select opened.
- [ ] First/last disabled navigation plus hover, active and focus-visible states.

### Responsive, locale and content fidelity

- [ ] 320px and 360px mobile widths, including zoom and browser chrome changes.
- [ ] Tablet portrait/landscape and desktop.
- [ ] Standalone PWA/safe areas where available.
- [ ] Czech and English labels.
- [ ] Shared-renderer special blocks: quotes, poetry, letters, notes,
  dedications, footnotes, classic headings, images/captions and tables/warnings.
- [ ] Page headers/footers, spread gutter, side navigation and bookmark marker do
  not overlap or obscure content.
- [ ] Keyboard order, focus visibility, forced colors where available and 200%
  zoom remain usable.
- [ ] Sustained dark and script reading sessions are recorded separately.
- [ ] Public work-detail and other shared-renderer pages show no visual delta.

## 13. Explicit non-scope

This proposal does not:

- change runtime CSS output or broadly edit reader selectors;
- map a final palette or copy the public homepage palette into the reader;
- alter reader settings persistence or introduce adaptive reader behavior;
- touch parser, table pagination, generated headers or pagination behavior;
- alter access, entitlement, commerce, membership or AT-credit logic;
- change copy or i18n;
- change public pages, shared renderer runtime CSS, components, routes or assets;
- change DB, environment variables or Supabase;
- change package files; or
- revive the cancelled **v0.10.15k — Table Pagination & Generated Header Fix**.

Delivery metadata: **Risk: low** (documentation only); **Target: develop
first**; **DB: no**; **Env: no**. Rollback is a revert of this documentation
commit; no runtime, data, asset, package or environment rollback is required.
