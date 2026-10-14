# ARTales E2-1 — signed editorial vertical reconciliation (2026-10-14)

> Development-only handoff. This branch is **not a complete E2-1 implementation**, migration, legal clearance, or publishing authorization. Canonical instructions: AGENTS.md, WORKFLOW, RELEASE_POLICY, Phoenix 2026-10-13.

## Baseline and what this branch actually contains

- Clean base: develop `ad694bc96b52fd2a172ec1805bd594c3b6ea35f9`; production main untouched.
- Reused *exactly scoped* security/provenance proof from Draft #223 instead of merging its divergent 38-ahead/84-behind integration branch.
- Adds provisional **local-only** E2 draft SQL; immutable signed save, source-anchored independent return, child save and readback, component bridge, digest verification and narrow tests.
- Fixes Composer anchor comparison to use exact typed fields when JSONB key order changes, rather than serialized-object equality.
- Expands CI paths to include signed readback tests, Composer regression, local GoTrue/PostgREST check and unconditional local Supabase stop.
- **No preview editor write UI, no independently approved final head, no legacy work-specific task assignment, no production DB changes**. Do not mark this pilot done from a green workflow.

## Findings: why the remaining E2-1 vertical is not yet proved

1. `app/member/works/[slug]/semantic/page.tsx` from #223 is deliberately read-only, uses a pinned local Gutenberg fixture rather than a trusted stored Alice source and has no Save, Return, or Approve actions. Do **not** port it as an active editor without genuine provenance.
2. Existing `public.editorial_tasks` supports `open -> claimed -> open`, but its create policy/trigger primarily authorizes candidate `legal_review`, with a narrowly scoped `edit_text` task from *new candidate promotion* in the later migration. An already-published legacy work cannot be safely assigned by assuming that candidate route or by a manual insert.
3. The signed E2 test uses **admin author + distinct admin reviewer**, and correctly denies an unassigned editor. It does **not** prove a positively assigned editor or an independent `approved` transition. It also currently permits one outstanding return and one limited `indent_small` recipe.
4. `get_semantic_v2_editor_state` returns stored serialized revision and checks work/source; the JS verifier hashes the exact payload and verifies Composer structure. Neither path on its own proves independent legal clearance.
5. Existing approved QA policy requires preservation of public `note`, `footnote`, and private `editor_note`. Full legacy mapping and durable private annotations remain unimplemented. A generic review issue is not a substitute for `editor_note`.
6. `public.works` currently has an old direct publication update path. E2 never invokes it; server-side gated release must be implemented separately.

## Exact follow-up implementation slice (high-risk, not authorization to deploy)

**A. Legacy `edit_text` assignment, one source of truth.**
Add an admin-only, signed, idempotent RPC to create a work-scoped task only after verifying stable existing `works.id`, archived source SHA, legal *editing* eligibility and assigned active editor profile. Do not forge a candidate, clear a legal HOLD, or reuse the new-candidate promotion function. Extend existing task events/transition contract, not a competing queue. Explicitly close grants and RLS; add concurrent duplicate, foreign-work, inactive editor, unauthenticated, self-assignment and replay tests.

**B. True signed editor lifecycle.**
Use the existing signed source bridge and immutable E2 draft as the backing store for a gated editor route. Under an actually **claimed** `edit_text` task and a freshly signed editor JWT: load current head, propose one validated semantic change, Save, independently reload and verify exact digest/work/source/parent, attach a private editor note, submit, return with anchored reason, save a changed child, submit and independently approve the exact head. Signed independent approver may not be the author. No stateful localStorage as authority.

**C. Approval contract.**
A separate immutable approval event must lock work+source+head hash+task+reviewer and serialize against concurrent Save/Return/Approve; stale head, pending returns, self-review and idempotency misuse fail closed. Task complete and approval event are one transaction. The result is **editorial approved / publication_allowed=false**, not a public release pointer.

**D. CI.**
Use disposable local Supabase only, real GoTrue tokens for separate admin/editor/reviewer/reader, two independent database connections for race tests, negative RLS/grants checks, exact snapshot byte hash and note leakage tests. CI needs successful exact-head checks before merge. If preview auth is needed later, a short-lived expressly authorized Supabase branch must be removed in the same session.

## Explicit exclusions

No merge of #223 or this Draft, no SQL apply to live `nmhdwmszbwgrgfbmlguu`, no paid persistent preview branch, no main changes, no Reader cutover, no production environment change, no legal clearance, no release, no Nexus workers.

## Rollback / clean-up

The changes live exclusively in this feature branch; discard or revert this PR if the local SQL security audit/CI fails. No live data was written. All provisional E2 SQL remains under `supabase/ci`, not a canonical production migration. Any future migration is a separate reviewed PR and separate production authorization.
