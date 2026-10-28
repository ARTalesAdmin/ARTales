# ARTales — Migration Admission v0 (source-only)

Date: 2026-10-28. Status: proposed in Draft PR #281. No production executor active.

## Scope

Reuse official Supabase CLI migration list and db push --dry-run in a **future**, independently authorized ARTales-specific executor. Do not copy the Nexus identity/credentials or its existing authorization. A blanket db push can apply all pending migrations: exact pending-set admission is required, and unknown or multiple pending versions stop.

Implemented: offline-only `scripts/artales-migration-plan-core.mjs` and CLI `scripts/artales-migration-preflight.mjs`. These read canonical migration filenames and contents, a supplied operator-attested ledger JSON, a supplied exact request, and local Git HEAD. They check ARTales project ref, repo, main SHA, timestamp freshness, remote version order, historical SQL fingerprints, duplicate names/versions, and one expected pending filename plus SHA-256. The generated plan contains `mayApply:false`, `productionApplyAuthorized:false`, `liveCliDryRunVerified:false`.

### Operator evidence format

```json
{
 "schema":"artales-migration-readback/v0",
 "source":"operator-attested-provider-readback",
 "projectRef":"nmhdwmszbwgrgfbmlguu",
 "observedAt":"2026-10-28T12:30:00.000Z",
 "migrations":[
  {"version":"20260926142755","name":"remote_schema"},
  {"version":"20261023063248","name":"prescreen_shadow_library_v1","statementMd5":"<provider MD5>"},
  {"version":"20261024073928","name":"candidate_intake_ab","statementMd5":"<provider MD5>"},
  {"version":"20261025095658","name":"legal_screen_v1","statementMd5":"<provider MD5>"},
  {"version":"20261027081945","name":"snapshot389_storage_admin_rls","statementMd5":"<provider MD5>"}
 ]
}
```

```json
{
 "schema":"artales-migration-request/v0",
 "projectRef":"nmhdwmszbwgrgfbmlguu",
 "repository":"ARTalesAdmin/ARTales",
 "ref":"refs/heads/main",
 "headSha":"<exact approved 40-character main SHA>",
 "expectedPending":[{"filename":"<exact version_name.sql>","sha256":"<exact file hash>"}]
}
```

For a history-only rehearsal use `expectedPending:[]`. The baseline `remote_schema` has 557 provider SQL statements, so its identity is checked without claiming byte-equality of the export. All later one-statement migrations require a fingerprint match.

`node scripts/artales-migration-preflight.mjs readback.json request.json` is deliberately **not** a provider execution interface. Operator input is not independent authenticated provider proof, even when fresh. No token, password, secret, connection, migration repair or APPLY is created by the PR.

## Future execution gate (not part of v0)

1. Independently select and approve an ARTales-specific execution identity and surface. An OpenAI/Supabase blocked apply cannot be bypassed by switching to a privileged human console or hidden token.
2. Obtain fresh provider-authenticated ledger readback and verify the exact main HEAD and production-decoupling setting.
3. Validate the exact intended single pending migration and checksum.
4. From the approved operator, discover installed Supabase CLI flags via --help, run linked migration list and **db push --dry-run**.
5. Compare the provider dry-run with the approved plan. Stop on any ambiguous output or additional pending migration.
6. Seek exact Production APPLY authorization with the plan, CLI evidence and executing identity bound together. Do not infer authorization from CI.
7. In a separately reviewed implementation increment, add a narrowly governed apply path; read back the canonical Supabase ledger, ACL/RLS and app behavior. No blind retry after unknown outcomes.

## Dependencies

- PR #280 historical migration reconciliation already merged into main.
- PR #279 Identity Authority remains Draft, unapplied, blocked until an approved production migration path exists.
- PR #278 Snapshot general remains Draft, feature OFF and unapplied.
- No automatic Production deploy from the currently unconnected Supabase GitHub integration was observed in the Architect's dashboard evidence; recheck before future merges.
- This PR requires separate merge authorization and is not permission to link/activate a provider.
