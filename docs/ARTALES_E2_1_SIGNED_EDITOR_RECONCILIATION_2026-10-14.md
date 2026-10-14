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

## Architect-only pilot amendment — 2026-10-14

Architect explicitly clarified that the early migration pilot is **self-tested by the architect in their existing admin/editor identity**; no Ivana/Pavla invitation, task assignment, notification, or 50/50 recuration of previously edited titles. They are non-technical domain editors and must receive an already hardened user-facing experience after repeated architect iterations. For existing works the goal is mostly deterministic source reconstruction plus targeted exceptions, not redoing completed editorial work. Time-to-review target: approximately 10 minutes per work after maturation, **not a proven SLA**.

The local-only E2 assembly now adds an admin-only `enqueue_semantic_v2_self_pilot` RPC, an immutable private task provenance row, and a canonical `editorial_tasks` work task claimable only by the initiating admin identity. Pilot rows and their events are hidden from other editorial staff via RLS. `stage_semantic_v2_draft` requires that exact claimed owner on pilot-enrolled works. This is a same-identity *editing* convenience, not a shortcut around **independent editorial approval**, which remains a separate unresolved release gate. No second fake editor identity is introduced for the architect, and no historical approved/public edition is changed.

**Important:** the signed QA tests for this amendment are running; no positive real browser save/readback or exact-head CI result may be claimed before the new head succeeds. No preview user delivery or production DB changes. Extra strictness: legacy public Reader/notes/progress remain unchanged; the raw source fixture alone does not establish legal clearance or actual archival provenance.

## E2-1 admin editor screen — implementation handoff

The feature branch now contains `app/member/works/[slug]/semantic/page.tsx` and server actions, backed by the provisional E2 SQL. A real authenticated admin can enqueue and claim **their own** scoped pilot task, read exact archived source bytes from a privileged auth-bound RPC, create a deterministic immutable initial revision, verify readback from a fresh RPC call, and apply a child revision only after an anchored independent return. The initial page includes refresh-persistent SHA/round/source evidence and an immutable source text inspector. **No publication path exists.**

**Fail-closed opt-in:** the route is intentionally 404 unless the authenticated profile matches `ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID`, and the target is local Supabase or an explicitly configured nonproduction ephemeral ref; production Vercel is unconditionally refused. This new environment setting is server-only, must not be NEXT_PUBLIC, and must only be configured for an expressly authorized, short-lived preview test. No setting has been deployed. Preview DB isolation remains controlled by `lib/supabase/connectionIsolation.ts`; there is no persistent Supabase branch or preview DB.

**Current usability constraint:** initial enqueue requires a real archived snapshot UUID for the matching work; there is no verified source-discovery/legacy-archive ingestion UI in this slice. If no source has been safely captured, the form must remain unusable, not silently substitute a local text fixture or old content. The current source accessor limits archived bytes to 1 MiB and exactly one QA WORK_CONTENT component, protecting the pilot from ambiguous or oversized source inputs. No nontechnical editor rollout.

**Test target:** signed GoTrue admin can create own task and claim, another editor cannot claim/see it, only owner can fetch exact archived bytes and save, initial save persists across fresh read, and a second save is possible only after independent anchored return. Current PR has not proved actual end-user browser persistence. A green local signed DB CI is not a deployed browser E2E.

**Remaining blockers:** browser preview signed Auth and usability; upload/source capture route for existing works; private editor_note persistence vs public note/footnote; independent final approval/revision+task closure; rigorous negative tests for concurrent editing; legal evidence; release gate. PR stays Draft until those are complete. Neither editor UI nor the provisional SQL belongs to production without separate user authorization.

## 2026-10-14 source-picker increment and approval gate hold

The private pilot now provides `list_semantic_v2_self_sources`: a signed, admin-only, read-only, bounded selection from archived DB-A external_raw / WORK_CONTENT components. The user sees date, hash prefix and byte length instead of manually entering an opaque UUID. Source selection is disabled when archival evidence is absent. The source is validated again server-side during enqueue and composition. No production source capture or rights clearance is inferred.

