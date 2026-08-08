# ARTales visual refresh pipeline checklist v0.1

## How to use this checklist

Create one checked copy or tracked issue per refresh. Link evidence instead of
duplicating conclusions across PR notes. An unchecked box means **not proven**,
not “probably fine.” Mark every line pass, fail, not applicable, or waived with
an owner and reason. Runtime work remains `develop first`; preview approval does
not authorize a merge to `main`.

## Gate 0 — scope and safety

- [ ] Name one visual objective and the reader-facing problem it solves.
- [ ] List allowed files/surfaces and explicit non-goals.
- [ ] Confirm the branch starts from current `develop` and targets `develop`.
- [ ] Assign risk (`low` / `medium` / `high`), DB (`yes` / `no`), and Env
  (`yes` / `no`) before implementation.
- [ ] Identify protected domains: reader, editor, parser, payments, credits,
  membership, authentication, Supabase, and production configuration.
- [ ] If Reader is in scope, obtain explicit authorization and use a dedicated
  reader plan; do not revive cancelled v0.10.15k work.
- [ ] Write acceptance criteria, rollback, reviewers, and evidence location.

**Gate exit:** scope is reviewable without opening an implementation diff.

## Gate 1 — baseline inventory

### Route inventory

- [ ] List canonical routes and representative parameterized examples.
- [ ] Record public/protected status and shared shell/component ownership.
- [ ] Include home, gallery/catalog, work detail, author, collection, legal,
  empty/error/not-found, and any other affected public surfaces.
- [ ] Record auth-dependent variants without using production credentials.
- [ ] Map each route to required locale, viewport, theme, and interaction states.
- [ ] Flag redirects, dynamic data requirements, and unavailable fixtures.

Suggested row:

