# ARTales internal/admin/member zone visual refresh audit v0.1

## 1. Summary

This document is an **audit-only** baseline for a later visual refresh of the authenticated account, member, contributor, editorial, and admin surfaces. It maps the current routes, shared components, visual primitives, risks, and a safe migration order. It makes **no runtime, CSS, route, component, copy, asset, database, environment, parser, or Reader change**.

The intended direction is a calm, readable, editorial, and trustworthy internal zone that remains more functional than the public site. Operational clarity takes priority over ornament. Gold should identify focus, key actions, and selected or important states rather than fill large surfaces. Czech remains the default language of editorial/admin UI unless the existing localization boundary says otherwise.

Audit risk is **low** because this change is documentation-only. A future visual implementation should be treated as at least medium risk: several screens combine presentation, permissions, mutations, payments/credits, and editorial data entry in the same files.

### Scope boundary

- `app/admin/**`, `app/members/**`, `components/admin/**`, `components/members/**`, `components/ui/**`, and `components/layout/**` do not exist in the audited tree.
- Admin screens live below `app/member/admin/**`; contributor/editor screens live below `app/member/**`.
- Account and membership surfaces live below `app/account/**`. Authentication UI is implemented as top-level login/registration/recovery/onboarding/invitation routes; `app/auth/callback/route.ts` is a non-visual callback.
- Public `/collections`, `/collections/[slug]`, `/kolekce/[slug]`, and `/credits` were checked as boundaries, not included as internal migration targets. They use the public shell or redirect and must not be pulled into an internal-zone implementation PR.
- Checkout routes are adjacent to credits and payment workflows but are not internal shell routes. They should only be visually reviewed at the boundary when an account/admin implementation touches links or state hand-offs; they are not proposed migration targets here.

## 2. Route inventory

Risk describes the risk of a later visual edit, not this documentation PR. **High** marks screens where misleading hierarchy, lost state, or accidental changes around permissions, credits, security, destructive actions, or editorial mutation could damage a workflow.

### Account/member-facing routes

| Route | Purpose inferred from code | Visual entry points | Risk |
| --- | --- | --- | --- |
| `/account` | Authenticated account overview, reading/credit summary, shortcuts, logout | account shell/sidebar, hero, stat cards, action groups | medium |
| `/account/library` | Continue-reading, unlocked/saved works, library empty states | hero, cover cards, badges, grids, empty states | medium |
| `/account/credits` | Credit balance, purchases/manual payments, ledger, gifts and patronage progress | summary hero, payment cards, ledger rows, forms, progress meter, archived-scroll region | high |
| `/account/credit-unlock/[slug]` | Confirm or report a credit-based work unlock | notice, selected-work panel, success/decision actions | high |
| `/account/unlock/[slug]` | Confirm the one-time welcome unlock | notice, selected-work panel, irreversible decision actions | high |
| `/account/membership` | Explain membership/credit model and activate tier-related actions | promo hero, tier cards, badges, feature lists, activation form | high |
| `/account/profile` | Edit display name, handle, and profile details | narrow form, alert/success state, submit action | medium |
| `/account/security` | Change password and request reset e-mail | security forms, success/error messages, key actions | high |
| `/account/settings` | Site theme and Reader preference settings | theme card, selects, checkbox, form state | medium |
| `/account/community` | Followed authors and reader feedback/activity summary | stat cards, lists, pills, empty states, unfollow action | medium |

### Contributor/editor/member routes

