# ARTales color/style tokenization audit and proposal v0.1

- **Status:** audit/proposal only
- **Runtime impact:** none
- **Risk:** low — documentation and an unreferenced proposal artifact only
- **Target:** develop first
- **DB:** no
- **Env:** no

## Summary

ARTales already has recognizable visual conventions, but they are expressed through a mixture of global custom properties, thousands of lines of shared CSS, reader-local variables, direct color literals, inline styles, and a small Tailwind compatibility layer. This makes a palette change risky even when the desired brand colors are known.

This audit establishes a baseline before runtime work. It proposes semantic roles and a staged migration that first preserves every rendered value. It does **not** change CSS, Tailwind configuration, components, routes, theme behavior, assets, or generated brand material. The companion JSON is deliberately not imported by the application.

Key conclusions:

1. `app/globals.css` is both the closest thing to a design system and the largest concentration of visual literals. Its scope spans public, auth, account, member, editor, and admin UI, so it cannot safely be palette-swapped as one unit.
2. Reader/content styling is already partly isolated through `--reader-*` and `--artales-*` properties, but it has multiple reading themes and a separate rendered-content stylesheet. It should be migrated and validated independently.
3. Inline visual declarations are concentrated in editor/internal code, with smaller clusters in public catalog/work pages. They should be inventoried into roles before removal; broad dark-theme compatibility selectors currently compensate for some of them.
4. Tailwind v4 is imported, but color utility use is not the primary styling model. No runtime arbitrary hexadecimal color class such as `bg-[#...]` was found. Named color utilities appear mainly in compatibility selectors and a small number of component class strings.
5. Approved golds should identify the brand and actions, not replace semantic success/error/info colors or become low-contrast text on Paper.

## Current state

### Existing palette and theme layers

The root stylesheet currently defines a compact legacy palette (`--background`, `--foreground`, `--artales-ink`, `--artales-gold`, `--artales-paper`, muted, border, and shadow) near its top. Later light/dark theme blocks define a broader second layer, and many selectors still use literals rather than those properties. The current runtime center is warm paper (`#FBF5EA`), blue-black ink (`#0D1528`), and pale gold (`#D9B76E`), which do not directly match the approved palette below.

The HTML theme is selected through `data-artales-theme`, persisted in local storage and a cookie, and reflected through `color-scheme`. Light and dark `themeColor` values are independently declared in `app/layout.tsx` (`#F7EFE2` and `#0B0D10`). They are runtime values and are findings only in this PR.

Reader styling is a separate subsystem. `components/reader/reader.css` defines default, light, sepia, and dark groups using repeated `--reader-*` variables for outer canvas, toolbar, controls, paper, prose, border, shadow, accent, and bookmark. Rendered work content uses a smaller `--artales-*` set in `components/work/work-content-renderer.css`, with dark overrides. Those names are useful migration seams but are not yet aligned to a repository-wide semantic contract.

### Approved palette used as proposal input

| Brand source | Value | Proposed responsibility |
| --- | --- | --- |
| Ink/Night | `#0F1315` | inverse canvas and dark action text |
| Deep Dark | `#141414` | nested/deep inverse layer |
| Paper | `#FDF3E2` | page, surface, inverse text, reader candidate |
| Text Dark | `#272827` | readable light-theme text and alpha-derived borders |
| Primary Gold | `#E0AA47` | canonical accent and candidate primary action |
| Secondary Gold | `#E3AA46` | controlled alternate/highlight |
| Darker Gold | `#D19738` | gold hover/pressed state |
| Gold Shade | `#B58636` | derived muted accents and strong borders |
| Locked Symbol Gold | `#DCA645` | locked symbol contexts; candidate focus color |

The near-neighbor golds are **not** a license to use all five in ordinary component styling. Their roles must be narrow enough to prevent a new set of indistinguishable constants. Locked Symbol Gold does not authorize edits to brand masters or exported assets.

## Search method

The audit used repository-wide `rg`, `find`, and a read-only Python regex inventory. Runtime metrics below are scoped to text source files under `app/` and `components/` with extensions `.css`, `.ts`, `.tsx`, `.js`, and `.jsx`; binary assets, dependencies, Git metadata, public assets, brand exports, and historical documents were not included in those totals.

