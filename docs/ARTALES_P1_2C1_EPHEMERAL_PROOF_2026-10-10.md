# P1-2C1 — 2026-10-10: ephemeral transaction proof and integration boundary

Scope: candidate → one draft, edition provenance; no Nexus worker queue and no overlap with PR #196 ingest/composer files.

## Session verification
- Develop base: `4f630c4a581ef85c70b25ea6c9f3ecb6050a7c88`.
- Ephemeral Supabase branch: `artales-p1-2c1-oct10-ephemeral`, ref `pnuftlmixxhmmygmvqno`. Quoted branch price USD 0.01344/hour; created with user authorization.
- Applied `20260928100532_work_candidates_foundation_p1_1a.sql`, `20260928100546_candidate_persistence_p1_2a.sql`, and experimental `docs/prototypes/ARTALES_P1_2C1_EPHEMERAL_PROOF_V2.sql` to ephemeral only. First migration initially raced initial schema provisioning; retry after schema readiness succeeded.
- Created synthetic auth user, editor profile, author, candidate, selected source with explicit reviewed provenance, work/edition rights, and performed two authenticated RPC calls inside `BEGIN ... ROLLBACK`.
- After calls, row counts were **works=1, promotion attempts=1** (exactly one draft and audit record). This verifies no duplicate insert in the sequential retry.
- After rollback, **works=0, candidates=0, promotion attempts=0** on the branch.
- NOT verified: concurrency under independent sessions, forced partial-failure rollback, member/anon authorization across all paths, source/rights update races, Vercel authenticated runtime integration, full provenance UI persistence.
- Prototype SQL is noncanonical in `docs/prototypes/` and was not introduced as a production migration. It must not be applied automatically.
- A new shared read-only `lib/candidateProvenance.ts` preflight and focused tests require edition-specific mapping, reviewer and current source revision; this is not a substitute for rechecking inside the RPC.
- Do not merge a live action to develop until full DB proof, canonical migration (Supabase CLI unavailable from the execution environment) and explicit source review UI exist.

## Implementation concerns
- Review stamp and source mutation must be transactionally coupled: an old signature cannot be retained after source fields change. An editor action should explicitly re-sign only after review; never auto-approve rights by checking a box implicitly.
- Existing `updateWorkCandidate` derives strong identity from discovery status and persists source/rights via separate requests; avoid treating that as an authoritative one-step promotion gate.
- A `public_domain` origin is not a license for a translated edition or illustrations. Each included component must have explicit usable rights. Excluded components must not reach the ingest artifact.
- Slug should remain candidate-id-based and collision-safe. Keep draft unpopulated and unpublished.
- Production Supabase still has no candidate migrations. Code/PR merge does not authorize DB apply.
- Second ARTales chat works in isolated PR #196. Coordinate by rebasing on develop after merges, never rewriting the other chat's files.

## Cleanup
**CLEANED UP:** Supabase delete_branch returned success. Subsequent list_branches showed only production main; the ephemeral branch and synthetic test data are gone. No production modifications were performed.
