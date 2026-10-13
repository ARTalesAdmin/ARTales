# ARTales — Legacy legal triage and semantic migration gate (2026-10-11)

**READ-ONLY evidence snapshot + decision contract.** Companion to `ARTALES_UNIFIED_PUBLICATION_LEGACY_CUTOVER_2026-10-11.md`, `ARTALES_UNIFIED_WORK_GOVERNANCE_V1_1_2026-10-11.md` and `ARTALES_LEGACY_REINGEST_RECOMPOSE_READER_CUTOVER_2026-10-11.md`. No production data, auth, release, or Reader changes authorized by this file. The facts below are read-only SQL findings, not legal conclusions.

## Verified catalog baseline

Production `public.works`: 64 distinct work identities, **49 published**, **15 draft**. All 49 published entries have a Gutenberg URL in `source_reference`, have a cover and existing nonempty `content_blocks`; all 49 are missing `edition_license` and `edition_source_url`. Of published: 22 missing `original_language`; 7 have different original and edition language values, including **A Tale of Two Cities**, incorrectly labeled original French (actual original language English). All 15 drafts lack `edition_license`; 14 have Gutenberg references, one is placeholder. Empty fields are evidence gaps, **not automatically copyright violations**.

Death-year heuristic: published **The Story of My Life** (Helen Keller, died 1968) needs urgent edition-specific territorial review; under a standard life+70 Czech term the underlying work could remain protected until 31 Dec 2038 (subject to detailed legal rules, exceptions and permission). **The Song of Roland** is anonymous; verify which actual English translation/edition is used. Drafts by Hermann Hesse (d. 1962) and Agatha Christie (d. 1976) need legal gate prior to future publication. None of these signals is independently confirmed infringement; evidence or counsel required. Mark review priority without automatically modifying live availability.

Sources are **not clearance**: Gutenberg US availability does not equal Czech/EU clearance for underlying text, translation, editorial notes, illustrations, cover or marketing assets. Original author death date alone does not clear modern translation/edition rights or contributory works. Gutenberg ebook release date is not original publication date. Consult official Czech law (121/2000 Sb.), Directive 2006/116/EC, and Gutenberg policies. Review exact edition, translator, country, source components, attribution and permissions.

## One work, two independent dimensions, single eventual publication model

Preserve each original `works.id`, slug/URL, accounts, access grants, library membership, notes/bookmarks/progress and cover history. Never create a fake new candidate or mark legacy material pre-approved. Record `origin_kind=legacy_backfill` and legacy-observed provenance (this is observation, **not** original source).

Distinct dimensions:
- **Legal and component-rights:** `unassessed | evidence_needed | legally_reviewed | disputed | clearance_rejected`; per original, translation, foreword, illustrations, cover, and jurisdiction; reviewed evidence with actor, scope, policy version and recheck clock.
- **Edition/recomposition:** `legacy_observed | source_discovery | source_verified | reingested | semantic_composed | editor_review | release_ready | migrated`; source snapshots, component spans, drift QA, pinned text/metadata/visual revisions and their distinct hashes.
- **Availability (independent):** `unreleased | live_legacy | live_revision | held | withdrawn`. Do not infer availability from an incomplete legal field. An actual credible rights claim may trigger authorized immediate Hold independently of the longer ingestion process.

A single `needs_source_replacement` / `replacement_source_kind=gutenberg | other_authorized | original` flag may help scheduling but **must never itself authorize release** or replace the three independent state axes.

## Legacy backfill process

