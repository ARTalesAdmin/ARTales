# ARTales Phoenix — 2026-10-09: ingest restart and component-safe capture

> Non-authoritative handoff checkpoint, continuing `docs/ARTALES_PHOENIX_2026-09-28.md`. Live source, database, AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md and explicit user authorization take precedence.

## Product objective

Replace the editor's predominantly manual Gutenberg -> text parser -> block editing workflow with a controlled, source-faithful, layout-aware ingest workflow:

1. Candidate discovery, identity, jurisdiction and edition-specific rights triage.
2. Promote an eligible candidate atomically to one incomplete `works` draft, with no content or publication.
3. Capture the selected specific edition/source with immutable, fingerprinted, provenance-aware snapshots. **Separate literary work content, source/edition metadata, transcribed edition material, translations, source wrapper/Gutenberg notices, editorial additions, and every illustration or asset.** Every component receives separate rights review and an explicit include/exclude/block/review outcome. Work-level public-domain status does not clear a translation or artwork. A source wrapper can be excluded without blocking reusable text; an unlicensed translation can invalidate that edition without invalidating the original work. A source URL alone is not rights clearance.
4. Produce deterministic normalized text/semantic span anchors and a reversible source-to-block mapping. Run adaptive AI composition in independently retryable chapter/section chunks; local structure/layout recipe selected per work with bounded validated formatting choices, without arbitrary model-authored executable CSS/code. Preserve every original word, punctuation, authored line break and meaningful structure; prohibit hallucinated changes.
5. Automated QA for omissions, duplicates, rearrangement, text integrity and separately excluded material; visual check in paged/spread/mobile Reader. Compare immutable source vs ARTales rendered preview in synchronized dual editorial view, keyed by stable text-span IDs, not visual page numbers.
6. Editor flags a precise region -> return/recompose only that region -> preview diff -> editor accept; approved blocks committed to draft in reconciled, idempotent batches. Keep existing live works untouched. Publication remains an entirely separate editor-authorized step.

## Architecture and rollout constraints

- Do not use Nexus worker queue for the core ingest implementation. ChatGPT plus GitHub/ARTales direct workflow are primary; Nexus workers may later support isolated bounded tasks only if explicitly needed.
- Work on feature branches from live `develop` and PRs to `develop`; `main` is production and requires separate user approval. Code merge does not imply any production Supabase apply.
- No production user data copied to ephemeral Supabase. Nonpersistent Supabase branch only during active short DB/Auth/RLS proof; delete before ending session. Fixture-first experiments for AI composition and Reader comparison.
- Production Supabase lacked all four candidate tables and draft-only constraint relaxation as confirmed read-only on 2026-10-09. `develop` contains migrations `20260928100532_work_candidates_foundation_p1_1a.sql` and `20260928100546_candidate_persistence_p1_2a.sql`. No DB production changes authorized/performed in this session.
- Repo `main` head on inspection `171df191eb54dbcef7bb015f748138c630428b2f`; `develop` before new PR `dcd405a5247afef5d93d51337a717dee2182a2c1`; they have divergent Git ancestry, reconcile deliberately only in future production release.
- The production database has 64 works (49 published, 15 draft), approximately 98,592 base content blocks; batching, integrity and backward compatibility are essential.
- Existing parser `lib/textParser.ts` uses tag/heuristic selection and collapses line breaks for most prose; Reader `lib/reader/paginateBlocks.ts` slices content by estimated budget. Hence canonical source spans and semantic block integrity must precede visual pagination tuning.
- Source assets do not inherit work-text rights; rights decisions must bind to the preferred source ID and exact component. Excluded material must be absent from ingest artifact, not merely displayed as excluded in UI.
- Safety: editor/admin RLS + server authorization, duplicate/idempotency guards, append audit, fail-closed missing rights, immutable provenance, versioned layout recipes and revision history. No automatic publish. Avoid exposing production customer data to model prompts.

## Small-PR execution sequence

A. **P1-2B corrective (#194):** real readback of source + rights from normalized persisted tables, source/candidate ownership and explicit work/edition clearance, tests. Draft PR targeting `develop`, created at head `dcd405a...`. At time of checkpoint, do not claim merge without checking GitHub live PR status; Vercel build only proves compilation, not DB E2E. Authorized by architect: promote draft to ready and merge to `develop` only **if green and semantically correct**.
B. **P1-2C1:** atomic editor/admin Candidate -> Work draft creation, selected source rights fresh read, `matched_work_id`/promotion audit in one transaction, idempotency, rollback, synthetic ephemeral DB proof.
C. **P1-2C2:** editor UI action when gate passes, detailed blockers when not.
D. **Capture v1:** separate immutable component snapshots with hash/provider/URL/timestamps/source edition identity and effective component decisions; safe source retrieval respects Gutenberg acquisition policies. Prototype independent fixture capture in parallel to B-C, before adding production schema.
E. **Adaptive Composer v1:** source-span anchored bounded chapter/section synthesis; JSON schema + safe renderer profile; no arbitrary runtime code or whole-book LLM prompt.
F. **Editorial dual Reader:** source/ARTales side-by-side with consistent selection and targeted return, regenerate changed spans, final editor accept.
G. **Controlled draft commit**, end-to-end pilot and separate future `develop -> main` promotion (including DB apply by explicit authorization).

## Minimum pilot and acceptance

- Pilot William Morris, *The House of the Wolfings*, Gutenberg #2885 only after component/edition clearance; start with fixtures if no clearance. Add ordinary prose and difficult poetry/table/footnote cases.
- First tangible milestone: editor views side-by-side source and composed Reader for one complete bounded section, returns one faulty layout region, agent fixes only that region, editor accepts. No production data modification.
- Tests: preserve exact normalized text and source span coverage; excluded wrapper, assets and translations; source rights matrix; idempotent retries; editor/admin vs member/anon; Reader paged/mobile layout. Never describe deployment READY as an authenticated end-to-end test.

## Carryover and follow-ups

- Existing #160 Reader sync progress PR is unrelated and should remain out of scope.
- Existing 2026-09-28 Phoenix remains context for phase history, P1-2A/B migrations, reader, fixture and Supabase cleanup conventions.
- ARTales durable checkpoint index `docs/ARTALES_DURABLE_CHECKPOINT.md` needs pointing to this dated checkpoint when merged.
- Targeted source/rights persistence issue in prior P1-2B: candidate detail did not call `getPersistedCandidateSources` and `getPersistedCandidateComponentRights`. Corrected in #194, pending review/merge verification.
- In candidate rights, absence of translation/asset rows should never be interpreted as affirmative permission to include such source components. Enforce again at capture artifact/actual content inclusion gate, not just candidate readiness.
- Plan separate controlled security cleanup for Supabase advisors, especially anon-executable SECURITY DEFINER procedures; review function bodies before asserting exploitability.

## Safe rehydration

Read AGENTS.md, this checkpoint, previous dated Phoenix 2026-09-28, durable checkpoint, WORKFLOW and RELEASE_POLICY; recheck GitHub branches, PR #194, Supabase schema and ephemeral state; execute only actions explicitly authorized in the current conversation. Start from smallest unmerged/unproven unit.