| Route | Purpose inferred from code | Visual entry points | Risk |
| --- | --- | --- | --- |
| `/member` | Role-aware internal-zone landing page and tool launcher | member shell/sidebar, overview panels, role-gated links, logout | medium |
| `/member/works` | List and search/manage editorial works | search/filter controls, result cards, status metadata, edit links | high |
| `/member/works/new` | Create a work through the shared work editor | large multi-section editor, upload/content controls, save actions | high |
| `/member/works/[slug]/edit` | Edit an existing work and its content | shared editor, current data/loading, destructive/content mutation affordances | high |
| `/member/authors` | List/search authors | filter control, author cards/portraits, edit links | medium |
| `/member/authors/new` | Create an author with localized metadata and portrait | long inline-styled form, upload, grouped metadata | high |
| `/member/authors/[slug]/edit` | Edit an author; includes not-found state | long inline-styled form, upload, grouped metadata, missing-record state | high |
| `/member/collections` | List/search editorial collections | filter control, collection cards, publication metadata | medium |
| `/member/collections/new` | Create collection, public texts, visual, and publication state | long form, selects, upload, grouped panels | high |
| `/member/collections/[slug]/edit` | Edit collection and assign works | long form, upload, work-assignment checkboxes, publication controls | high |
| `/member/tags` | Grouped tag inventory | grouped cards, counts, edit/create links | medium |
| `/member/tags/new` | Create a categorized tag | form, category select, action buttons | medium |
| `/member/tags/[slug]/edit` | Edit a tag | form, category select, action buttons | medium |
| `/member/submissions` | Triage contributor submissions and perform permitted reviews | filters/status summaries, submission cards, review forms/actions | high |
| `/member/submissions/new` | Submit a new contribution | long submission form, notices, primary action | high |
| `/member/invites` | Create role-limited invitations and revoke recent invitations | role cards, form/selects, invite list, revoke action | high |
| `/member/entitlements` | Request, grant, approve, or reject online-reading access | role-dependent panels, forms, notices, pending list, approve/reject actions | high |
| `/member/community` | Editorial triage of reader feedback | summary cards, data table, new-state badge, acknowledge action, empty state | high |
| `/member/resources` | Internal editorial standards, prompts, and parser guidance | resource hero/index, documentation cards, copyable prompt block | medium |

### Admin routes

| Route | Purpose inferred from code | Visual entry points | Risk |
| --- | --- | --- | --- |
| `/member/admin/dashboard` | Admin analytics, accounting summaries, recent purchase data, CSV link | metric cards, range control, panels, data table, export action | high |
| `/member/admin/dashboard/export` | Permission-checked CSV response; no page UI | link affordance and error expectations only | high |
| `/member/admin/payments` | Filter and fulfill/cancel manual QR orders | state tabs, stat cards, order cards, flags, pagination, fulfill/cancel actions | high |

### Authentication/account-entry routes

| Route | Purpose inferred from code | Visual entry points | Risk |
| --- | --- | --- | --- |
| `/login` | Sign in and show authentication outcome | auth shell/card, brand lockup, inputs, error/success states, links | high |
| `/register` | Create a reader account | auth shell/card, form, validation state, primary action | high |
| `/forgot-password` | Request a reset e-mail | auth shell/card, form, sent/error state | high |
| `/reset-password` | Set a new password | auth shell/card, password fields, validation state | high |
| `/onboarding` | Complete required identity/profile data | auth shell/card, fields, select, validation state | high |
| `/invite/[token]` | Validate and accept an internal invitation | auth shell/card, invalid/expired state, identity/password form, role context | high |
| `/auth/callback` | Server callback/redirect with no visual surface | redirect/error destination consistency only | high |

No route-local `loading.tsx`, `error.tsx`, or `not-found.tsx` was found under `app/account/**` or `app/member/**`. Empty and result states are generally rendered inline; unexpected failures therefore inherit the root framework behavior rather than an internal-zone visual state.

## 3. Component inventory

### Shell, navigation, and brand

