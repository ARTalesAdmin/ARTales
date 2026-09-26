# ARTales durable checkpoint — 2026-09-26

> **Status:** non-authoritative continuation checkpoint.
>
> This document is a durable handoff aid for future ARTales development sessions. It summarizes current intent, decisions, open work, and known dirties. It does **not** override `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, database state, merged code, or explicit user authorization.

## 1. Current branch / governance baseline

- `main` = production.
- `develop` = sandbox / integration branch.
- New implementation work starts from current `develop`, gets its own feature branch, and opens PRs back to `develop`.
- Production promotion is separate and requires explicit user authorization.
- Database changes require separate explicit authorization from code merge.
- Ephemeral Supabase branches, when usable, are temporary test-session infrastructure only. They must not contain production data, must be logged, and must be deleted at the end of the active session.

## 2. Completed work in this thread

### P1-0 — Internal full reader preview: COMPLETE

Goal:
- allow editor/admin to inspect existing `draft` and `review` works in the same real reader engine as published works,
- without temporarily publishing them.

Implemented:
- editor-only route `/member/works/[slug]/reader`,
- guarded with `requireEditorOrAdmin()`,
- loads work through `getWorkForEditBySlug()`, including content block batches,
- reuses the existing `ReaderClient`,
- `editorPreview` disables reader progress persistence/restoration and reader notes,
- internal vs customer-facing reader links are separated,
- customer preview/full-reader links are shown only where appropriate for published works,
- no content migration or conversion of existing works.

Validation:
- user confirmed the internal reader preview works.
- `Test` remains a dummy/layout playground.
- richer existing drafts such as `Through the Looking-Glass` are useful regression targets.

Production state:
- P1-0 was promoted through `develop` and merged to `main`.

### P1-1A — Work candidates foundation: MERGED TO DEVELOP

Purpose:
- create a lightweight container **before** a real `works` row exists,
- avoid polluting `works` with rejected/deferred/request-only ideas,
- avoid spending compute on titles that cannot currently be used.

Candidate lifecycle:
- `new`
- `checking`
- `ready`
- `accepted`
- `deferred`
- `review_required`
- `rejected`

Rights statuses:
- `unknown`
- `clear`
- `partial`
- `alternate_edition_required`
- `review_required`
- `deferred`
- `blocked`

Discovery statuses:
- `unknown`
- `pending`
- `complete`
- `needs_review`

Origins:
- `manual`
- `internal_list`
- `reader_request`
- `nexus`
- `other`

Candidate record includes:
- proposed title,
- proposed author name,
- origin and origin reference,
- lifecycle status,
- priority,
- optional matched author/work IDs,
- discovery status,
- rights status,
- short human-readable rights reason,
- jurisdiction,
- `not_before`,
- review flag,
- selected source type/reference/URL,
- audit metadata.

UI:
- internal `Kandidáti` section for editor/admin only,
- list,
- create form,
- detail/edit page,
- sections: identity/origin, discovery/source, rights/restrictions,
- reserved `Hlídáček` area and methodology link,
- Czech UI with English i18n copy prepared.

Security:
- member role must not access candidates,
- RLS limited to active editor/admin,
- no hard-delete path: rejected/deferred candidates remain durable audit history,
- no automatic candidate → work promotion yet,
- no automatic AI discovery or rights decision yet.

## 3. Core conceptual decision: candidate is NOT a work status

`work_candidate` is a separate lightweight entity before `works`.

Meaning:
- candidate = “we are considering this literary work / request”,
- work = “ARTales has accepted this title into the editorial/production pipeline”.

A candidate may originate from:
- internal title list,
- manual editor request,
- future reader request,
- Nexus/Syrael proposal,
- another source.

Rejected/deferred candidates should remain recorded so ARTales does not repeat the same research and spend again.

Future reader requests may aggregate around an existing candidate rather than creating duplicate candidates.

Promotion target:
- accepted candidate can later create/link to a real `works` row,
- candidate keeps provenance and links through `matched_work_id`.

## 4. Rights & provenance architecture

Primary principle:
**Reconstruct the literary work, not the Project Gutenberg web page.**

Rights work is staged to avoid unnecessary compute.

### P1-1B — Work-level rights triage

Question:
- Is the underlying work itself worth continuing for the target jurisdiction?

Initial supported jurisdiction:
- `EU_CZ`.

Architecture should remain jurisdiction-aware for possible future US or other editions, but US regional publication is explicitly out of current scope.

Target work-level outputs:
- CLEAR,
- REVIEW_REQUIRED,
- DEFERRED,
- BLOCKED,
with a short editor-facing reason in Czech.

Example editor-facing behavior:
- clear: short explanation why,
- deferred: reason + `not_before`,
- review required: explain uncertainty,
- blocked: explain what operation is blocked.

### P1-1C — Source / edition discovery (“hledáček”)

Input may be only:
- title,
- author.

Discovery should identify:
- normalized work identity,
- author identity/life dates,
- publication facts,
- candidate source editions,
- canonical source identifiers,
- contradictory search results that require validation.

Do not blindly map:
`title -> first search result -> ingest`.

Identity should be verified using combinations such as:
- title,
- author,
- canonical source page,
- source identifier,
- metadata.

Discovery should be cheap first:
1. deterministic/data lookup,
2. lightweight AI interpretation,
3. stronger model/human only for ambiguity.

### P1-1D — Edition/component rights

Once a concrete edition/source is selected, classify components such as:
- WORK_CONTENT,
- EDITION_CONTENT,
- SOURCE_WRAPPER,
- EDITORIAL_ADDITION,
- ASSET,
- UNKNOWN.

Possible decisions:
- text usable, illustrations not,
- original work usable, translation not,
- edition unsuitable, find alternate edition,
- Gutenberg wrapper/transcriber/editorial notes must not be published,
- unclear component → human review.

### P1-1E — Promotion gate

If a usable work + source path exists:
- candidate may be promoted to a real ARTales work.

If not:
- remain deferred/rejected/review-required candidate,
- no unnecessary blocks/content ingest.

## 5. Rights & Restrictions UI direction

A future internal section `Práva a omezení` should exist for candidates and real works.

Desired concepts:
- original work rights,
- edition/text rights,
- translation rights,
- assets/illustrations,
- editorial additions,
- target jurisdiction,
- short explanation,
- `not_before`,
- publication lock state,
- re-review state.

Important behavior:
- rights restrictions should explain the reason,
- editor may still edit a blocked/deferred dream title when appropriate,
- publication must be technically blocked where rights are unresolved,
- changing normal metadata must not silently remove a rights lock,
- reaching `not_before` triggers a **new review**, not automatic publication/unlock.

Publish gate should ultimately fail with a clear Czech message, e.g.:
“Dílo nelze publikovat: práva k použité edici nejsou dokončena. Obsah můžeš dál upravovat; stav práv najdeš v sekci Práva a omezení.”

## 6. Pilot title

Chosen first pilot:
**The House of the Wolfings — William Morris**

Why:
- near the end of the user-provided title list,
- not highlighted as already being worked on,
- absent from current ARTales works at selection time,
- useful mixture of prose and verse/structural signals,
- suitable for testing semantic vs presentation fidelity.

Initial discovery notes:
- William Morris: 1834–1896.
- Work first published in 1889.
- Project Gutenberg candidate: eBook #2885.
- Gutenberg page indicates transcription from a Longmans, Green & Co. 1904 edition by David Price.
- Work-level EU/CZ baseline appears clear based on author death + standard term logic, but the **concrete source/edition/components still require separate validation**.
- A Gutenberg search result inconsistency was observed around another identifier; this reinforces the need for canonical identity checks.

Do not hard-code Wolfings in migrations.
Create it as the first real candidate through the same candidate workflow used for future titles.

## 7. Ephemeral Supabase: intended mode and current dirty

### Intended mode

For DB/schema/RLS work:
- create temporary Supabase preview branch only for an active test session,
- no production data,
- record branch name/project ref, purpose, opening time, migrations, result, deletion,
- no autonomous production merge/apply,
- delete at session end,
- overnight existence = cleanup incident.

Cost observed on 2026-09-26:
- Supabase preview branch default Micro compute: **$0.01344/hour** while it exists.

### First live attempt

Created:
- branch name: `artales-p1-candidates-session`
- branch project ref: `accvkiiuezhsabtwvyov`
- persistent: false
- production data copied: no

Result:
- branch came up healthy,
- but did **not** contain the ARTales public schema (even `authors` was missing),
- candidate migration could not apply because it references existing ARTales tables.

Branch was then deleted during the same session. No paid branch should remain running.

### Root cause / dirty

Current repository migration history is **not a complete schema bootstrap**.

The oldest checked-in migrations already assume core tables such as:
- `profiles`,
- `authors`,
- `works`
exist.

Supabase production/branch migration registry also does not currently represent the historical ARTales schema chain in a way that a fresh branch can reconstruct it.

Therefore:
**ephemeral Supabase is not yet operational for ARTales until a reproducible schema baseline/bootstrap exists.**

## 8. Immediate next technical block

### Ephemeral baseline bootstrap

Goal:
- create a safe schema-only baseline representing the current production ARTales database,
- no production content/data,
- make a fresh Supabase preview branch able to reconstruct the required public schema,
- preserve future migrations on top of that baseline.

Required validation:
1. create a fresh ephemeral branch,
2. verify core ARTales tables exist,
3. apply/test P1-1A candidate migration,
4. run RLS/security advisors,
5. connect/verify application preview against the correct branch DB,
6. create first Wolfings candidate,
7. inspect candidate UI,
8. delete branch,
9. record cleanup.

Do not solve this by copying production data.

## 9. Planned roadmap after P1-1A / baseline

### Phase 1 — Rights & candidate pipeline

1. Candidate foundation — done on `develop`.
2. Reproducible ephemeral DB baseline — next.
3. Work-level rights triage + short reasons.
4. Rights & Restrictions UI.
5. Publication lock.
6. `not_before` and re-review trigger/queue.
7. Source/edition discovery (“hledáček”).
8. Edition/component rights.
9. Candidate → work promotion.

### Phase 2 — Source acquisition and sanitization

- fetch selected concrete source, preferably rich HTML when useful,
- identify work content vs wrapper/additions/assets,
- strip Gutenberg wrapper/licence boilerplate from ARTales representation,
- exclude or flag unsafe components,
- alternate-edition fallback,
- create only safe source material for downstream processing.

### Phase 3 — Safe Source Snapshot v1

Persist:
- safe text,
- source regions,
- DOM/structural evidence,
- emphasis,
- line breaks,
- headings,
- tables,
- image relationships,
- relevant alignment/indentation/layout evidence,
- provenance.

For excluded/protected components:
- retain structural evidence/position when useful,
- do not retain protected binary/content unless separately justified.

### Phase 4 — ARTales Representation v2

Keep semantic block taxonomy.
Add a small versioned validated presentation layer for layout properties such as:
- alignment,
- indentation,
- hanging/first-line indent,
- spacing,
- preserve line breaks,
- small caps / weight / style / relative size,
- width/margins,
- keep-with-next/page-break-like signals as needed.

Do not create a new semantic block type for every visual variation.

### Phase 5 — Syrael interpretation

Source Snapshot → ARTales representation.
Include:
- semantic classification,
- boundaries,
- presentation,
- provenance mapping,
- confidence/uncertainty,
- structural checks,
- local/chunked processing.

### Phase 6 — Dual QA

Editor UI:
- left: safe source/original evidence,
- right: actual ARTales reader.

Both panels should be collapsible with arrows:
- focus source only,
- focus ARTales only,
- neither side can be permanently “closed/lost”.

QA actions:
- SEDÍ,
- TEXT,
- STRUCTURE,
- LAYOUT,
- MISSING,
- IMAGE/ASSET,
- OTHER.

Need source-region ↔ ARTales-block mapping and region-level QA state.

### Phase 7 — Correction / learning loop

- flag → Syrael diagnosis,
- local content change-set patch,
- rerender affected region,
- human accept/reject,
- repeated pattern → reusable capability proposal,
- no silent global renderer mutation from a single occurrence.

### Phase 8 — Human effort / cost metrics

Track:
- compute cost per title/stage,
- wall clock,
- optional transparent active-time confirmation,
- human minutes/title,
- flags/100 blocks,
- corrections/title,
- acceptance rates,
- recurring errors/capabilities.

Avoid invasive productivity surveillance.

### Phase 9 — Publish gates

Before publication:
- RIGHTS_CLEAR,
- SOURCE_VALID,
- CONTENT_COMPLETE,
- QA_COMPLETE,
- ASSETS_VALID,
- METADATA_VALID,
- RENDER_VALID,
and later COVER_APPROVED.

Publish must become a gate-checked operation, not merely changing a dropdown.

### Phase 10 — Cover workflow

Later:
- art direction / collection methodology,
- e.g. 3 generated candidates,
- human choice/tuning,
- cover provenance,
- COVER_APPROVED.

### Phase 11 — Nexus orchestration

ARTales should expose controlled domain capabilities; Nexus owns generic orchestration.

Potential capabilities:
- check_candidate,
- prepare_source,
- interpret_work,
- run_automated_qa,
- request_editorial_qa,
- apply_correction,
- request_cover,
- publish_if_gates_green.

Nexus responsibilities:
- batch,
- budget,
- deadline,
- worker execution,
- human assignment,
- notification,
- waiting/resume,
- timeout/escalation,
- closure/audit.

### Phase 12 — Scale / learning

Only after several real titles:
- compare pre/post capability quality,
- measure cost and human effort reduction,
- then allow larger batches.

## 10. Backfill plan once rights/candidate model is stable

Two waves are intended.

### Wave A — existing ARTales works and drafts

Run all current works, including drafts/concepts, through the new rights/provenance format.

Do **not** necessarily create historical candidates for all existing works unless useful.
Goal:
- remove blind spots,
- identify unclear source/edition provenance,
- create publication locks where needed,
- avoid surprises in existing catalogue.

### Wave B — user-provided title list

Treat the spreadsheet/list as a **candidate catalog**, not an ingest queue.

Initial scan should be cheap:
- identify work,
- work-level rights triage,
- classify now / alternate edition / review / defer / reject,
- avoid expensive source processing until the candidate passes.

Highlighted rows in the original spreadsheet represented already-active/claimed titles and should not be blindly reprocessed.

## 11. Economic principle

Rights/discovery must be proportionate.

Do not use expensive strongest-model/legal-style analysis for every candidate.

Preferred ladder:
1. deterministic lookup / cached data,
2. lightweight AI interpretation,
3. stronger model or human only for ambiguity/high-risk cases.

A rights mistake can be expensive, but over-processing every obvious public-domain title is also wasteful.

Separate:
- title-processing cost,
- reusable capability/learning cost.

## 12. Known non-goals / scope boundaries

Not now:
- US regional publication/rights path,
- full automatic Gutenberg catalog ingest,
- automatic publication on `not_before`,
- candidate auto-promotion,
- production-data copy into ephemeral DB,
- Flowre integration in this ARTales pilot,
- generic assignment system inside ARTales (belongs in Nexus),
- automatic global block-type mutation.

## 13. Continuation protocol for a fresh chat

Before changing ARTales:
1. read `AGENTS.md`,
2. read this checkpoint,
3. read `docs/WORKFLOW.md`,
4. read `docs/RELEASE_POLICY.md`,
5. inspect current `develop` / open PR state,
6. verify whether any Supabase ephemeral branch is currently active,
7. never assume this checkpoint is more authoritative than live code/DB or explicit user instructions.

**Recommended next action:**
Start with the **schema baseline/bootstrap audit and implementation plan** required to make ARTales ephemeral Supabase reproducible. Then retry P1-1A in a clean branch and create Wolfings as the first real candidate.
