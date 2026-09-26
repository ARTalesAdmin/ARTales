# ARTales Supabase schema baseline v0.1

Status: repository baseline candidate for `develop`.

## Purpose

ARTales historically kept additive SQL files under `lib/supabase/migrations/`, but that chain begins after core tables already existed and could not bootstrap a clean Supabase preview branch.

Supabase production now records migration `20260926142755_remote_schema`. This PR versions the exact schema statements from that registered baseline under the standard Supabase CLI migration path:

`supabase/migrations/20260926142755_remote_schema.sql`

## Evidence

Read-only production inspection on 2026-09-26 found:

- migration history: one registered migration, `20260926142755_remote_schema`;
- statements: 557;
- public tables: 29;
- public functions: 12;
- public RLS policies: 60;
- public triggers: 4;
- baseline data DML: 0 INSERT, 0 COPY, 0 UPDATE, 0 DELETE.

The baseline is schema-only. It must not be treated as permission to copy production data.

## Migration-path decision

For reproducible Supabase bootstrap, `supabase/migrations/` is the canonical baseline path from this point forward.

Existing files under `lib/supabase/migrations/` remain historical/project migrations and are not deleted or silently rewritten by this PR. The next dedicated migration-path reconciliation should avoid duplicate execution and should be proven on an ephemeral branch before any production apply.

P1-1A currently remains at:

`lib/supabase/migrations/2026-09-26_work_candidates_foundation_p1_1a.sql`

It is the first intended post-baseline preview migration.

## Security fidelity

The baseline deliberately reproduces current production schema rather than silently correcting it. Current Supabase advisors therefore remain relevant, including existing SECURITY DEFINER exposure and other RLS/security findings.

Those findings require separate, reviewed hardening migrations. They are not mixed into the bootstrap baseline.

## Required proof after merge to develop

1. create one temporary Supabase branch for the active test session;
2. confirm it contains the baseline core tables without production data;
3. apply P1-1A work-candidate migration;
4. run security/performance advisors;
5. verify editor/admin candidate access and member denial;
6. point the ARTales preview at the intended ephemeral DB or otherwise prove the DB target explicitly;
7. create The House of the Wolfings through the candidate UI/workflow, not via migration hard-code;
8. delete the ephemeral branch in the same active session;
9. record branch ref, opening/deletion times, applied migration and result.

No production schema mutation is authorized by this document.