| Component/file | Used by | Current role and audit note |
| --- | --- | --- |
| `app/account/layout.tsx` | all `/account/**` routes | Composes `PublicHeader`, an embedded account shell, `AccountNav`, and account content. This creates a public/internal coupling that should be preserved initially and assessed separately from palette work. |
| `components/account/AccountNav.tsx` | account layout | Brand lockup, localized account links, permission-gated member-zone link, and public-gallery escape. It has no pathname-based active state. |
| `app/member/layout.tsx` | all `/member/**` pages | Enforces member access and composes `PublicHeader`, member shell, sidebar, and content. |
| `components/member/MemberZoneNav.tsx` | member layout | Client-side active path, internal dictionary for some labels, hard-coded Czech labels for others, creation links, account/gallery exits. It lists admin destinations even though destination guards enforce access; permission visibility needs workflow review, not a visual-only change. |
| `components/public/PublicHeader.tsx` | account/member layouts | Shared public header embedded above both internal shells. Rebranding it in an internal PR would cross into public scope; internal aliases should not override its public semantics. |
| `components/brand/ArtalesBrand.tsx` | both sidebars and all auth cards | Approved runtime brand component; current sidebars/auth screens request the `light` variant. Validate contrast on any new internal surface rather than generating/replacing assets. |

### Shared workflow components

| Component | Route relationship | Visual concerns |
| --- | --- | --- |
| `components/editor/WorkEditorForm.tsx` | work create/edit | Very large stateful form with extensive inline styles and color literals, metadata, cover/content flows, save controls, and client behavior. Highest-risk visual migration target. |
| `components/editor/WorkBlocksEditor.tsx` | nested in `WorkEditorForm` | Block selection/reordering/editing and media controls; extensive inline style/color use makes states difficult to inventory by selector alone. Keep entirely out of early token PRs. |
| `components/media/EditorialImageUploadField.tsx` | author and collection create/edit; editor-related media | Upload progress/error/preview/removal UI with inline styling and literals. State contrast and button hierarchy are operationally important. |
| `components/media/StorageImageDisplay.tsx` | media/editor and author/collection presentations | Shared image frame, placeholder, fallback brand mark, and loading/error behavior. |
| `components/member/ResourcePromptBlock.tsx` | `/member/resources` | Client copy control and prompt presentation; isolated, lower-risk internal component. |

### Adjacent shared components and boundaries

- `components/checkout/SubmitOnceButton.tsx` is used in adjacent checkout/payment flows, not as the internal shell's generic button. Do not turn it into a general internal primitive during this audit follow-up.
- `components/community/AuthorFollowPanel.tsx` and `WorkFeedbackPanel.tsx` are public work/author interaction components. Account/member community pages render their own summaries and triage UI.
- There is no shared generic `Card`, `FormField`, `Table`, `Badge`, `Dialog`, `Modal`, `EmptyState`, `ErrorState`, or `LoadingState` component in the inspected internal areas. Repetition is primarily coordinated by global `artales-account-*`, `artales-member-*`, and `artales-admin-*` selectors, with many route-local inline styles.
- No internal modal/dialog component or modal usage was found. Confirmation-sensitive actions currently rely on page/form hierarchy rather than a shared confirmation visual primitive.

## 4. Current visual architecture

### Layout and hierarchy

The root `app/layout.tsx` loads the single `app/globals.css`, applies theme state on `<html>`, and establishes global metadata and viewport colors. Both authenticated shells then embed `PublicHeader` above a two-column internal layout. Account and member zones have separate sidebar/navigation class families but share the same global cascade, base color aliases, typography, buttons, and responsive file.

There are four overlapping visual layers:

1. Root semantic variables such as `--artales-color-background-*`, `--artales-color-text-*`, `--artales-color-brand-gold*`, `--artales-color-border-*`, action, focus, and state colors.
2. Legacy/global aliases such as `--artales-ink`, `--artales-paper`, `--artales-gold`, `--artales-muted`, `--artales-border`, and `--artales-shadow`.
3. Early selector blocks for buttons, member/auth/account shells, member forms/notices, admin dashboard/tables, resources, editor/media, and admin payments. Many declarations use literal colors or legacy aliases.
4. Later light/dark theme override and semantic-cleanup blocks. These restyle broad selectors and sometimes use `!important`, so actual appearance depends on source order and selector specificity rather than one authoritative internal token layer.

### Forms, tables, buttons, and states

