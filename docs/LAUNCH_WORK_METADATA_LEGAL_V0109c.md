# ARTales v0.10.9c — General Metadata + Language Metadata + Legal Minimum

## What this patch fixes

This patch is cumulative for the launch legal/metadata step. It should be used instead of applying partial `v0.10.9a`/`v0.10.9b` files alone.

It fixes:

- legal pages and `PublicHeader active="legal"` type coverage,
- general bilingual metadata backfill,
- work language display so UI locale is not mistaken for work language,
- gallery card vertical spacing after the previous standardization pass.

## SQL

Run:

`lib/supabase/migrations/2026-06-27_launch_work_metadata_legal_v0109.sql`

The migration:

- fills `title_en` from `title` for every work when missing,
- fills `subtitle_en` from `subtitle` when missing,
- fills `summary_en` from `summary` when missing,
- leaves `title_cs`, `subtitle_cs`, `summary_cs` untouched,
- fills `edition_language` from `canonical_language` when missing,
- for current Gutenberg public-domain imports, fills `original_language` from `edition_language` when missing,
- normalizes accidental Czech defaults on current Gutenberg public-domain imports to English.

## Public fallback

- CS UI: `*_cs -> *_en -> legacy`
- EN UI: `*_en -> *_cs -> legacy`

The UI locale does not determine the work language.

## Language model

Current lightweight model:

- one row in `works` = one edition / text version,
- `edition_language` = language of this concrete edition,
- `original_language` = original language of the literary work if known,
- original-language edition is highlighted only when `edition_language === original_language`.

Future stronger model:

- add a canonical `literary_works` entity,
- group multiple `work_editions` under it,
- mark one or more source/original editions explicitly,
- link translations and adaptations to the canonical work.

## Legal pages

Routes:

- `/legal`
- `/legal/editions`
- `/legal/terms`
- `/legal/privacy`
- `/legal/contact`

The legal text is a launch minimum and should be reviewed before paid products, subscriptions, user publishing, or broader data processing.


## v0.10.9d follow-up

Fixes after launch testing:

- work detail no longer shows Czech as edition language just because the UI is Czech,
- gallery language labels use the same temporary data-normalization heuristic,
- SQL includes a broader correction for current public-domain rows accidentally marked as Czech,
- Czech public dictionary no longer uses the English phrase `ARTales checkout`,
- placeholder product titles such as `Coming soon` are replaced by localized product type labels on work detail cards.

The long-term model remains: every work/edition should have explicit `edition_language` and, when known, `original_language`.
