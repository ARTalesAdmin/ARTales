# ARTales public refresh post-release audit v0.1

## Purpose and evidence boundary

This is an operational review of the public visual-refresh sequence represented
by PRs #85–#104 and their delivery notes. It is not a new visual specification
and does not claim that an unchecked preview item was completed. Findings below
come from the committed scope records, rollback notes, and follow-up fixes; they
should be read as input to the next pipeline, not as blame or ceremony.

The refresh covered the public shell, homepage, public header/navigation,
gallery/catalog and work-detail presentation. Reader, account, member, admin,
editor, parser, payments, credits, Supabase, database, and environment work was
repeatedly and deliberately excluded.

## 1. What happened

The work moved through five practical phases:

1. **Semantic preparation.** A value-preserving color-token layer was defined,
   selected legacy aliases were connected, and small public selector groups
   were migrated before any intentional palette change.
2. **Palette preview and application.** Paper / Ink / Gold values were mapped
   in `develop`, then applied to explicitly scoped public surfaces where the
   existing cascade prevented the token mapping from being visible.
3. **Controlled brand delivery.** The homepage brand-card audit first stopped
   at a real provenance/runtime-path blocker. Approved light/dark lockup exports
   were then copied byte-for-byte to controlled runtime paths and enabled at
   narrow, opt-in call sites.
4. **Public polish and QA.** Homepage cards, actions, links, header/navigation,
   responsive lockup sizing, light/dark behavior, and work-detail contrast were
   refined in follow-up passes. Icon references were verified rather than
   changed without evidence.
5. **Content and layout follow-up.** Homepage Czech/English copy was polished
   separately, followed by a focused correction to the homepage split-card
   layout. Keeping those decisions outside the palette patches reduced the
   blast radius, even though the late layout correction shows that the visual
   review matrix was not complete early enough.

The result is a coherent public-facing visual direction built around approved
assets and semantic colors, with public and protected product areas kept apart.

## 2. What worked

### Guardrails that should be retained

- **Develop-first, reversible increments.** Each delivery described a bounded
  rollback, with no DB or environment dependency.
- **Value-preserving migration before recoloring.** Separating token plumbing
  from intentional palette changes made cascade effects easier to reason about.
- **Explicit deferrals.** Reader and dense/private UI were not casually pulled
  into public CSS work. State colors, payments, and other sensitive domains
  were also left alone.
- **Provenance gate.** The brand-card audit did not treat the existence of an
  export as permission to deploy it. Runtime delivery happened only after the
  source, destination, hashes, and intended use were recorded.
- **Narrow adoption.** Opt-in lockup mode protected other brand consumers, and
  public selectors were scoped to public containers and routes.
- **Evidence-based restraint.** The favicon concern was investigated through
  references and hashes; no asset change was made when no mismatch was proven.
- **Dedicated dark-mode correction.** Final QA found a real readability issue
  on dark work detail and corrected the affected prose without redesigning the
  reader or the whole dark theme.

### Product outcome

The sequence established a recognizable Paper / Ink / Gold public surface,
approved lockups in the homepage and public header, calmer interaction states,
and a clearer hierarchy between editorial cards and supporting facts. It also
left a useful documentary trail of scope, exclusions, risk, and rollback.

## 3. What caused avoidable churn

These are process findings inferred from the number and order of follow-ups;
they are not claims of individual implementation failure.

| Churn source | Evidence in the sequence | Better next time |
| --- | --- | --- |
| Route coverage was described repeatedly but not held in one inventory. | Homepage, gallery/catalog, author/community/resource, and work detail were checked in different passes. | Freeze a route/state inventory before implementation and attach every screenshot to one row. |
| Token definition did not guarantee token consumption. | Palette mapping remained visually subtle until a later public-surface apply pass handled legacy gradients, aliases, and cascade outcomes. | Produce a token-coverage report before mapping values; classify direct token, legacy alias, raw literal, derived alpha, and theme override. |
| QA matrices were copied between delivery notes rather than closed centrally. | Many preview checklists remained unchecked in committed notes, while later QA found header transition and dark-detail contrast issues. | Use one release checklist with an owner, evidence link, result, and explicit waived/not-applicable state. |
| Light, dark, adaptive, responsive, locale, and auth states were not one review unit. | Theme and mobile corrections appeared late; Czech/English copy and a Czech layout issue followed visual QA. | Capture a minimum matrix across theme, breakpoint, locale, and signed-in state before declaring visual QA complete. |
| CSS refinement accumulated in sequential override passes. | Palette apply, launch polish, header refresh, and final QA each needed narrowly scoped follow-ups. | After approval, schedule one consolidation review that removes superseded overrides without changing output; do not combine it with visual redesign. |
| Asset readiness and runtime delivery were initially separate unknowns. | The homepage brand-card replacement was correctly deferred despite approved exports because public runtime use was not yet auditable. | Add provenance, approval status, runtime destination, theme variant, and consumer to a preflight manifest before UI work starts. |
| Copy fit was treated after visual fit. | Copy polish and then a split-card layout fix landed after the final visual QA pass. | Review representative Czech and English production-length strings in the first responsive screenshot set. |