- Account/auth/member forms have class-family styling in `app/globals.css`; editorial author/collection/tag/list pages additionally construct layout and control appearance with inline style objects.
- Work editing is effectively its own inline visual system inside the two editor components.
- Buttons use overlapping `artales-button`, `artales-button-primary`, `artales-button-secondary`, `artales-button-muted`, accent, and danger variants. The semantic difference between `artales-button` and `artales-button-primary` is not self-evident.
- Admin/community tables use `artales-admin-table` and an overflow wrapper. Other inventories use cards rather than a shared table/data-grid pattern.
- Status is expressed through account/member notices, badges, muted text, payment flags, active tabs, new-row classes, and ad hoc card metadata. There is no unified status vocabulary mapping business states to presentation.
- Empty states are mostly inline conditional sections/cards. Loading/error route boundaries are absent. Image loading/failure is localized in `StorageImageDisplay`.
- No Tailwind configuration or Tailwind utility usage was found in the audited surfaces. Class literals are bespoke global CSS names; dynamic class composition is used for active nav, notices, payment states, and editor placement.

### Relationship to existing ARTales semantic tokens

The root semantic palette is a useful value source, and later public/Reader work demonstrates a value-preserving alias-first migration. It is not yet an internal semantic contract. Internal selectors still consume broad public/global aliases and literals; global light/dark alias redefinitions can therefore change internal screens indirectly.

Public tokens should **not** be reused directly when the meaning differs:

- Public hero, gallery/card, launch, header, work-detail, author, and decorative glow/surface tokens should not define operational panels, filters, or tables.
- Reader canvas/page/paper, toolbar, selection, progress, and longform text tokens should remain Reader-only. Reader paper is a reading substrate, not an admin form or table surface.
- Public gold/glow treatments and oversized editorial display hierarchy should not be copied into dense admin UI.
- Generic root values may seed internal aliases, but internal selectors should consume `--artales-internal-*` semantics so public/Reader tuning cannot silently alter workflow contrast.

## 5. Raw visual usage

### Reproducible snapshot

Counts below are literal-occurrence counts, not unique colors. They intentionally expose migration size; they do not claim every occurrence is rendered (some are input defaults or conditional branches).

The scoped scan covered 66 TypeScript/TSX files under `app/account`, `app/member`, the six auth/entry route folders, and `components/account`, `components/member`, `components/editor`, and `components/media`:

| Usage | Occurrences | Concentration |
| --- | ---: | --- |
| Hex literals | 285 | 75 in `WorkEditorForm`, 39 in `WorkBlocksEditor`, 24 in collection edit, 22 in author edit, 20 in author create; also list/form pages |
| `rgb()` / `rgba()` literals | 103 | 49 in `WorkEditorForm`, 38 in `WorkBlocksEditor`; smaller counts in list pages and uploads |
| `hsl()` / `hsla()` literals | 0 | none found in scoped TS/TSX |
| `style={{...}}` openings | 652 | 162 in `WorkEditorForm`, 90 in `WorkBlocksEditor`, 55/51 in author create/edit, 45 in collection edit |

`app/globals.css` as a whole contains 243 hex literals, 431 `rgb()`/`rgba()` occurrences, no HSL literals, and 261 `var(--...)` references. Because all application surfaces share this 6,605-line file, those whole-file counts are context rather than an internal-only total. Approximate internal selector regions are fragmented: the first 1,100 lines contain the main shell/auth/account/member definitions (74 hex, 99 RGB/A, 45 variable references); separate admin dashboard, resources, admin payments, theme override, and late semantic override regions add further declarations.

### Legacy tokens and cascade risks

- Internal selectors commonly consume `--artales-ink`, `--artales-gold`, `--artales-gold-soft`, `--artales-paper`, `--artales-paper-warm`, `--artales-muted`, `--artales-border`, and shadow aliases rather than an internal namespace.
- Light/dark theme blocks redefine those legacy aliases. Later semantic selector overrides coexist with earlier literals, producing a source-order/specificity dependency.
- Raw values occur both in CSS and TSX inline objects; CSS token additions alone will not reach the editorial editor/forms until inline styling is deliberately migrated.
- Dynamic notices (`artales-member-notice--${notice.type}`), active tabs/nav, cancelled payment cards, new feedback rows, and danger button combinations must be catalogued as state matrices before selector replacement.
- Several route pages use repeated inline grids, padding, typography, borders, backgrounds, radii, and responsive-unaware fixed layout values. This is the clearest token/component gap outside the editor.