Search families:

- hex literals matching `#RGB`, `#RRGGBB`, or `#RRGGBBAA`;
- `rgb()`, `rgba()`, `hsl()`, and `hsla()` functions;
- CSS custom-property definitions and `var(--...)` uses;
- `style={{...}}` and inline `color`, background, border, outline, and shadow declarations;
- Tailwind-like `bg-*`, `text-*`, `border-*`, `ring-*`, `shadow-*`, `from-*`, `via-*`, and `to-*` classes, including bracketed arbitrary values;
- `theme-color` / `themeColor`, `data-artales-theme`, and color-scheme references;
- surface vocabulary and selectors for public, home, gallery, author, collection, work, reader, auth, account, member, admin, editor, prose/content, card, badge, button, header, footer, and navigation.

These are lexical counts, not a browser cascade analysis. A literal in a fallback, repeated theme block, selector compatibility rule, or inactive branch still counts. Function matches can include gradients' nested color functions, and a source occurrence does not equal a unique rendered color.

## Files and surfaces inspected

### Primary runtime surfaces

| Category | Routes/components/styles sampled | Styling observation |
| --- | --- | --- |
| Homepage | `app/page.tsx`, `components/public/PublicHeader.tsx`, home/public selectors in `app/globals.css` | Reusable semantic-looking class names, but their colors resolve through a mixture of properties and literals. Hero, feature cards, path cards, theme card, CTAs, and header need paired light/dark QA. |
| Public marketing/information | gallery/galerie, authors/autori, author/autor, collections/kolekce, credits, hall, roadmap, legal, checkout pages | Most share the public shell and global classes. Catalog/author/collection views also contain inline visual styles and therefore bypass some shared roles. |
| Work detail/catalog | `app/work`, `app/dilo`, `components/work/WorkDetailClient.tsx`, `WorkCoverImage.tsx` | Public and content concerns meet here. Covers, metadata chips, purchase/access cards, and reading entry points must not be migrated as a single generic card. |
| Reader shell | `app/reader/[slug]/page.tsx`, `ReaderClient.tsx`, `ReaderToolbar.tsx`, `ReaderWorkActions.tsx`, `reader.css` | Has four visual themes, reader-local controls, overlays, page/paper effects, and persistence. High readability risk. |
| Rendered prose/content | `WorkContentRenderer.tsx`, `work-content-renderer.css`, `WorkReaderOverlay.tsx` | Prose, tables, warnings, media, captions, print, and dark overrides form a distinct content contract. Database/content rendering is not part of token work without explicit review. |
| Auth/onboarding | login, register, forgot/reset password, onboarding, invite; auth selectors in `app/globals.css` | Visually centralized in auth shell/card/form classes. Focus, error, success, autofill, and disabled states require explicit checks. |
| Library/account | `app/account/**`, account navigation and card components, account selectors | Reader-adjacent but not reader prose. Includes membership, library, credits, community, settings, and status-heavy panels. |
| Member/admin/editor | `app/member/**`, editor/media components, admin dashboard/payments, member selectors | Dense internal UI and the main concentration of inline literals. Must be isolated from public palette alignment. |

### Generated/docs/brand tooling

Brand manifests, candidate boards, scripts, SVG sources, workflows, and export documentation contain color values that describe assets or generation inputs. They are evidence about the identity package, not a runtime token source. The approved palette supplied for this task is the proposal input; this audit does not rewrite any generator, manifest, master, or export.

### Historical material

Release notes, old audits, SQL documents, screenshots, archived candidates, and past visual specifications may contain colors that were correct for their time. They must remain historical records. Future automated reports should exclude `docs/**`, exported imagery, and archived/candidate brand directories unless the specific task is documentation archaeology.

## Hardcoded color findings

### Runtime lexical baseline

