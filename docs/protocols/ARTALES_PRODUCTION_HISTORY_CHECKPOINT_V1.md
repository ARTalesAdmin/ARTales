# ARTales: historical migration checkpoint (source-only proposal, 2026-11-26)

The existing migration runner remains the one production route. This checkpoint is read-only evidence, NOT authorization, SQL to apply, a schema backup, a ledger repair or proof of a replayable clean database.

## Verified reconciliation

The provider has 31 historical version/name identities through 20261122085733. All 31 have a full ordered statement-array SHA-256 and count read from the production ledger. The September baseline is a dump, not byte-equivalent to the 557 stored statements. 28 single-statement rows match existing repository SQL byte-for-byte (4 already reconciled in October, 24 further matches located in this review). The 2 remaining rows have provider history evidence only: no exact publicly committed source recovered. No provider-only SQL or personal data are exported. The 4 unmatched files in the historical Git migration directory are unregistered proposals/manual-history sources, NOT proven unapplied migrations or permission to replay. All 25 legacy canonical files are identified by immutable Git blob identity in the checkpoint.

## Forward contract (proposed, not yet active)

- Freeze legacy files as historical evidence. No direct db push of the raw historical directory. No retroactive new files, no history rewrite/repair/replay. Future migrations must use canonical supabase/migrations filenames after the checkpoint cutoff.
- Existing one-migration staging helper must require the exact complete provider checkpoint prefix and immutable historical source bytes before admitting any new SQL. A transient CLI stage can represent already-applied historical identities with explicitly non-executable history guards (must raise on attempted replay); these are not canonical migration files or replayable schema. The stage must contain exactly the first pending reviewed migration, never historical unregistered SQL.
- For later CLI-applied SQL, verify the entire ordered provider statement array against the exact reviewed source rather than md5(statements[1]). Native CLI 2.122.0 was observed splitting a multi-statement SQL file in disposable PG17 (run 45861452990). Compare the full ledger before PLAN and immediately before APPLY. Preserve the exact source SHA-256, approved plan identity, protected human approval, and independent provider verification.
- Keep migration PLAN/APPLY roles distinct. Do not repurpose the old identity-only owner environment or credentials for general use. A future operator environment and actual identity need separate setup/authorization. No provider write, no credential or environment changes here.

A separate, disposable schema-only baseline with synthetic roles/data is required for full clean integration tests; the historical checkpoint is not that baseline.
