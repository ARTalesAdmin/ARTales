# ARTales v0.10.9a — General Work Metadata + Language Version Cue + Legal Minimum

## Scope

This patch replaces the earlier targeted launch metadata seed with a general metadata backfill and adds clearer reader-facing language-version information.

## General metadata migration

Run:

`lib/supabase/migrations/2026-06-27_launch_work_metadata_legal_v0109.sql`

The migration:

- fills `title_en` from `title` for every work when missing,
- fills `subtitle_en` from `subtitle` when missing,
- fills `summary_en` from `summary` when missing,
- leaves `title_cs`, `subtitle_cs`, `summary_cs` untouched,
- does not hard-code individual slugs,
- is safe to run repeatedly.

Public fallback remains:

- CS: `*_cs -> *_en -> legacy`
- EN: `*_en -> *_cs -> legacy`

## Reader-facing language information

Work detail pages now distinguish:

- language of this edition,
- original language of the work when available,
- whether this edition is the original-language version.

This is a lightweight presentation layer. A later data model can group several language editions under a canonical work identity.

## Legal pages

Routes:

- `/legal`
- `/legal/editions`
- `/legal/terms`
- `/legal/privacy`
- `/legal/contact`

The editions page now includes a short explanation of language versions.

## Notes

This legal text is a launch minimum. It should be reviewed before paid products, subscriptions, user publishing, or broader data processing.
