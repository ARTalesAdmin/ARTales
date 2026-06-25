# ARTales v0.10.8i — Work public metadata i18n

## Scope

Adds bilingual public metadata for works:

- `title_cs`, `title_en`
- `subtitle_cs`, `subtitle_en`
- `summary_cs`, `summary_en`

The existing legacy fields remain:

- `title`
- `subtitle`
- `summary`

They continue to work as canonical/admin fallback fields.

## Migration logic

Existing public works currently mostly have English metadata in the legacy fields. The migration copies existing legacy values into the English layer:

- `title` → `title_en`
- `subtitle` → `subtitle_en`
- `summary` → `summary_en`

Czech fields stay empty until editorially filled.

## Public fallback behavior

Public surfaces use locale-aware selection:

- CZ: `*_cs` → `*_en` → legacy field
- EN: `*_en` → `*_cs` → legacy field

This means launch remains stable even before Czech annotations are filled.

## Public surfaces updated

- gallery work cards
- author detail work cards
- collection detail work cards
- work detail page
- language labels on work detail
- collection type label in collections grid

## Editor updated

Work editor now has a public localization section for CZ/EN title, subtitle and annotation.

## SQL

Run:

`lib/supabase/migrations/2026-06-25_work_public_metadata_i18n_v0108i.sql`
