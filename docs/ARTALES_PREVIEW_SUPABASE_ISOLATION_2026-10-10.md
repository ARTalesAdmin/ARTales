# ARTales preview isolation, 2026-10-10

## Goal and scope
Protect the existing production Supabase and all real editor writes while keeping a free default develop fixture preview. **No persistent Supabase development branch.** Real DB workflows use a short-lived ephemeral Supabase branch and must be removed after active tests.

## Observed before the fix
Vercel `NEXT_PUBLIC_SUPABASE_URL` shared Development/Preview/Production and pointed at production ref `nmhdwmszbwgrgfbmlguu`. The branch-specific `ARTALES_FIXTURE_MODE=candidates` protected some candidate CRUD only, while other authored content routes still made real DB calls. Only production `main` Supabase branch exists; candidate and editorial migrations have not been applied to production.

## Design
All standard Supabase client entry points now resolve an environment target before connecting:
- `production`: uses the previously configured Supabase URL and key unchanged. Existing production editor creates/edits authors, works, collections and tags normally.
- `preview`: refuses any production Supabase ref even if incorrectly configured. Without an explicitly matching `NEXT_PUBLIC_ARTALES_EPHEMERAL_SUPABASE_REF` and ephemeral URL/key, points to invalid local-disabled URL/key, so accidental DB calls cannot connect to production.
- Local loopback development may use local Supabase. Other unrecognized remote environments fail closed.
- Protected service-role administrative connection is not available against a disposable ephemeral branch until an independent, correctly scoped ephemeral admin key solution is reviewed. It cannot reuse the production service-role key.
- Candidate fixture pages can render without authenticated database access when preview DB is explicitly disabled. Generic `requireEditorOrAdmin` no longer uses a fixture editor for unrelated author/work operations. Fixture forms remain no-write.

## Important deployment limitation
The code gate alone is **not the whole network isolation boundary**. The Vercel configuration still has a production credential at Preview scope until explicitly changed. There must be a separate, authorized Vercel preview env migration so that Preview cannot receive production credentials at all (including client-side `NEXT_PUBLIC_SUPABASE_*`). Remove production service-role key from Preview; Production-only variables stay intact; set Preview default to deliberately unavailable nonproduction config. During an ephemeral test, temporarily configure branch-specific Preview URL/key/ref, then restore/remove and delete ephemeral Supabase branch. Verify the resolved deployment target without exposing keys. No Vercel configuration was changed by this PR.

## Acceptance / gates
- 7/7 isolation tests and TypeScript `tsc --noEmit` passed on isolated Vercel Sandbox, stopped after tests.
- Need deployed preview readback and negative write tests after env cleanup. Cannot claim full E2E from unit tests.
- **Before merge of this PR:** review browser-side Vercel env injection behaviour and SSR import boundaries for module-level client; CI/deploy check and preview access.
- **Before real integration:** ephemeral branch, prerequisite migrations, isolated Auth, role tests, user-visible work/task flow, DB cleanup.
- #200 stays Draft and blocked from code merge until this safety boundary is in place.

## Risk / rollback
High: authentication and DB routing. Target `develop` only. DB: no. Env: yes, future separately authorized Preview-only operations. No `main` or production Supabase changes. Revert this PR from `develop` if regression; rollback of Preview env must never reconnect preview to production without explicit risk approval.

## Applied Vercel Preview environment isolation (2026-10-10)

With architect authorization, Vercel project `ar-tales` was updated **without changing any production values**:
- Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` now target `production` only.
- Existing `SUPABASE_SERVICE_ROLE_KEY` now targets `production` only.
- Two new Preview-only encrypted values are set to an intentionally unavailable `.invalid` URL and placeholder publishable key. Values are not secrets and are not suitable for writes.
- A readback of Vercel environment scopes confirms exactly these five scoped entries.

This is a **configuration update**, not evidence that already-built immutable preview artifacts were retroactively rebuilt. Any older preview URLs compiled with previous `NEXT_PUBLIC_*` values must not be used for logged-in testing; re-deploy current commit to verify it gets the new Preview-only values. Production is unaffected. For an ephemeral DB E2E, create isolated branch, configure exact branch-scoped URL/key/ref temporarily and remove them before deleting the branch; no persistent Supabase branch.
