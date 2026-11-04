# Editorial pool and AI QA suggestions (draft implementation, 2026-11-04)

## Scope and current release status

Isolated feature branch built from production main `72ae85687b9aefbad8fd5d72f3f6706b974e1c37`.
No production SQL, environment change, or activation is authorized by this PR.
Changes are **not live** until a separate reviewed merge, migration, environment and deployment approval.

## Editorial pool

- Exact eligible roles live in `artales_editorial_capabilities`. Initial allow-list:
  - Pavla: text QA, blurb, author text, proofreading, second review.
  - Ivana: same text competencies, plus cover, author visual, collections, visual QA.
- For newly composed works, text QA, blurb and author biography start **unassigned**.
  Existing assignments are preserved; explicit legacy work transfers remain reserved.
- Covers, author visuals and collections use an explicit configurable default owner
  (initially Ivana). The owner must be competent, including on admin reassign.
- One authenticated editor can atomically claim a free task. A profile-level row lock
  serializes capacity checks for simultaneous claims; task row locking prevents theft.
  A voluntarily claimed/assigned text QA title occupies the one-title capacity;
  the editor can complete or release it before taking another different title.
- Current-revision checks apply to text QA claims. An older text revision is not
  another title to take from the shared pool.
- An assigned editor can return optional text work to the shared pool with a reason.
  The administrator can reassign any non-completed task to a competent editor.
  Ownership transfers are stored with from/to actors in `artales_editorial_events`.
- RLS restricts editorial task reads to own assignments, unassigned work within
  eligible competencies, and full admin oversight. Event history is restricted.
- The member navigation's existing badge remains personal. The editorial dashboard
  separates own work, available titles, and the administrator's performance view.

## AI QA suggestions

- The new **suggest** action is only available to the administrator or the
  owner of a *claimed* text QA task at the exact latest semantic revision.
- Fetches up to 25 open flags with precisely anchored excerpts and bounded context;
  does not submit the full title or unrelated candidates.
- Requires explicit server-only `ARTALES_EDITORIAL_AI_API_KEY` and
  `ARTALES_EDITORIAL_AI_MODEL` configuration. No default model or hidden API spend.
- Uses provider Responses API strict JSON schema. Parsed suggestions must cover each
  requested flag ID exactly once, with an allowed action and validated constraints.
- AI never directly updates, excludes, publishes, resolves a flag, or mutates an
  archive. Valid deterministic suggestions only preselect controls for a
  **separate human-approved** existing batch action; protect-term requires
  explicit human click. Unsupported corrections remain manual review.
- Full literary text editing / general-purpose AI rewriting is **not** implemented
  by this PR: the source-anchored immutable v2 schema does not allow arbitrary
  rewritten raw blocks. That requires its own edition-text overlay and strict
  provenance validation before any such changes may ship.

## Proposed rollout order (independent approvals required)

1. Review database policy diffs and test RLS under Pavla, Ivana, admin, an unrelated
   member, and anon. Verify claim races with concurrent independent sessions.
2. Apply targeted SQL only after production DB approval, preserving the pre-change
   policies/functions for rollback. SQL migration adds no destructive operations.
3. Set **optional** AI environment keys in an explicit, separately authorized
   environment step; leave absent to keep AI disabled. Do not expose API key to client.
4. Merge reviewed exact branch commit only when authorized. Deploy to production
   with a separate approval and verify signed-in editor sessions.
5. Validate badge counts, shared claims, capacity, release/reassignment,
   completion attribution and one QA revision per approved batch.
6. For AI, verify missing-key failure, provider failure, corrupt JSON, stale revisions,
   out-of-scope flags and expensive/repeated calls. Establish a budget and rate limit
   before enabling the provider for editors.

## Known limitations

- Current editor panel supports deterministic presentation/exclusion only.
  The AI stage suggests but does not autonomously perform full text corrections.
- Admin completion aggregates by task completion, not estimated labor time.
- The existing assignment of Pan stays intact until explicitly transferred or completed.
- Signed-in end-to-end behavior, DB RLS execution and live AI provider calls have
  not been verified in this isolated branch.
- Full worker completion, manual task bundles, autonomous AI repair queue, and
  richer pipeline phase breadcrumbs are outside this first deliverable.