## 4. Recommended process changes

1. **Open with an evidence pack, not CSS.** Record the target routes, states,
   approved asset versions, token baseline, screenshots, and explicit exclusions.
2. **Set acceptance criteria per surface.** Each route row needs expected visual
   change, unchanged behavior, themes, breakpoints, locales, interactions, and
   reviewer.
3. **Separate four gates:** inventory, system proposal, implementation, and
   release QA. A gate may fail without forcing a partial implementation forward.
4. **Make automated reports advisory but repeatable.** Route/token/asset checks
   should produce deterministic text or JSON suitable for diffing; browser QA
   remains the authority for appearance and interaction.
5. **Require screenshot identities.** Use route + viewport + theme + locale +
   auth-state + commit SHA in filenames or metadata. Do not accept an unlabeled
   image as release evidence.
6. **Close the matrix before “final QA.”** Every item must be pass, fail,
   not-applicable, or explicitly waived with a reason and owner.
7. **Budget one consolidation pass.** Only after visual approval, review
   duplicated/superseded declarations, token exceptions, and documentation.
   Preserve computed output and keep consolidation separate from new design.
8. **Keep production promotion separate.** Passing `develop` preview is evidence
   for a later production decision, never automatic authorization to merge to
   `main`.

## 5. Reader-specific implications

The public refresh intentionally proves very little about the Reader. The
Reader has different priorities: long-session comfort, typography and measure,
theme persistence, pagination/flow behavior, selection and focus, reading
progress, overlays, and content-edge cases. Public Paper / Ink / Gold values
cannot simply replace `--reader-*` values or reader theme recipes.

What can be reused safely is the **method**: semantic roles, provenance,
develop-first previews, explicit theme matrices, narrow scope, and reversible
delivery. What must not be reused blindly is the public cascade, card hierarchy,
header treatment, action styling, or any assumptions about reader pagination.

Reader work is high-risk under the release policy and requires explicit scope.
In particular, the cancelled **v0.10.15k — Table Pagination & Generated Header
Fix** must not be revived. Tables, parsing, generated headers, and pagination
belong to separately authorized functional work, not to a visual-system patch.

## 6. Proposed next project: ARTales Reader Visual System

### Project objective

Define a reader-specific visual language that supports sustained reading while
preserving reader behavior. The first project should deliver a documented
system and review evidence in `develop`; it should not change parser,
pagination, entitlements, or content semantics.

### Suggested phases

1. **Reader inventory:** routes, entry points, themes, controls, overlays,
   content fixtures, responsive modes, and current tokens/selectors.
2. **Reading requirements:** type scale, measure, leading, spacing rhythm,
   contrast targets, focus visibility, reduced motion, and long-session needs.
3. **Semantic model:** reader-owned token roles and component/state mapping,
   with a documented boundary from public tokens.
4. **Static review pack:** representative prose, headings, links, quotations,
   lists, images, footnotes, and intentionally deferred complex content.
5. **Develop-only implementation:** small reversible slices with no parser or
   pagination changes.
6. **Reader QA:** theme, viewport, input method, persistence, overlays, loading,
   empty/error states, and long-content regression.

### Exit criteria for the planning phase

- Reader scope and explicit non-goals are approved.
- Current behavior has baseline screenshots and a route/state inventory.
- Token ownership and public/reader boundaries are documented.
- Representative fixtures are named without altering production data.
- Accessibility and long-reading acceptance criteria are measurable.
- Rollback and preview-test ownership are assigned.
- Any parser, table, pagination, or generated-header request is split into a
  separately approved project.

## Delivery record

- **Changed files:** this audit and
  `docs/ARTALES_VISUAL_REFRESH_PIPELINE_CHECKLIST_V0_1.md`.
- **Risk:** `low` — documentation only; no runtime or asset change.
- **Target:** `develop first`.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback:** revert this documentation commit. No runtime, data, asset,
  package, cache, or environment action is required.