| Route/fixture | Surface owner | Auth | Locales | Themes | Viewports | States | Baseline evidence | Result/owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/example` | public shell | signed out | cs/en | light/dark/adaptive | mobile/desktop | default/focus | link | pending — owner |

### Token coverage

- [ ] Inventory semantic tokens used by affected selectors/components.
- [ ] Classify each visual value as semantic token, legacy alias, raw literal,
  derived alpha/gradient/shadow, or theme override.
- [ ] Record token definitions separately from consumption coverage.
- [ ] Identify aliases that change meaning under dark/adaptive theme cascades.
- [ ] Identify state colors and reader-owned tokens that must not be remapped.
- [ ] Set a coverage target and document justified exceptions; do not optimize a
  percentage by converting meaningful exceptions into the wrong token.

Suggested report fields: `file`, `line`, `selector_or_component`, `property`,
`value`, `classification`, `semantic_role`, `theme_scope`, `action`, `owner`.

### Asset provenance

- [ ] For each asset, record master, approved export, version, checksum, license
  or ownership basis, intended use, and approval status.
- [ ] Record runtime destination and every known consumer.
- [ ] Confirm light/dark variants and minimum-size purpose are intentional.
- [ ] Separate masters, approved exports, runtime copies, candidates, review
  boards, and legacy assets.
- [ ] Reject unknown-provenance or review-only files from runtime delivery.
- [ ] Verify approved-export/runtime-copy equality where exact copying is the
  delivery contract.
- [ ] Check favicon, manifest, service-worker, and installed-app references only
  when those assets are explicitly in scope.

**Gate exit:** route, token, and asset baselines are versioned or linked, and
unknowns are blockers or explicit exclusions.

## Gate 2 — proposal before implementation

- [ ] Provide a small surface/token/component mapping, not only a mood board.
- [ ] Show representative Czech and English production-length copy.
- [ ] Demonstrate light and dark usage; include adaptive behavior expectations.
- [ ] Define default, hover, focus-visible, active/current, disabled, loading,
  error, and empty states where relevant.
- [ ] Check text hierarchy, links, borders, icons, and actions for contrast and
  non-color cues.
- [ ] State which layout dimensions may change and where wrapping is expected.
- [ ] Confirm approved reusable components/tokens/assets are preferred over
  one-off CSS, raw colors, or new ad hoc assets.
- [ ] Obtain a named decision: approve, revise, or stop.

**Gate exit:** a reviewer can predict the intended route/state impact without
reading the final CSS cascade.

## Gate 3 — implementation controls

- [ ] Keep token definition, value mapping, asset delivery, and broad visual
  application in separable commits/PRs when they have different rollback paths.
- [ ] Scope selectors/components to the intended surface.
- [ ] Avoid changing shared defaults when an opt-in mode is safer.
- [ ] Do not alter copy, routes, application behavior, brand masters, or package
  files unless explicitly included.
- [ ] Preserve state semantics and keyboard focus.
- [ ] Record each intentional raw value or cascade exception.
- [ ] Add no reader selector/token changes to a public-only refresh.
- [ ] Run syntax/type/build checks appropriate to the files actually changed.
- [ ] Review the diff for unrelated formatting or generated-file churn.

## Gate 4 — preview screenshot checklist

### Capture contract

- [ ] Build/deploy the exact commit under review to the `develop` preview.
- [ ] Record commit SHA, preview URL, browser/version, date, and fixture source.
- [ ] Use stable viewport sizes and wait for fonts, images, hydration, and data.
- [ ] Disable incidental personal data; never capture secrets.
- [ ] Name or index every image by route, viewport, theme, locale, auth state,
  interaction state, and commit SHA.
- [ ] Keep before/after captures comparable in viewport, scroll position, data,
  and browser zoom.
- [ ] Record missing evidence as missing; do not substitute local screenshots
  silently for deployed-preview evidence.

### Minimum matrix

- [ ] Homepage: desktop and mobile, cs/en, light/dark/adaptive.
- [ ] Public header: full lockup, overflow/wrapping, current link, language and
  theme controls, signed-out and available signed-in action.
- [ ] Gallery/catalog: populated and empty states, card metadata and links.
- [ ] Work detail: short and long content, facts, author/collection prose, CTA,
  light/dark.
- [ ] A representative author/collection/community/resource surface if affected.
- [ ] Keyboard focus on navigation, links, controls, and primary/secondary CTA.
- [ ] Hover/active/disabled/loading/error states where the affected UI has them.
- [ ] Narrow width, common desktop width, and one intermediate wrap-prone width.
- [ ] Initial adaptive load and theme switch: no flash, clipping, or layout shift.
- [ ] Browser tab/install icon only if icon/PWA scope is authorized.

### Light/dark review

- [ ] Page, raised surface, muted surface, and inverse surface remain distinct.
- [ ] Primary, secondary, and muted text remain readable on every used surface.
- [ ] Links and focus indicators are visible without relying only on color.
- [ ] Gold remains an accent and does not reduce text/action readability.
- [ ] Images and logo variants match their background contract.
- [ ] Borders, shadows, gradients, transparency, and disabled states work in
  both themes rather than inheriting a light-only recipe.
- [ ] Adaptive/system mode is tested on initial load, not only after toggling.
- [ ] Theme persistence and browser back/forward behavior remain unchanged.

**Gate exit:** every required matrix row has evidence and a disposition.

## Gate 5 — release review

- [ ] Compare implementation against the agreed proposal and route inventory.
- [ ] Review computed outcomes, not only token names and source declarations.
- [ ] Run targeted accessibility checks and manual keyboard review.
- [ ] Confirm Czech and English wrapping at mobile and desktop widths.
- [ ] Confirm unaffected reader/internal surfaces are unchanged when the public
  shell shares any foundations with them.
- [ ] List failed, waived, unavailable, and not-run checks explicitly.
- [ ] Assign every follow-up; do not call the pass final while blockers remain.
- [ ] Prepare PR metadata: Summary, Changed files, Risk, Target, DB, Env,
  Rollback notes, test checklist, limitations, and preview evidence.
- [ ] Keep the PR target on `develop`; do not merge or promote automatically.

## Gate 6 — post-release audit and consolidation

- [ ] Verify the released commit/PR matches the reviewed artifact.
- [ ] Check top routes and theme switching for regressions after deployment.
- [ ] Record defects by missed matrix row, missing tooling, or implementation
  error so the process can change concretely.
- [ ] Re-run route/token/asset reports and review their diffs.
- [ ] Identify superseded overrides and one-off exceptions.
- [ ] If consolidation is warranted, open a separate output-preserving PR with
  fresh screenshots; do not mix cleanup with new visual decisions.
- [ ] Update this checklist only when a repeated failure suggests a reusable
  control, not for one-off ceremony.

## Tooling candidates (proposals, not current capabilities)

Tooling should fail clearly, emit diffable output, and avoid writing runtime
files by default. Start read-only; add executables only in separately reviewed
work.

| Candidate | Minimum useful input | Output | What it catches | Important limit |
| --- | --- | --- | --- | --- |
| Route inventory | App route tree plus a small reviewed fixture/config file | Markdown/JSON matrix of route patterns, owners, auth, fixture and states | Missing or newly added routes; incomplete screenshot matrix | Static discovery cannot prove runtime access or representative data. |
| Token coverage | CSS and component sources plus approved token prefixes | JSON/Markdown grouped by semantic token, alias, literal, derived value and theme override | Raw colors, unused tokens, legacy aliases, theme-specific exceptions | A high percentage does not prove correct semantics or visual quality. |
| Asset provenance | Brand manifest/registry, runtime references and files | Source/export/runtime graph with status, hashes and broken references | Unknown source, mismatched copies, candidate used at runtime, stale path | Hash equality proves identity, not approval, suitability, or license. |
| Light/dark checklist | Route matrix plus selector/token theme map | Coverage report of required themes/states with unresolved exceptions | Missing dark/adaptive rule or untested state | Static analysis cannot prove contrast, cascade outcome, flash, or persistence. |
| Preview screenshots | Preview URL, route fixtures, viewports, locales, themes and auth-safe states | Labeled image set, metadata, capture log and optional visual diff | Missing captures, layout drift, clipping, obvious visual regression | Diffs are evidence, not automatic design approval; dynamic content needs stabilization. |

### Recommended implementation order

1. Agree on shared route/state and evidence schemas.
2. Build a read-only route inventory and manually validate it.
3. Add token coverage with explicit classification and exception files.
4. Extend the existing brand registry/manifest workflow for provenance reporting.
5. Add screenshot capture only after fixtures and preview authentication are
   stable; otherwise automation will create noisy, misleading evidence.
6. Generate the light/dark checklist from the same matrix rather than creating
   a separate source of truth.

## Reader Visual System handoff

For the proposed **ARTales Reader Visual System**, clone the process, not the
public styles. Begin with a reader-only route/state/content inventory and a
reader-owned semantic token proposal. Require long-form fixtures, long-session
readability criteria, input/focus testing, overlays, theme persistence, and
responsive modes. Treat parser, tables, pagination, generated headers,
entitlements, and data behavior as separate explicitly authorized workstreams.

## Checklist delivery metadata

- **Risk:** `low` — documentation only.
- **Target:** `develop first`.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback:** revert the checklist documentation commit; no application,
  asset, data, package, cache, or environment rollback is needed.