### Legacy brand/assets

No ad hoc legacy logo file reference was found in the scoped internal/auth shells. They use `ArtalesBrand`, and `StorageImageDisplay` uses that component as a fallback. The audit did find repeated `variant="light"` brand usage on sidebar/auth contexts; contrast must be verified if surfaces change. Keep the approved component and manifest-managed assets; do not generate a new admin logo or copy public asset files.

## 6. Internal semantic token needs

Use a dedicated namespace (illustrative names below) whose initial values alias the current computed values. Token definition and selector consumption should be separate reviewable steps.

### Foundation and surfaces

- `--artales-internal-shell-bg`
- `--artales-internal-surface`
- `--artales-internal-surface-muted`
- `--artales-internal-surface-elevated`
- `--artales-internal-border-subtle`
- `--artales-internal-border-strong`
- `--artales-internal-text-primary`
- `--artales-internal-text-muted`
- `--artales-internal-text-subtle`
- `--artales-internal-text-inverse`
- `--artales-internal-accent` and `--artales-internal-accent-hover`

Gold should remain a restrained accent for focus, active navigation, key status, and selected key actions. It should not become the shell, table body, form field, or full-card background.

### Forms and actions

- form background, border, text, placeholder, disabled, invalid, and focus-ring tokens;
- primary, secondary, quiet, destructive, disabled, and busy action background/border/text tokens;
- checkbox/radio/select affordance and upload drop-zone/preview/error tokens;
- explicit keyboard focus tokens that remain visible in both themes and do not rely on color alone.

### Tables and dense operational data

- table header background/text;
- row background, alternate/hover/selected/new/cancelled states;
- row and outer borders;
- sortable/filter-active affordance;
- numeric and metadata text;
- overflow edge/shadow cue for narrow screens.

### Status and workflow semantics

- success, warning, danger, and info foreground/background/border triplets;
- neutral, draft, pending, published/complete, cancelled/rejected, and attention badge triplets;
- nav default/hover/active text, background, and indicator;
- validation error, saved/success, and loading/progress semantics.

Business statuses should map through a documented presentation map, not be inferred from a convenient palette. Text/icon/state labels must remain available so color is never the sole signal.

### Overlay and elevation

- modal/backdrop, modal surface/border, and focus containment tokens for future confirmation UI;
- low/medium/high internal shadows with restrained opacity;
- sticky sidebar/header edge and horizontal-overflow cues.

No modal exists today; these tokens should only be added when a reviewed internal dialog primitive exists, not speculatively wired into destructive flows.

## 7. Risk areas

### Workflow and business-logic coupling

1. **Credits, membership, unlock, and admin payments:** presentation surrounds balance, fulfillment, cancellation, entitlement, and irreversible/financial state. A visual PR must not alter actions, hidden inputs, query parameters, enabled conditions, status mapping, or confirmation semantics.
2. **Role and permission UI:** guards (`requireMemberZoneAccess`, `requireEditorOrAdmin`, `requireInviteManager`, `requireAdmin`) and conditional render paths decide access. Styling must not hide an important restriction, imply access a user lacks, or expose a control by changing rendering logic.
3. **Work/author/collection editors:** long forms mix presentation with upload, localization, publication status, assignments, and editor state. Broad mechanical replacement is unsafe. Preserve field order, labels, values, focus behavior, and save placement.
4. **Submissions, entitlements, community triage:** approve/reject/acknowledge controls need unambiguous state and separation. Destructive/reject actions require more than a gold/neutral distinction.
5. **Admin dashboard/table/export:** numeric readability, column association, range state, and export affordance are operational requirements. Do not turn dense data into decorative cards without evidence.
6. **Auth/security/invitation:** error, success, expired invitation, password requirements, and primary submit states must retain high contrast and clear reading order.