| Pattern | Occurrences | Unique normalized matches | Files | Main concentrations |
| --- | ---: | ---: | ---: | --- |
| Hex literals | 626 | 166 | 30 | `app/globals.css` 231; `WorkEditorForm.tsx` 75; `reader.css` 48; `WorkBlocksEditor.tsx` 39 |
| `rgb`/`rgba`/`hsl`/`hsla` functions | 622 | 308 | 19 | `app/globals.css` 432; `WorkEditorForm.tsx` 49; `reader.css` 43; `WorkBlocksEditor.tsx` 38 |
| CSS custom-property definitions | 139 | 44 names | 3 | `reader.css` 79; `app/globals.css` 52; content renderer 8 |
| CSS custom-property uses | 224 | 39 names | 5 | `app/globals.css` 119; `reader.css` 81; content renderer 19 |
| Inline visual declarations (approximate) | 424 | n/a | 27 | `WorkEditorForm.tsx` 109; `WorkBlocksEditor.tsx` 56; member edit forms; work/public detail views |

Frequent hex values demonstrate multiple visual dialects: editor defaults (`#CCC`, `#111`), light surfaces (`#FFFEFB`, `#FFF`, `#FFFDF8`, `#FFFAF0`), public brown text (`#5F5247`, `#3F362F`), current blue ink (`#0D1528`, `#071226`), and reader/Tailwind-like dark (`#111827`). Frequent alpha values are mostly many strengths of `rgba(13, 21, 40, ...)`, followed by pale gold and white overlays. This repeated alpha ramp is a strong candidate for derived semantic tokens rather than independent raw values.

No `hsl()`/`hsla()` family emerged as a meaningful styling convention; the function inventory is overwhelmingly RGB/RGBA. Eight-digit hex support was searched, but it is not a dominant runtime convention.

### Inline styles

Inline `style` objects mix layout and visual declarations. The highest-risk clusters are internal editor/media screens, where literal whites, grays, reds, borders, and shadows also interact with broad dark-theme attribute selectors. Public clusters occur in author and collection route files and in `WorkDetailClient`, `WorkCoverImage`, and `WorkReaderOverlay`.

Migration must split layout constants (spacing, dimensions, sticky positioning) from color roles. Replacing an entire `style` object just to tokenize one color would create unnecessary regression risk. Prefer a targeted CSS variable or reusable component role in later PRs.

### Gradients, shadows, borders, and opacity

Tokenization cannot stop at flat foreground/background pairs:

- public and account shells use layered radial/linear gradients;
- reader themes use distinct ambient canvases, translucent toolbars, paper borders, and large shadows;
- numerous borders repeat the same ink at different alpha levels;
- cards use many near-white fills to create elevation;
- shadows encode both depth and color, especially on inverse surfaces.

Later definition work should keep shadow/elevation and gradient recipes separate from the color-token proposal. Their color inputs can reference semantic tokens, but a gradient or shadow is not itself a color token.

## Tailwind and class findings

`app/globals.css` imports Tailwind v4 with `@import "tailwindcss"`; there is no separate Tailwind config in the inspected tree. The application primarily uses `artales-*` component/surface classes and inline styles rather than composing pages from Tailwind color utilities.

- No runtime arbitrary hex color utility (`bg-[#...]`, `text-[#...]`, `border-[#...]`, etc.) was found.
- Named utility selectors such as `.bg-white`, `.bg-stone-50`, `.text-slate-900`, `.text-blue-600`, and `.divide-y` appear in global dark-theme compatibility rules for member/account/admin descendants.
- Those compatibility selectors indicate that utility classes or generated/content-provided class names can enter dense internal surfaces even though direct route searches show little conventional Tailwind color composition.
- `shadow-*`, `ring-*`, and gradient utility classes are not a meaningful runtime color source in this snapshot; gradients and shadows are primarily authored as CSS declarations or inline values.

The absence of arbitrary color classes is good news, but it does not make a global search-and-replace safe. The broad `artales-*` stylesheet still couples many surface types, and the compatibility layer can mask inline or utility colors only in some theme/scope combinations.

## CSS variable findings

### Useful foundations

- Root-level `--background` / `--foreground` and early `--artales-*` variables already centralize a small subset of public colors.
- The reader has a coherent local variable family for each theme.
- Rendered content exposes text, muted, border, and soft-surface variables and maps them to reader variables when embedded.
- Later light/dark root blocks show that theme-specific variables are feasible without changing component APIs.

### Gaps

