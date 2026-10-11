# ARTales — Unified Candidate → Work → Revision → Publication v1
**Design and migration checkpoint: 2026-10-11.** Proposal only, not a production authorization. Live repo/database and `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md` prevail.

## Decision
**Do not preserve two publication systems.** New source intake goes through a governed `work_candidates` screening pipeline; successful candidates become durable `works` identities, but final publication/withdrawal must use server-side, revision-bound gates, not a manually editable `works.status`.

**Do not replace existing `works.id`, slugs, URLs, reading history, attribution, memberships, reader notes, cover links or foreign keys.** Current works are not newly discovered candidates. For legacy works use a distinct `legacy_import / legal_reassessment` provenance path attached to the existing work, optionally linking a real re-discovered candidate when defensible; never fabricate a signed candidate approval for the old corpus.

One authoritative publication system for both entry routes:
```
[admin target N + estimated cost cap] -> replenishing prescreen pool
 -> source/edition selection -> rights+provenance evidence dossier -> lock
 -> approved ingestion source snapshot -> deterministic wrapper filtering
 -> ARTales-owned composed blocks + source anchors -> immutable work revision
 -> editor text tasks <-> issues / return / regenerate changed spans / resubmit
 -> parallel optional visual task -> approved asset lineage
 -> current legal + QA + revision publication gate -> published revision
 -> reader/editor issue -> triage -> hold/withdraw if warranted
 -> corrected new revision -> repeat all changed gates -> republish
```
The number N means **N actually published**, not N generated candidates, N drafts or N tasks. A bounded scheduler refills when blocked/rejected/returned under an explicitly approved budget. There is **no Nexus worker queue**.

## Current verified sources of truth
- `develop`: `e514cc685ad807707df127fce0f654918b360f99` after PR #200, `main`: `171df191eb54dbcef7bb015f748138c630428b2f` as read back on 2026-10-11.
- PR #200 locally tested atomic candidate capture / independent review / `works` draft / `edit_text` task. PR #203 signed GoTrue/PostgREST E2E is GREEN but Draft (not merged at creation of this checkpoint). These prove a synthetic technical contract, **not genuine copyright clearance**.
- Preview uses deliberately disabled non-production Supabase URL/key; production keys are Production-only; no paid persistent Supabase branch.
- Reader/Composer has anchored fixture and visual side-by-side review. The persistent workflow for issues, revision acceptance, publication and takedown is NOT shipped.
- Current `lib/actions/works.ts` still directly sets `status=published` for editor/admin forms; production `works` RLS grants editors/admins broad direct update; table has no publication-gate trigger. This remains an explicit bypass of the proposed *new* release gate until separately migrated.
- The public `works` and `work_content_block_batches` read policies use `works.status='published'`. Before relying on withdrawal, enumerate **every** public route/API/cache/storage/search/export path and test that hidden contents cannot be fetched.

