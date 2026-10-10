# ARTales Editorial Inbox — 2026-10-10 pilot / handoff

Goal: ARTales must independently offer editors a shared task inbox ("na rozebrání"), atomic claim and return, without requiring Nexus. Admin can queue an eligible *candidate review* task. A later stage creates actual content-editing tasks only after a verified, immutable rights dossier and draft promotion.

## Scope and safety
- Dedicated feature branch from develop `4f630c4a581ef85c70b25ea6c9f3ecb6050a7c88`. No Nexus queue, main changes or production Supabase apply.
- SQL migration generated via Supabase CLI 2.120.0 (`supabase migration new artales_editorial_tasks_pilot`). Files: `supabase/migrations/20261010111107_artales_editorial_tasks_pilot.sql`.
- `editorial_tasks` and `editorial_task_events`: only active editor/admin can SELECT via RLS; no direct client INSERT/UPDATE/DELETE grants. Every claim/return logs an event. Task target references candidate OR work, not both.
- RPC `claim_editorial_task` atomically updates only an OPEN task. Concurrent claims result in one winner; losers receive unavailable. `return_editorial_task` requires owning editor or admin. Explicit actor checks `auth.uid()`.
- Only active admin may `create_editorial_task_for_candidate`. It re-reads candidate while locked, requires ready/accepted, completed discovery, matched identity, non-reviewed overall rights, and an existing preferred source; still only creates a **legal_review** task. It does not assert legal validity. Duplicate enqueue is idempotent via `source_system+source_external_id`. At most one task of the type for the candidate.
- ***Security debt/important review:*** The exposed functions are `SECURITY DEFINER`. Although anon/public execute is revoked, each has explicit actor/role checks and empty search_path, they need independent Supabase security advisor, RLS/permission/trigger review and readback proof before integration. Do not apply to production without fresh explicit approval.
- UI routes: `/member/editorial-tasks` (editor/admin inbox) and `/member/admin/queue-candidates` (admin can queue candidate review). Server actions use end-user Supabase session and redirect on error.
- These are the first steps only; no AI call, no paid job runner, no actual editorial artifact creation, no durable catalog run budget table, no automatic publication or retraction.
- The feature assumes candidate foundation/persistence migrations from develop exist on DB. Production presently lacks these, so routes show DB-unavailable state until environment is prepared.

## Next end-to-end pilot
1. Create short-lived Supabase branch, apply existing candidate migrations and this migration with synthetic profiles/candidates.
2. Verify read-only scopes for admin/editor, deny anon/member, concurrent claims and return policies, duplicate enqueue, append-only events, RPC ownership, invalid UUID, no task for blocked candidate. Confirm RLS and advisor results.
3. Connect preview deployment to explicitly scoped ephemeral DB, not live production database; verify authenticated editor login and task claim in browser.
4. Integrate catalog screening with *trusted signed rights dossier*; automatic candidate creation with bounded spend and checkpoint. Only then promote legally eligible source to draft and generate `edit_text` task. User's desired destination is 5 candidate-to-editorial-ready titles, not a reservoir of candidates.
5. Future editorial phases: text QA / revision / visuals assignment (e.g. Ivana / Ajwen via actual user profile, never guessed user ID) / release gate; costs and legal challenge / unpublish audits later. Do not add production auto-publish.

## Separate parallel stream
PR #196 owns ingest/composition/editor Reader. PR #197 owns catalog/rights synthetic batch demo. This PR works on separate files except sidebar/dashboard links; integrate sequentially with current develop head.

## Tests not yet performed
SQL not applied to ephemeral DB; Node/TypeScript/UI tests not run; Vercel build must be checked. This is a **draft with known unverified privileged functions** and must not be described as a working database-backed inbox until confirmed.

## Rollback
Before production apply: revert PR. If applied to ephemeral, delete the branch after tests. A future production release requires a non-destructive migration rollout and explicit owner approval, plus availability/accessibility proof for old app versions.

## 2026-10-10 corrective security review
- The first SQL draft contained a malformed PL/pgSQL delimiter (`as $ ... end $`) in the enqueue function, which Vercel's TypeScript build did not test. Replaced the migration content before any DB apply.
- Public RPCs now use `SECURITY INVOKER` and normal authenticated grants under explicit RLS; mutable columns are whitelisted. Task transition/audit triggers reside in an unexposed `artales_internal` schema with revoked direct execute, and preserve an append-only event trail atomically. The triggers are privileged and still require function body/advisor review on ephemeral DB.
- Candidate review task remains legally non-authoritative and never creates a draft or grants rights. Source origin/external unique key prevents duplicate enqueue. This corrective patch is not database-validated yet.
- Ephemeral branch cost on 2026-10-10 checked at USD 0.01344/hour. No fresh ephemeral branch opened during this security correction; await separate cost-confirmation workflow for a short-lived proof, then delete it within the same session.

## Ephemeral SQL verification — 2026-10-10 (closed)
- Project `pmczalupwbyxltpesfxi` / branch `artales-editorial-inbox-proof-20261010`; price quoted USD 0.01344 per hour. Branch ID `0140d684-d410-4e71-8933-ce6ebe698c48`.
- Applied candidate foundation, candidate persistence, and this editorial inbox migration successfully **on ephemeral only**. Production project was not modified.
- Verified public RPC `claim_editorial_task`, `return_editorial_task`, `create_editorial_task_for_candidate` have `prosecdef=false`, `anon EXECUTE=false`, `authenticated EXECUTE=true`.
- Synthetic admin/user and candidate+source: first enqueue + repeat resulted in **one** task and **one** created audit event.
- Synthetic editor: first claim, repeated claim, return resulted in task `open`, no assigned editor, and **three** audit events (created, claimed, returned).
- Test transactions rolled back. Post-rollback counts: candidates=0, tasks=0, events=0.
- Unauthenticated `authenticated` role without user identity invoked claim and received expected `42501 editor_role_required`.
- Supabase security advisors had earlier pre-existing flags for `page_views`/`work_contributors` RLS with no policies, `public.set_updated_at` mutable search path, and 11 other public anon-executable SECURITY DEFINER functions; **no claim that the baseline is clean**. No newly introduced public SECURITY DEFINER RPC.
- **NOT VERIFIED:** two independent sessions simultaneously claiming same ID, member-role denial with real JWT, direct-column bypass attempts, full browser preview authenticated against ephemeral, complete negative role matrix, production migration compatibility. These remain blocking review items.
- CLEANUP: branch deletion returned success; subsequent list showed only production main. No ephemeral left running.
