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
- AI never proposes exclusion of literary content. Only a human can explicitly request a bounded removal of external edition apparatus, subject to the existing admin approval gate. AI never directly updates, publishes, resolves a flag, or mutates an
  archive. Valid deterministic suggestions only preselect controls for a
  **separate human-approved** existing batch action; protect-term requires
  explicit human click. Unsupported corrections remain manual review.
- An editor-authorized correction of a mistake in the original source would require a separately created, provenance-preserving revised textual edition, never silent replacement of source bytes. Full literary text editing / general-purpose AI rewriting is **not** implemented
  by this PR: the source-anchored immutable v2 schema does not allow arbitrary
  rewritten raw blocks. That requires its own edition-text overlay and strict
  provenance validation before any such changes may ship.

## Same-session live layout preview (implemented in draft)

- The same server-side validated plan can now be projected in the existing QA reader
  without writing to the DB. The draft revision preserves all atom IDs, raw text,
  source hashes, original byte anchors and source separators.
- The reader uses the draft as an isolated presentation state, runs its normal
  browser measurement and page projection over that draft, and shows a prominent
  "neuloženo" warning with a return-to-original button.
- When the actual source revision changes, a preview for the old SHA is discarded
  rather than masquerading as the new current revision.
- Admin-only persisted batch commits still use the existing SQL guard and
  automatically `router.refresh()` the current page. Editor self-service commit
  remains deliberately disabled until the database can authenticate narrowly
  scoped patch operations without allowing an editor to submit forged full JSON.
- A durable proposal queue is implemented in this draft behind
  `ARTALES_AI_DURABLE_JOBS_ENABLED=enabled`; by default it is OFF.
  It creates an identity-bound row with a snapshot of open flag IDs, refuses stale
  revisions and limits each editor to four requests per hour.
- A Vercel Cron endpoint runs once per minute and claims one queued job with
  `FOR UPDATE SKIP LOCKED`, using a server-only service-role credential, protected
  by `CRON_SECRET`. Incomplete jobs are retried at most once.
- The QA panel polls queued/running jobs while open, restores the latest job after
  revisiting the same revision, and displays durable results for human approval.
  Closing a browser does not cancel a successfully enqueued job.
- When the durable queue is not enabled, the old bounded foreground server action
  remains as a fallback. It does NOT survive a closed tab.
- The viewport matrix regression exercises desktop/mobile layouts, long paragraphs,
  source continuity, and repagination after a purely presentational change.
  It is not a substitute for visual screenshot testing in actual browsers.

## Proposed rollout order (independent approvals required)

1. Review database policy diffs and test RLS under Pavla, Ivana, admin, an unrelated
   member, and anon. Verify claim races with concurrent independent sessions.
2. Apply targeted SQL only after production DB approval, preserving the pre-change
   policies/functions for rollback. SQL migration adds no destructive operations.
3. Configure separately authorized server-only environment keys:
   `ARTALES_EDITORIAL_AI_API_KEY`, `ARTALES_EDITORIAL_AI_MODEL`,
   `ARTALES_AI_DURABLE_JOBS_ENABLED`, `CRON_SECRET` (at least 16 random bytes)
   and `SUPABASE_SERVICE_ROLE_KEY` for the protected cron worker.
   Keep the durable feature disabled until the DB job migration and security tests
   are complete. Do not expose any key to client code.
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
- Durable AI jobs and progress polling are implemented in the branch but have NOT
  undergone real DB, preview worker, or authenticated browser tests and are OFF
  until explicitly authorized and configured.
- Actual editor-authorized persistence of narrowly scoped presentation patches,
  browser screenshot rendering regression, detailed per-job cost accounting and
  richer phase breadcrumbs remain incomplete.