The independent final approval/atomic task closure was evaluated but a first SQL assembly failed structural checks before any CI validation. That malformed change was **fully reverted** to the last-known-good E2 assembly on commit 4974f6d4e37b90951ba7332bd75642586cd3d8cd. Do not claim approval has been implemented or previously tested. A narrow independent approval follow-up with separate negative tests is required. No human test invitation, production application, automatic assignment to Ivana/Pavla, release or merge is authorized by this work. This PR remains Draft.

Browser proof still requires a real separate QA Supabase environment, a nonproduction user identity authorized for that ephemeral branch, and a session with verified cleanup. No ephemeral cloud branch was created. The current source selection verifies DB-A archive identity, not a new legal determination.

## Independent approval proof increment — 2026-10-14

An **isolated local-only SQL proof** was added as `supabase/ci/alice_e2_approval_proof.sql`. It defines an append-only approval record tied to exact work and draft IDs, requires a distinct active admin signed JWT, rejects a pending return, performs replay/idempotency checks under the existing per-work head lock and always returns `publication_allowed=false`. Signed GoTrue negative and positive tests were added to the disposable local E2 CI.

**THIS DOES NOT COMPLETE E2-1:** the pilot approval proof does **not yet** atomically transition the canonical `editorial_tasks` item to `completed`, does not freeze subsequent saves or returns at the DB entrypoints, and is not wired to the browser UI. Those are mandatory checks before any human full-flow test. A green proof test would only validate the bounded approval record, not the entire finalization contract. No migration, preview DB setup, merge or publication has been performed. The PR stays Draft.

## Product decision superseding universal independent approval (2026-10-14)

**Read first:** [ARTALES_EDITORIAL_RELEASE_APPROVAL_POLICY_2026-10-14.md](./ARTALES_EDITORIAL_RELEASE_APPROVAL_POLICY_2026-10-14.md). The architect clarified that routine sourced/imported works may be QA-approved by their assigned editor (including the architect themselves) provided **all** exact-version legal, text, visual/EMPTY, layout and reader checks pass. Cross-review is reserved for editor-authored original work, a requested extra check, or other genuinely unresolved escalation. Length alone does not mandate dual review. This supersedes any wording elsewhere in this PR saying a distinct reviewer is universally mandatory.

**Current signed SQL remains unchanged in this increment.** It still rejects self-review and never publishes; its independent-review tests are useful as the optional/required two-actor branch, not proof of the revised one-actor path. Updating the signed approval contract needs separate explicit trusted work-origin evidence, exact QA bundle and negative tests; do not simply remove the self-review predicate. No publish or automatic approval enabled. This is an implementation-ready policy record, not an authorization to deploy.

## 2026-10-14 — architect-only Alice text QA shortcut (implementation in Draft)

The architect authorized a first QA work assigned to their own profile in develop, with **no default second reviewer** on sourced existing works. To keep the experimental rights/release split intact, this increment permits the owner to attest **text QA only** for the exact existing Alice slug, English language, `public_domain` origin, `gutenberg` source label, pinned external snapshot URI `https://www.gutenberg.org/ebooks/11`, active own claimed task, and immutable exact head/hash. Every other self-review remains blocked by signed SQL. A new explicit button in the private editor invokes the signed SQL, checks a fresh approval readback and closes the task. **publication_allowed remains false** and public works/content/notes/published status are not modified. This is not a rights determination or a general editor release authorization.

**Critical remaining test gates:** the existing four-principal signed CI proves the legacy independent-review path, not the new Alice positive self-QA path. Before merging, test a synthetic pinned-Alice self-QA success and denial cases (wrong slug, URI, origin, source, own original; missing task; altered hash). Browser smoke and actual QA need a real protected ephemeral database with the project's full historical schema, an authenticated identity mapping to the architect, an actual archived captured Gutenberg edition (not a synthetic claim), and checked cleanup. No ephemeral branch currently exists; production schema lacks the migration stack. The private route is opt-in via server-only `ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID` and disabled for production. A merged code branch alone **cannot** deliver a functioning preview task.

**Merge gate:** do not merge Draft #243 into develop while the Alice signed positive path and browser/ephemeral data prerequisites remain unsatisfied. Never silently apply provisional `supabase/ci` SQL to the production project. No direct `main` or Reader cutover.
