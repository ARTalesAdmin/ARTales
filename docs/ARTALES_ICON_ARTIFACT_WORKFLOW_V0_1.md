# ARTales icon artifact workflow v0.1

## Purpose

The manual `ARTales icon artifact generator` GitHub Action makes a consistent
review package from the locked ARTales micro-symbol master. Its presence on the
default branch exposes the **Run workflow** control without promoting the
broader `develop` branch.

## Scope and safety boundary

- The workflow runs only through `workflow_dispatch`.
- Repository contents are read-only during the job.
- The generator reads the locked SVG master and creates temporary PNG, ICO, and
  checksum-manifest files in its tooling output directory.
- GitHub Actions uploads that directory as a downloadable artifact retained for
  14 days.
- No generated file is committed, deployed, copied into `public/`, or connected
  to application/runtime code.
- Generated artifacts are review-only. They are not production icon approval.

## Operation

1. Open **Actions** in GitHub.
2. Select **ARTales icon artifact generator**.
3. Choose **Run workflow** on the default branch.
4. After the job succeeds, download `artales-icon-artifacts` from the run page.
5. Inspect the images and verify `manifest.json` before any separately approved
   production integration.

Local reproduction is documented in
`tools/brand/generate-icon-artifacts/README.md`.

## Rollback

Revert the commit or pull request that adds the workflow and generator. Existing
downloaded workflow artifacts can be deleted or allowed to expire; no runtime,
database, environment, or public asset rollback is necessary.

## PR #64 production promotion conflict resolution

Production approval was granted on 2026-08-05 for promoting the approved develop brand identity package to main. Conflict resolution keeps the complete develop brand/icon package as the source of truth where it supersedes earlier partial main icon tooling, while preserving production code outside the brand/icon promotion scope.

Runtime impact is limited to the already-approved favicon/app icon metadata and web manifest wiring. This promotion does not introduce database changes, environment changes, Supabase changes, runtime tokenization, CSS palette refactor, admin dashboard work, or new binary preview PNGs.