### Forms and clarity

- Placeholder, label, helper, validation, disabled, and saved states lack one common semantic contract.
- Inline-styled controls can diverge between light/dark themes and from CSS focus treatment.
- The two editor components dominate raw literals/inline styles and should be migrated only after simpler form patterns are proven.
- Upload states and image fallbacks need explicit keyboard, progress, error, and removal QA.

### Tables, badges, and destructive actions

- Community/admin tables need sticky/scroll cues, focus visibility, numeric alignment, header contrast, and row-state testing.
- Badges/flags currently represent heterogeneous concepts (membership, counts, new feedback, user-reported paid, cancelled/reversed). A single gold badge treatment would erase severity and meaning.
- `artales-button`, `artales-button-primary`, and secondary/danger combinations need a documented hierarchy before visual convergence.

### Low-risk first targets

- Value-preserving internal token definitions with no selector changes.
- Shell, content background, passive panel/card, border, and text aliases after computed-value snapshots.
- Resource page cards/index and passive account/member overview cards.
- Navigation hover/active mapping only after adding/confirming account active-state behavior as a separate, explicitly scoped decision; do not combine visibility/permission changes.

## 8. Recommended migration phases

### Phase 1 — audit/proposal

- Accept this route/component/state inventory.
- Capture desktop/mobile and light/dark baselines for representative account, member, admin, auth, table, and long-form pages.
- Record computed values and state matrices; confirm role fixtures/test accounts.
- Track the Reader mobile page/spread layout problem separately.

### Phase 2 — value-preserving internal semantic tokens

- Define internal foundation, surface, border, text, accent, form, table, status, nav, and elevation aliases in `app/globals.css`.
- Alias current computed values; do not consume the new tokens, change selectors, or alter appearance in the same smallest PR.
- Document light/dark mappings and forbid direct dependencies on public decorative or Reader tokens.

### Phase 3 — shell/nav/card palette mapping

- Migrate account/member shell, sidebars, content, passive panels/cards, and resource cards to internal aliases.
- Preserve `PublicHeader` styling and approved `ArtalesBrand` assets.
- Validate active/hover/focus, sidebar overflow, long Czech labels, and permission-based link sets at all breakpoints.

### Phase 4 — forms/buttons/tables polish

- Establish shared visual patterns without changing form actions or data flow.
- Start with account profile/settings and simple tag forms; then lists/search; then admin tables.
- Defer `WorkEditorForm`, `WorkBlocksEditor`, author/collection long forms, and image upload until the pattern is proven and can be migrated in small slices.

### Phase 5 — status badges and workflow states

- Inventory every status value and map it to semantic status tokens plus text/icon cues.
- Review payments, credits, membership, invitation, entitlement, submission, and moderation actions with role-specific fixtures.
- Test success/error/empty/loading/disabled and destructive/rejected/cancelled paths; do not alter business rules.

### Phase 6 — mobile/responsive QA

- Validate all internal surfaces at narrow phone, large phone, tablet, and desktop widths in both themes.
- Verify sidebar/nav reachability, form control widths, long labels, button wrapping, table horizontal overflow, cards, upload previews, and safe-area/focus behavior.
- This phase covers internal UI only, not Reader page/spread layout or pagination.

### Phase 7 — closure/promotion

- Re-run route/state inventory, raw-literal scan, contrast/keyboard checks, and role-based regression checklist.
- Record remaining exceptions and screenshots in a closure document.
- Merge through `develop` preview first; promotion toward production requires separate explicit approval and must not be bundled with Reader/parser work.

## 9. First implementation recommendation

The smallest safe code PR after this audit is **internal semantic token definitions only**:

1. Add a documented `--artales-internal-*` light/dark token block to `app/globals.css`.
2. Map every new token to the current effective value or an existing root semantic value.
3. Do not change selector consumption, component markup, inline styles, runtime behavior, assets, or screenshots in that PR.
4. Prove visual equivalence with computed-style snapshots and representative light/dark screenshots for `/account`, `/member`, `/member/admin/dashboard`, and `/login`.

