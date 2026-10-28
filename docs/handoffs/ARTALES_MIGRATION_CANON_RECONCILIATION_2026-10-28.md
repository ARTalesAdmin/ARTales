# ARTales migration identity reconciliation — Phoenix (2026-10-28)

**Scope:** one source-only PR against the exact ARTales Production `main` baseline
`98022c11a440719527eb964c981fbe3fde86de02`. No Arc auto-created.

**Why:** `supabase db push` cannot safely plan an exact set while three
historical migrations have repository filename versions different from the
live Supabase migration ledger. This block was found during the authorized
Identity Authority PR #279 roll-out and the blocked official APPLY.

**Independent evidence:** Five remote ledger identities read at
2026-10-28; 20261024073928 Candidates and 20261025095658 Legal SQL match
the repository file exactly. 20261027081945 Snapshot #389 has identical
CREATE POLICY statements, but source-only comments + BEGIN/COMMIT differ;
the mirror is replaced with precisely the ledger-registered SQL.
Prescreen source and ledger contents are byte-equal. Baseline 557 statements
stored in ledger; export mirror has different formatting and is not
asserted byte-equal.

**Change scope:** rename three existing `supabase/migrations` files to
actual Production ledger versions, mirror exact historical #389 SQL, add
offline fingerprint check and ARTales-specific production-migration runbook.
No DB/Env/config mutation, no ledger history update, no duplicate apply.

**GitHub Production coupling evidence (resolved at observed time):**
On 2026-10-28 12:38 local, Architect-supplied screenshot of ARTales
Production Supabase **Settings > Integrations > GitHub** showed
**"Choose GitHub repository"** with no selected repository. Therefore
no Supabase GitHub integration was configured for automatic Production
migration deployment. The separate Data API integration is unrelated.
Independent read-only GitHub scan: all six main-repo Actions workflows
lack database apply/push. This is a human-observed UI + repo-scan
assertion, **not** a provider integrations API readback or a claim that
the explicit `Deploy to production` switch was inspected. Reconfirm
at every future merge if configuration changes.

**Open blockers:**
1. Confirm no new Supabase GitHub repository connection / automatic
   Production deployment immediately before an authorized merge.
2. Establish/select an ARTales-scoped operator or executor via a separate
   authorization. The previous `mcp__Supabase__apply_migration` call was
   blocked by platform safety and cannot be bypassed using manual SQL.
3. After source reconcile, verify the exact future pending set with
   `migration list` and `db push --dry-run` before accepting PR #279.
4. Keep PR #279 (Identity Authority) and PR #278 (Snapshot general)
   unmerged/unapplied until their own release gates.
5. Verify real Production readback/role/sign-in only after independently
   authorized governed Production execution.

**Risk:** repository migration inventory high operational sensitivity,
but this PR is source-only and performs no provider DB mutations.
**Env:** no. **Rollback:** revert this source-only PR before any future
approved Production migration that depends on it.
**Status:** proposed; source CI PASS on
`83f498dedfdd5030634885748950ea899ec311a7` before UI evidence update;
new exact-head CI, merge authority, and Production migration execution
remain pending. No Production change performed.