- Existing names mix raw palette (`gold`, `paper`, `ink`) and semantic intent (`background`, `foreground`, `muted`, `border`).
- The same variable name can be too broad for public, reader, and internal contexts.
- Many selectors bypass variables entirely.
- Multiple alphas of the same source color have no shared naming rule.
- Action, focus, state, and inverse roles are incomplete or encoded only in selectors.
- Reader-local names should remain aliases to reader semantics, not be collapsed into public page tokens.

Recommended architecture for a later definitions-only PR: primitive approved palette variables, semantic light/dark variables, then reader/internal aliases. Components should consume semantic roles; they should not consume `gold-2` or a brand master constant directly.

## Public vs reader vs admin separation

### Public / brand-facing UI

Includes homepage, public header/navigation, gallery/catalog, author, collection, work detail, credits/hall, roadmap/legal, and public checkout entry surfaces. This is the first candidate for approved-palette mapping **after** a value-preserving token pass. Priority roles are page/surface/inverse backgrounds, primary/secondary/inverse text, border, link, CTA, focus, and status.

### Reader / content experience

Includes reader canvas, toolbar, paper, prose, content blocks, captions, tables, media, selection, bookmark, overlays, and print behavior. Treat default/light/sepia/dark as separate theme matrices. Reader typography and background have high migration risk because a subtle change affects long-form comfort and may behave differently across displays. Do not infer that public Paper must immediately replace every reader paper.

### Admin / editor / internal UI

Includes member workspace, admin dashboards/payments, editors, media upload, author/tag/collection/work forms, parser-related panels, and dense tables. It contains the most inline visual literals and uses compatibility overrides for dark mode. Its semantic states and information density differ from marketing pages. Define an internal alias layer and migrate only after public foundations are stable; do not recolor it incidentally when public tokens change.

### Generated/docs/brand tooling

Keep generation palette inputs and asset specifications explicit and versioned. Runtime tokens may cite approved palette sources, but generated artifacts must continue to follow their own locked manifests and build workflows.

### Historical docs/assets

Exclude from runtime inventories and codemods. They should describe what existed, not silently update when the runtime system changes.

## Proposed semantic token map

The companion JSON is the authoritative machine-readable proposal. The table below is the review view. “Current fallback” is the value to preserve during Phase 2; it is representative where current UI has several contextual values.