Only after that no-op foundation lands should a second, small PR move shell background, sidebar, passive panel/card, border, and text selectors to the new aliases. Keep gold surfaces, forms, tables, badges, payments, permissions, editor, and inline-style cleanup out of that first selector migration.

## 10. Explicit non-scope

> **Follow-up:** The value-preserving internal semantic token alias layer recommended
> by this audit has started in
> `ARTALES_INTERNAL_ZONE_TOKEN_ALIAS_PASS_V0_1.md`. The first pass defines the
> namespace only; selector consumption and palette mapping remain deferred.

- The known **Reader mobile page/spread layout issue**, where text blocks may break on phones. Track it as later Reader layout/pagination work.
- Reader styling, Reader page/spread behavior, parser, content block generation, or pagination, including the cancelled v0.10.15k patch.
- Database, SQL, environment, Supabase, storage policy, payment/credit/membership logic, or data changes.
- Access guards, roles, permissions, link visibility rules, and business workflow behavior.
- Route, action, API, component, CSS, i18n, package, public asset, or brand asset changes in this audit PR.
- Copy/i18n changes; mixed English/Czech strings are noted only as an existing boundary. Purely visual label issues may be catalogued later, but wording/localization needs a separate scope.
- Brand asset generation or a special internal/admin logo.
- Public homepage, gallery, work detail, public collection pages, and checkout redesign.

## 11. Validation performed

### Repository searches and inspection

Commands used (from the repository root):

```bash
find .. -name AGENTS.md -print
find app components docs -maxdepth 3 -type f | sort
find app -type f \( -name 'page.tsx' -o -name 'layout.tsx' -o -name 'loading.tsx' -o -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'route.ts' \) | sort
rg -n '^import .* from ' app/account app/member app/login app/register app/forgot-password app/reset-password app/onboarding app/invite app/collections app/kolekce app/credits components/account components/member components/community components/editor components/media components/checkout
rg -n 'className=' app/account app/member app/login app/register app/forgot-password app/reset-password app/onboarding app/invite app/collections app/kolekce app/credits components/account components/member components/community components/editor components/media components/checkout
rg -n '^\.(artales-(account|member|workspace|auth|admin|resource|editor|media|button)|member-shell|account)' app/globals.css
rg -n -- '--(artales|public|reader|color|background|surface|border|text|accent|gold)' app/globals.css
rg -n '<h1|<h2|<title|require(Admin|Editor|Invite|Member)|className="artales-' <each scoped route page>
```

Python/regular-expression scans counted `#[0-9a-fA-F]{3,8}`, `rgb()/rgba()`, `hsl()/hsla()`, `style={{`, CSS variables, and ARTales class names in the scoped files. The principal files inspected directly were:

- root/account/member layouts and `app/globals.css`;
- every page and route listed in the route inventory;
- `AccountNav`, `MemberZoneNav`, `ArtalesBrand`, and `PublicHeader`;
- `WorkEditorForm`, `WorkBlocksEditor`, `EditorialImageUploadField`, `StorageImageDisplay`, and `ResourcePromptBlock`;
- prior public/Reader token, audit, palette, cleanup, QA, and release-closure documents, plus repository workflow/release policy.

### Documentation-only confirmation checklist

- [x] The only intended changed file is `docs/ARTALES_INTERNAL_ZONE_VISUAL_AUDIT_V0_1.md`.
- [x] No runtime code, CSS, component, route, action, i18n, asset, database, environment, package, parser, Reader, or public-page file is changed.
- [x] DB: **no**.
- [x] Env: **no**.
- [x] Risk: **low** (documentation-only).
- [x] Target: **develop first**.
- [x] Rollback: revert the single documentation commit or remove this file; there is no runtime/data rollback.
- [x] `git diff --check` is required before commit.
- [x] The PR description must state audit-only, enumerate audited areas and key risks, list phases, call out the Reader mobile issue as non-scope, and include validation.
