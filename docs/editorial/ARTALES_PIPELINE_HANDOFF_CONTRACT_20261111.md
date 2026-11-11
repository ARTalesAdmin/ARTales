# ARTales — kontrola předání Prescreen → Publikace (2026-11-11)

> Read-only evidence and release checklist. This document does **not** certify an end-to-end publication. Source is `main` at `9a344a95fc2385dfeed89cc854b83a6c14503f6b` plus PR #341 changes. No production mutation was performed.

## Contract review (producer → consumer)

| Stage | Producer evidence | Consumer's required evidence | Verified / risk |
|---|---|---|---|
| Prescreen → Candidate | `prescreen_shadow_handoffs`, `artales_transfer_prescreen_handoff` | `work_candidates.id`, origin, proposed title/byline, source metadata | ID and FK present; duplicate identity handling requires end-to-end role test |
| Candidate → Legal | candidate ID + title/byline | `candidate_legal_sources`, `candidate_legal_decisions`, source-specific lock | Source/decision IDs are explicitly connected |
| Legal → Snapshot | approved lock `(candidate_id,source_id,decision_no,download_url)` | exact selected file, immutable digest, claim and Storage receipt | Snapshot registry FKs exist; **Storage readback is claimant-scoped** and may fail when a different authorized editor follows up |
| Snapshot → Compose | verified EPUB bytes + `snapshot_sha256` | `candidate_semantic_revisions` with exact candidate/snapshot SHA | Exact composite FK `(candidate_id,snapshot_sha256)`; source integrity check in compose |
| Compose → Editorial tasks | current revision SHA + candidate identity | current text-QA task and work-scoped metadata tasks | Task auto-enqueue skips both author tasks if full name exactly exists; later publication RPC unconditionally requires them |
| QA → Editorial state | signed revision, flags, decisions | completed QA for **current** SHA, no open flags or pending AI | Current editor UI shows only current revision flags, DB completion scans all open candidate flags; PR #341 guards a class of stranded flags |
| Editorial → Release | valid linked author + bilingual bio/portrait; cover, description, collection | exact author, complete tasks and evidence | **Mismatch:** save/closeout accepts one unambiguous longer author name; current publish RPC requires exact equality. Publication also requires author tasks even when they were intentionally not created |
| Release → Reader | `works` + `artales_semantic_publications` with exact revision | public semantic edition selection / legacy fallback | PR #341 aligns poem exclusion boundaries; existing Reader remains unchanged for older works |

## Known blockers — do not mark as passed

1. **Author identity mismatch in publication:** `artales_publish_semantic_candidate` only compares exact `authors.name` / `name_en` with `work_candidates.proposed_author_name`, while `artales_save_candidate_editorial_field` and `artales_guard_editorial_task_evidence` also accept bounded, unique longer names. Example: `Sheridan Le Fanu` vs. `Joseph Sheridan Le Fanu`. Any change requires a separately authorized and verified database migration and regression evidence (ambiguous names must fail).
2. **Missing author task contradiction:** `artales_auto_enqueue_semantic_tasks` omits `author_bio` and `author_visual` on an exactly matching pre-existing author; publish RPC requires a completed row for both without checking whether tasks were created. Fix consistently in creation, evidence, UI readiness and DB publication; do not insert fake completions.
3. **Snapshot Storage cross-actor access:** production `artales_snapshot_claimed_admin_readback_v2` checks `claimed_by=auth.uid()`; `candidate_snapshots` staff SELECT does not. Determine authorized cross-actor handoff before granting access; retain fail-closed scopes.
4. **QA historical flags:** DB completion scans all open candidate QA flags; current editor page reads current SHA only. PR #341 prevents one manual batch route from stranding unrelated flags, but existing historical states and other revision-creation paths need regression coverage.
5. **Poetry projection parity:** QA and public Reader must agree on bounded poem exclusion. PR #341 now reuses the same poem boundary predicate; no source bytes or lexical content changes.
6. **No released semantic production work yet:** the pipeline still needs a real authorized acceptance path after the above blockers are closed.

## Repeatable read-only review for each functional change

For the affected edge, record: (a) producer's persisted output, (b) IDs and version/SHA that bind it to the consumer, (c) authorization role and RLS/Storage policy, (d) consumer's required state and evidence, (e) idempotency/retry and error semantics, (f) downstream effects and rollback path. Test ordinary case, stale revision, ambiguous identity, absent/invalid evidence, wrong actor, and retry after partial save.

**Stop rule:** if producer and consumer disagree on a contract, do not bypass or weaken the consumer guard. Locate the canonical rule and amend both surfaces together with negative tests. Production SQL/merge/deploy require separate authorization.