| Token | Purpose | Proposed / source | Current fallback | Likely targets | Risk / readability note |
| --- | --- | --- | --- | --- | --- |
| `color.background.page` | light canvas | `#FDF3E2` Paper | `#FBF5EA` | home, public, auth | medium; large-area warmth shift |
| `color.background.surface` | raised surface | `#FDF3E2` Paper | `#FFFEFB` | cards, forms | medium; preserve elevation |
| `color.background.surfaceMuted` | quiet surface | derived Paper | `#F3EADC` | secondary panels | medium; define one tint recipe |
| `color.background.inverse` | dark brand canvas | `#0F1315` Ink/Night | `#0D1528` | hero, bands, dark theme | medium; validate gradients |
| `color.background.inverseDeep` | deepest inverse layer | `#141414` Deep Dark | `#090B0D` | overlays, nested dark cards | medium |
| `color.text.primary` | main light-theme text | `#272827` Text Dark | `#0D1528` | public/auth/account | medium; about 13.46:1 on Paper |
| `color.text.secondary` | supporting readable text | Text Dark derivative | `#5F5247` | descriptions, metadata | low |
| `color.text.muted` | tertiary text | Text Dark derivative | `#73685D` | labels, timestamps | medium; verify derived alpha |
| `color.text.inverse` | text on inverse | `#FDF3E2` Paper | `#FFF8E5` | dark surfaces | low; about 16.98:1 on Ink |
| `color.brand.gold` | canonical accent | `#E0AA47` Primary Gold | `#D9B76E` | brand, links, active | medium; not small text on Paper |
| `color.brand.goldSecondary` | controlled alternate | `#E3AA46` Secondary Gold | `#D9B76E` | brand-only accents | low; avoid decorative proliferation |
| `color.brand.goldHover` | gold interaction | `#D19738` Darker Gold | `#6F5424` | buttons, links | medium |
| `color.brand.goldMuted` | quiet gold accents | derived `#B58636` | gold at 14% alpha | badges, highlights | medium; solid is ~2.97:1 on Paper |
| `color.brand.symbol` | approved symbol analogue | `#DCA645` Locked Symbol Gold | `#D9B76E` | locked contexts | low; never rewrites assets |
| `color.border.subtle` | quiet divider | derived Text Dark | ink at 14% alpha | cards, nav, forms | low |
| `color.border.strong` | selected boundary | `#B58636` Gold Shade | gold at 44% alpha | selected controls | medium |
| `color.action.primary.bg` | main CTA fill | `#E0AA47` Primary Gold | `#0D1528` | public/auth CTA | high; hierarchy changes in Phase 3 |
| `color.action.primary.text` | CTA label | `#0F1315` Ink/Night | `#FFFFFF` | primary actions | high; Ink on Gold ~8.90:1 |
| `color.action.primary.hover` | CTA hover/pressed | `#D19738` Darker Gold | `#6F5424` | primary actions | high; validate complete state set |
| `color.action.secondary.bg` | quiet action fill | `#FDF3E2` Paper | white at 55% alpha | secondary controls | medium |
| `color.action.secondary.text` | quiet action label | `#272827` Text Dark | `#0D1528` | secondary controls | low |
| `color.reader.background` | reading paper | `#FDF3E2` Paper | `#FFFAF0` | reader/content preview | high; theme-by-theme QA |
| `color.reader.text` | long-form body | `#272827` Text Dark | `#17130F` | prose | high; reading comfort |
| `color.reader.muted` | reader metadata | Text Dark derivative | `#6C6258` | captions/toolbars | high |
| `color.reader.selection` | selected/highlight fill | derived `#E3AA46` | `#EAD39B` | selection/highlight | high; test selected text |
| `color.focus.ring` | keyboard focus | `#DCA645` candidate | brown at 32% alpha | all interactive UI | medium; needs light/dark halo test |
| `color.state.success` | successful status | retain `#2F6A3A` | same | forms/account/admin | low; icon/text too |
| `color.state.warning` | caution/pending | retain `#8A641F` | same | forms/checkout/admin | medium; distinguish brand gold |
| `color.state.error` | error/destructive | retain `#7A1F1F` | same | forms/admin | low; do not brand-gold errors |
| `color.state.info` | informational state | retain `#40537A` | same | notices/admin | low |

Contrast figures are simple sRGB calculations for opaque pairs and are screening data, not an accessibility sign-off. Paper-colored text on Primary Gold is only about 1.91:1, so a future gold button must use Ink/Night or Text Dark. State colors need separate subtle-background, border, and text variants rather than one value being used in every context.

## Migration strategy

### Phase 1 — definitions only, no visual change

1. Add primitive and semantic definitions in a dedicated runtime PR.
2. Assign semantic tokens their **current rendered values**, including light/dark variants.
3. Define ownership and naming rules; do not import this proposal JSON into runtime as a shortcut.
4. Add a small static validation for duplicate/missing token definitions and document browser support.

Exit condition: computed screenshots and focused CSS checks show no intended visual change.

### Phase 2 — replace literals while preserving current visuals

1. Start with public shell/header, buttons, cards, and auth controls.
2. Replace one semantic cluster per PR; preserve current fallbacks exactly.
3. Extract public inline colors without rewriting unrelated layout styles.
4. Handle internal/editor inline literals in a separate stream and keep reader aliases isolated.

Exit condition: hardcoded counts decline, computed values remain stable, and light/dark behavior is unchanged.

### Phase 3 — map selected public tokens to approved palette

1. Map page, inverse, text, border, brand accent, and selected public actions.
2. Review gold hierarchy and all interactive states together.
3. Do not automatically map reader or internal aliases when public semantics change.
4. Record approved before/after evidence at desktop and mobile widths.

Exit condition: product owner approves public preview; no reader/admin collateral change.

### Phase 4 — visual QA by surface

Run separate matrices for homepage/public, catalog/work detail, reader themes/content, auth/onboarding, account/library, and admin/editor. Each matrix must cover light/dark where supported; hover, active, focus-visible, disabled, error, success, empty, loading; mobile/desktop; and contrast/readability.

### Phase 5 — homepage and key public-page polish

Only after semantic mapping is stable, refine hierarchy, gradients, elevations, and spacing on homepage and highest-traffic public routes. Tokenization should make this polish controlled, not turn the token PR into a redesign.

## Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| Global variable swap recolors unrelated surfaces | high | value-preserving aliases first; public/reader/internal namespaces |
| Reader fatigue or lost theme distinctions | high | defer reader palette mapping; test every reader theme and long-form content |
| Gold CTA with light label fails contrast | high | pair Primary Gold with Ink/Night; verify all states |
| Dark mode relies on broad overrides for inline/utility styles | high | migrate scoped clusters, inspect computed styles, do not remove compatibility rules early |
| Near-duplicate gold tokens proliferate | medium | narrow roles; keep Secondary/Symbol values brand-specific |
| Muted text/borders become too faint | medium | test derived alpha on actual translucent and gradient backgrounds |
| Status colors lose meaning when “branded” | medium | retain conventional state hues and non-color cues |
| Historical/generated values contaminate metrics | low | scope inventories to runtime sources and maintain explicit exclusions |
| One giant shared stylesheet complicates ownership | medium | incremental surface-oriented PRs, no opportunistic stylesheet refactor |

## Areas to avoid changing first

- Reader typography, paper/background, selection, pagination/page effects, and toolbar theme values.
- Rendered prose/table/media behavior and any database/content-rendering assumptions.
- Admin/editor dense UI, parser panels, forms, and compatibility selectors unless isolated in an internal-only PR.
- Generated brand boards, workflow inputs, locked masters, exports, icons, and registry artifacts.
- Historical documents, screenshots, candidates, and prior release records.
- Theme-color, manifest, favicon, and service-worker values as a side effect of CSS tokenization.
- State colors simply to make them gold; semantic recognition takes precedence over palette uniformity.

## Recommended next PRs

1. **Token contract and current-value definitions:** add runtime semantic variables with current light/dark values only; include a mapping document and no intentional screenshots differences.
2. **Public shell/header/button value-preserving adoption:** migrate shared navigation and action roles without palette remapping.
3. **Homepage/public cards value-preserving adoption:** cover home hero, cards, public information pages, and focus states.
4. **Catalog/work-detail inline-color extraction:** isolate authors, collections, covers, work metadata, and access panels; do not touch reader content.
5. **Approved-palette public mapping:** map the reviewed public token subset and perform screenshot/contrast QA.
6. **Auth/onboarding adoption and QA:** migrate form states, autofill, focus, error, and success separately.
7. **Reader token study:** document all four reader themes and rendered-content roles before any visual mapping.
8. **Internal UI inventory/adoption:** address member/admin/editor only after public tokens are stable.

Each implementation PR should state whether it is value-preserving or palette-mapping. Combining the two makes regressions and review decisions unnecessarily difficult.

## Explicit non-scope

This PR intentionally does not change:

- application runtime styling, component code, route code, or runtime CSS;
- Tailwind configuration or package dependencies;
- `app/layout.tsx`, theme selection, browser theme-color, or color-scheme behavior;
- reader, editor, parser, payment, AT credit, membership, or Supabase logic;
- database schema/data, SQL migrations, environment variables, or deployment configuration;
- public icons, favicons, manifest, service worker, cached assets, or other public assets;
- brand masters, exports, generation scripts/workflows, registry state, or locked identity artifacts;
- historical documentation or assets.

## Validation and rollback

Validation for this audit is limited to JSON parsing, Markdown/content review, allowed-file scope, and Git whitespace checks. A runtime build or screenshot is not required because no imported/runtime file changes. The follow-up definitions PR must establish the visual baseline and browser validation.

Rollback is a revert of this documentation/proposal commit. There are no runtime, database, environment, generated-asset, or irreversible steps.

### Test checklist

- [x] Proposal JSON parses.
- [x] Search inventory covers requested literal, function, custom-property, inline-style, theme, utility, prose/reader/editor, and surface families.
- [x] Public, reader/content, admin/internal, generated/tooling, and historical categories are separate.
- [x] Every proposed token records purpose, proposal/source, current fallback, target surfaces, risk, and readability note.
- [x] Changed paths are restricted to the allowed audit/proposal files.
- [x] No runtime file, public asset, brand master/export, DB, Env, or Supabase file changed.
- [x] `git diff --check` passes.
- [ ] Runtime visual QA — intentionally not run; there is no runtime change.