1. Inventory only: read source URL, title, authors, edition, translator, visible cover, legal assertions and source evidence gaps. Do not persist text copies, private reader notes or full source bytes in documentation/fixtures.
2. Once storage is separately authorized: snapshot exact `legacy_observed` content/blocks and current release identity with immutable hash, access restricted. Separate from actual raw original edition source and separate from every semantic revision.
3. Risk-based evidence screening: isolate translator/edition and asset components, dates, languages, territorial exploitation, contributor credits and actual licence. Unknown is not cleared. Human-reviewed reasoned disposition; prioritize known risk and complaints. Legal counsel where appropriate.
4. For retained legitimate works, retrieve selected authorized raw source edition by sanctioned method (Gutenberg bulk/offline endpoints or another lawful source); hash and pin raw bytes + component manifest; isolate PG boilerplate/license/trademark from literary content while retaining archived rights evidence. Reconcile legacy vs independently acquired original; surface drift without silently regenerating content.
5. Compose *new* `SemanticRevision` with semantic chapters, poem/stanza/verse, footnotes and byte anchors. Do not import legacy rigid `WorkBlock` as newly approved blocks. Machine source fidelity, reader layout QA and human editorial review must pass. Public descriptions and cover/illustrations are separately versioned and human-approved, with component legal rights.
6. Protect actual signed users: build additive `reader_notes`/progress/bookmark anchor sidecar keyed by user+work+version, no destructive overwrite of legacy note, `exact / approximate / blocked` confidence; preserve `slug` and old page/percent fallback. Two real signed local account E2E and RLS isolation required. Do not copy production personal data into CI.
7. Publish only with separate authorization, independent legal review, approved pinned semantic/metadata/visual bundle, atomic governed DB-B release and hold rollback. No direct manual `works.status='published'` bypass. Existing published Reader stays on prior lawful version during ordinary revision; credible risk leads to authorized Hold even before reingest.
8. Pilot synthetic 0 → one sanitized legally assessed existing Alice work → heterogeneous five works (different language/translation/verse/complexity) → remainder. Each requires result `migrated | held | unresolved`, reason and actor. Unresolved/unusable drafts may be linked to candidate re-discovery **without deleting work IDs**.

## Suggested review buckets and safeguards

- **P0:** credible rights complaint, clear evidence of protection without permission, threatened use; counsel + emergency Hold review. Never auto-hold based solely on blank `edition_license`.
- **P1:** probable underlying author protection, translation/unknown translator, disputed source, component licensing for image/cover; expedited human legal review.
- **P2:** inconsistent/missing metadata, source/edition identity and attribution requiring verification; eligible for parallel synthetic compositor preparation but *not release*.
- **P3:** evidence complete, legal and text checked; normal semantic re-ingest/composition and editor QA.

Examples to inspect first: Helen Keller `The Story of My Life`; French/English confusion in Dickens `A Tale of Two Cities`; translation provenance for `Around the World in Eighty Days`, `The Count of Monte Cristo`, `Don Quixote` and anonymous `The Song of Roland`. These are *triage hypotheses*, not formal determinations or permission to take down.

## Open integration and sign-off gates

- PR #213 Auth-signed local source intake passed its initial CI, but is Draft and only a local assembly, not an authorized production migration.
- PR #209 Semantic Reader v2 CI green and architect hands-on notes/scroll QA passed, but no real account persistence, live Reader takeover, legal clearance or public cutover.
- Current production SQL has no `work_candidates`/new evidence schema, so development code in `develop` must not be assumed production-applied.
- Generate a **per-work inventory report** first, with source fields and rights-component missingness plus the reviewed action. No new data states or migrations should be enabled based on this document alone.
- Before a future Hold/Unpublish operation: enumerate every public route/API/cache/storage/CDN/search surface and audit signed roles, emergency lockout and reversible/nonreversible media exposures.
- A legal review may recommend immediate suspension, but production Hold requires separate, narrowly scoped authorization unless an established legally binding incident process already applies.
- The budget for the first 1→5 pilot and any non-public archival storage must be approved before execution.

## Merge/release governance

Documentation-only; risk LOW for repository but content highlights HIGH legal/data migration risk. Target `develop`, DB NO, Env NO, no external cost. Rollback = revert this docs PR. Test checklist: read-only production `works` aggregate queries run; no individual legal clearance completed; no signed account E2E, new DB test or live cutover claimed. **No merge into develop, DB apply, main, user data mutation or production publication is authorized by this plan.**
