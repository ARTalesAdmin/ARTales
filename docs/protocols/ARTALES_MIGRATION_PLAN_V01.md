# ARTales — PLAN v0.1, provider-ready specification (NOT activated)
Date: 2026-10-28; Draft source-only PR from main.

## Rationale
ARTales previously used SQL and Supabase migrations without this exact
PLAN/APPLY contract. This is a NEW control, not a historical ARTales practice.
Snapshot general #278 is waiting on Identity Authority #279, which itself is
waiting on a safe source-to-ledger migration boundary.

## Supabase CLI version and semantics
Reviewed official Supabase CLI source at tag v2.122.0 (released 2026-10-23):
- \`migration list\` supports \`--linked --project-ref <ARTales ref>\` and
  \`--output-format json\`; JSON reports \`migrations:[{local,remote,time}]\`.
- \`db push\` supports \`--linked --project-ref ... --dry-run --skip-vault\`,
  with JSON fields \`upToDate,dryRun,migrations,seeds,roles,message\`.
- \`--dry-run\` emits the set of migrations but does not apply them.
- The linked connection may create an ephemeral login role and writes local
  CLI cache/telemetry. It is NOT proof of no side effects anywhere.
- \`--skip-vault\` explicitly avoids decrypting/syncing Vault settings.
- Both commands still need approved provider identity and linkage.
- Do not run a newer CLI version without separately updating the pin and
  rechecking the CLI source and exact output contract.

## Source-only implementation
\`scripts/artales-migration-plan-v01-core.mjs\` validates two provider-attested
JSON outputs against exact main SHA, verified ledger source fingerprints and
one intended pending migration. It rejects unknown fields, nonzero return
codes, non-dry-run outputs, unexpected seed/role actions, other projects,
wrong CLI versions, altered command flags and expired evidence.

\`scripts/artales-migration-plan-v01.mjs --print-readonly-commands\` merely
prints the exact commands. It never invokes the Supabase CLI or authenticates.
After separately authorized selection of an ARTales-specific operator,
capture the outputs outside this repository and verify with:

\`\`\`
node scripts/artales-migration-plan-v01.mjs ledger.json request.json cli-observation.json
\`\`\`

On a clean main checkout, with previously approved provider-readback input,
the output is an audit **proposal** with \`mayApply:false\`. Raw provider
transcripts and any credentials must never be committed to GitHub.

## Required execution/approval boundary (NOT performed in this PR)
1. Select an ARTales-only identity, scope, credential handling and an approved
   execution surface. The prior connector APPLY block is not bypassable.
2. Review \`supabase --version\`, command \`--help\` flags, repo main SHA and
   current Supabase GitHub integration state under that identity.
3. Run from a clean checkout with exactly the reviewed pending migration,
   and only then run the approved read-only CLI commands. The commands are
   \`supabase migration list --linked --project-ref <ARTales> --output-format json\`
   and \`supabase db push --linked --project-ref <ARTales> --dry-run --skip-vault --output-format json\`.
4. Read back Supabase ledger independently before/after and compare the
   complete output with the offline admission and JSON proof.
5. This proof DOES NOT authorize APPLY. Next separate human authorization
   must bind execution surface, exact migration SHA and provider identity.
6. Production apply remains disabled/not implemented. No CLI tokens,
   linked credentials, env values, GitHub Actions secrets or DB changes here.

## Recovery
Any unknown output, identity mismatch or provider denial => STOP.
Never repair ledger, use another privileged token or repeat a provider APPLY
after unknown result. All changes to this PR are source-only and revertible.

## Operator selection follow-up (2026-10-28)
The previously proposed linked CLI mode is **not yet approved for a live run**.
A dedicated Postgres least-privilege identity is preferred to avoid linked-mode
temporary privileged logins. That proposed direct-URL CLI mode changes the exact
argv contract and cannot be verified by the current v0.1 linked-output parser.
Do not treat its JSON tests as provider-authenticated proof for a DB-URL session.
See docs/protocols/ARTALES_MIGRATION_PLAN_OPERATOR_SELECTION_V0.md.
No credential, JIT setting or DB role has been created.

Dependencies: PR #280 and #281 merged into main. PR #279 and #278 remain Draft.