## Read-only production inventory, 2026-10-11 — no production writes
64 `public.works`: **49 published**, **15 draft**. Of published:
- 49 `source_label=gutenberg`, `origin_type=public_domain`, 49 have covers.
- 49 have no `edition_license`, `edition_source_url`, `edition_title` or `edition_version`. Their `source_reference` is populated (often a Gutenberg ebook URL). Empty auxiliary metadata does NOT establish infringement; it makes adequate legal evidence unproven in those columns.
- 22 have no `original_language`; 7 have different `original_language` vs canonical language. **A Tale of Two Cities** is incorrectly recorded as originally French; source is an English Dickens work (PG #98). Do not automatically tag all seven as translated.
- 47 linked authors have death year <=1955, 1 linked author has unknown death year (**Anonymous / The Song of Roland**) and 1 linked author died 1968 (**Helen Keller / The Story of My Life**). These are cheap risk signals, NOT rulings on territorial copyright status or licences.
- Real attached cover rights, illustration licences and translator rights have **not** been individually substantiated from this inventory.
- No changes to any published work were made during this read.

**Immediate risk queue:** (a) credible rights complaints/holds, (b) Helen Keller / territorial clearance, (c) possible translations (verify first), (d) unidentified authors/editions/source snapshots, (e) covers/visual assets, (f) normal legacy review. Do NOT automatically unpublish 49 works or classify 47 older authors as legally cleared. Preserve evidence for human counsel as needed.

Legal rationale and supplier limitations:
- PG copyright checks target the USA, do not grant territorial CZ/EU clearance; EU term generally life + 70 with exceptions and international complexity (Directive 2006/116/EC).
- PG robot access policy prohibits ordinary automated crawling of its main website. For candidate catalog/refill use sanctioned bulk XML/RDF/CSV/OPDS or mirrors/robot harvesting endpoints and rate limits. **Never build an uncontrolled scraper of human pages.**
- Gutenberg ebook release date is not original print edition date. Independently identify edition/translators/illustrators; remove PG header/footer and trademark material from derived content when appropriate without falsely erasing mandatory credit/licence evidence from the immutable archived source. Preserve exact source bytes and attributable licences separately.
- Official references: https://www.gutenberg.org/policy/terms_of_use.html ; https://www.gutenberg.org/policy/robot_access.html ; https://www.gutenberg.org/ebooks/offline_catalogs.html ; https://www.gutenberg.org/policy/license ; https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0116 .

## Canonical model — additive first, explicit cutover later
1. `work_candidates` remains pre-work intake (discovery, source shortlist, rights triage). Candidate `accepted` is **not** publication.
2. `works` remains permanent work identity. Add `work_provenance_links` with `work_id`, optional real `candidate_id`, origin_kind `candidate|legacy`, `source_snapshot_ref`; guard uniqueness; do not forge old audit approvals.
3. Add immutable versioned `source_snapshots` (approved fetch URI, original bytes/object ref, SHA256, observed-at, component inventory, transformation log, version), `rights_dossiers` and `rights_evidence` (component, original source/edition, jurisdiction, evidence URI/archival checksum, scanned-at, expires/recheck-at, policy version, independent reviewer, challenged flag).
4. Add immutable `work_revisions` with stable `work_id`, source snapshot, structured blocks and offsets, composer/parser recipe/model versions, content hash, status, ancestry. `works.published_revision_id` points to the currently visible, independently approved revision; new edit revision never overwrites it.
5. Maintain **two independent axes**: editorial state (`draft/ingest/editing/submitted/changes_requested/approved`) and availability (`not_released/live/held/withdrawn`). A published revision can stay intact while a new draft revision is reviewed. A credible issue can set `held` without deleting text/history.
6. Persist `editorial_issues` and `review_events` with task, source anchor, immutable revision hash, reviewer, verdict, reason, requested changes, dispute and complete chronology.
7. Asset/illustration tasks are work-scoped with separate provenance and rights, collection-specific visual brief/manifest, selectable AI variants, human acceptance. **Resolve Ivanka to a real ARTales profile ID** through explicit selection; never invent or hard-code personal IDs. Assign only after authorization/availability; visualization thread owns style templates.
8. `publication_decisions` atomically bind specific revision hash + current rights dossier + source manifest + QA + authorized actor/role + publication availability. On stale evidence, changed text, unknown licence, unresolved issue, or asset exclusion mismatch, **fail closed**.
9. `work_flags` (reader and editor reports) and `work_availability_events`: rights complaint, factual/typographic issue, corrupt content, visual issue, other; severity, trust, reporter, attached exact revision and URL; moderation and anti-abuse. Editorial button **Pozastavit zveřejnění a otevřít revizi**; authorized hold requires reason and transactional audit. A normal typo creates a new revision without taking a safe live revision down. A credible legal/safety risk triggers prompt temporary hold under defined permissions.
10. Keep `works.status` and existing editor app backward compatible during migration. Before activating the gate, review RLS **and** table/column privileges, SQL direct mutations, all service-role call sites, triggers, public search/read endpoints and rollbacks. Database must reject bypasses; a UI-only restriction is insufficient. Move legacy editor forms through governed RPC only after the read/write matrix is tested; do not disable existing production staff early.

## Process and acceptance, minimum viable vertical
### A. Dynamic catalog and prescreen
- Admin requests `target_published_count` and sees **indicative cost estimate** by stage: catalog acquisition (usually cheap), evidence checks, ingestion/AI blocks, expected review iterations, visual generation/commission. Show model assumptions and confidence bands; measure actual spend and forecast after first real run. No invented flat price. Hard spend/rate limits before paid operations; no empty-loop retries.
- Maintain `catalog_runs/items` with idempotent run keys, replenishing state, dedupe against existing candidates/works, per-author cap, genre balance, candidates `screened/qualified/escalated/rejected/deferred`, actual/estimated cost and reasons.
- Cheap author/edition prescreen (death/year/title/source/lang) only routes to detailed copyright assessment; no binary `public_domain=true` from a model or US metadata alone.

### B. Lock, evidence, ingestion and Composer
- Require identified original/edition and component-level commercial usability for CZ/EU target. Signed human exception route for uncertain licence. `candidate qualified for edit` is not `publication approved`.
- Locked source ref / approved mirror, exact raw snapshot/hash, separately archived legal provenance, explicit exclusions. Deterministically remove Project Gutenberg boilerplate and irrelevant wrapper while preserving textual chapters, prefaces/footnotes within approved components and provenance offsets. Treat uncertain boundaries as manual QA.
- Structured ARTales-owned blocks produced in a versioned composition job. Preserve source anchors [start,end), block IDs, transformed text diff and trace from source; no direct mutable writes to published blocks. Reader/Composer thread owns parsing, block UX and review UI fixture.

### C. Iterative editorial and visual review
- Text task: `open -> claimed -> submitted_for_review -> accepted|returned_for_changes -> ... -> completed`; independent reviewer sign-off and immutable revision-specific audit. Support multi-round partial regeneration and result acceptance; keep previous approved revision unchanged.
- Visual task parallel to editorial; collection template from visual thread; generate/curate cover variants for Ivanka if she is the assigned, verified collaborator. Edition-specific licensed source/image provenance and selection audit. No auto-attachment to a live work.
- Only when text, visuals, legal evidence, QA and human approval are green does server-authorized publication occur. Publishing changes a pointer/availability, not deletion of old revision.

### D. Post-publication correction
- Reader/editor flag references live `work_id + revision_id + optional block/span`. Untrusted flags do not directly depublish; authorized `hold` action is quick and independent of editor review.
- On hold: block **all** public content paths at DB/API/CDN/media layer, invalidate caches/search/previews, preserve all paid entitlements/history and notify editorial queue. Reopened revision may return to editing many times. Restoring publication requires current legal + independent review gate.
- Negative E2E: withdrawn work cannot be read via stale slug, direct PostgREST, content-block batch endpoints or known asset URLs where access must be restricted.

## Migration/cutover sequence — no mass mutation
**M0 read-only inventory (now):** snapshot counts+metadata/lineage shape only, risk ranking; no production mutation, no copying private records into public repo. Generate internal per-work audit IDs from `works.id`; no fake clean statuses.

**M1 additive schema on disposable local/ephemeral only:** provenance, work revision, evidence, hold/events, tasks; migration generated by Supabase CLI; RLS/grants, concurrency, rollback, signed Auth. New tables do not replace existing writes/URLs. Production DB apply separately approved.

**M2 gated pilot on develop:** only synthetic works and sanctioned source snapshots; admin target=1 then 5, prescreen+rights+ingest+composer+editor task+visual optional+publication dry run. No automatic publish to production or reusing prod keys.

**M3 legacy backfill preparation:** for each existing `works.id`, create a *pending* legal assessment and revision snapshot referencing existing content; hash exact current bytes, compare to identified source, classify issues. Do **not** convert all 49 published to legal-cleared by heuristic, overwrite content or toggle live status. Validate reader notes/slug/collections/cover/entitlements.

**M4 cutover by batches:** after legal approval, introduce direct-write enforcement and new gated UI. Existing publicly live items are controlled by compatibility adapter until assessed; risky items escalated to hold decisions. Dry run, sample 1 then 5, no DB direct writes bypass; counts reconciled after every batch.

**M5 release:** independent authorization for production SQL apply and then code `main` release; verify backup/migration reversibility, fail-closed fallback, no stale preview credentials; smoke tests, rollback plan, monitor complaints.

## Test gates
- Local CI: pgTAP role matrix and RLS/ACL incl. editor direct `UPDATE works SET status='published'` denial **after enforcement**, anon write denial, signed Auth E2E, concurrent work promotion and revision publish, lock/timeout, rollback, immutable events.
- Legal: wrong country, missing translator, unknown death, contested source, changed evidence, Gutenberg wrapper leakage, misclassified author language, cover/image rights uncertainty -> blocked/exception.
- Content: raw source hash, deterministic cleaned text, blocks fidelity, source anchors, change-only regeneration, multiple editor review cycles, revision unchanged during candidate edits.
- Public: hold unlists/hides all paths, no direct storage exposure of restricted assets, cache invalidation, republish exact approved revision and restore access.
- Cost: budget boundary, avoid duplicate paid runs, published-target replenishment, estimate vs actual.
- Negative tests must precede merge; **all production promotions require explicit approval**. No Nexus workers and no paid persistent Supabase branch.

## Workstream ownership
- **Main thread:** canonical DB contracts, legacy inventory, evidence policy, publication/hold security, admin orchestration, security testing. Own `supabase/migrations`, `app/member/editorial-tasks`, `lib/actions/works.ts`, and publication/rights state.
- **Existing Reader/Composer thread:** sanctioned source intake adapter, sanitization, source snapshot mapping contract (no canonical DB migrations), anchored blocks, side-by-side iteration and text UI. Work only in its own branch and PR into develop. See `docs/ARTALES_PARALLEL_COMPOSER_HANDOFF_2026-10-11.md`.
- **Visual thread:** collection templates, cover candidates and visual sign-off; own assets/manifests, coordinate with verified ARTales `profile.id` mapping after design ready. No guessing Ivanka's ID, no DB writes from design thread.
- Merges only after exact head + tests + architect authorization. Reader/Composer and visual PRs must not modify the main thread's DB publication gate files concurrently.
