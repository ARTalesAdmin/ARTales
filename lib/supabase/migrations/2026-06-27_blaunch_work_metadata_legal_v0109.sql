-- ARTales v0.10.9c — General bilingual work metadata + language metadata backfill
--
-- Purpose:
-- - Normalize existing works into the new public metadata model.
-- - Treat current legacy work fields as the English/public fallback layer.
-- - Leave Czech metadata empty unless it has already been filled manually.
-- - Never infer a work's language from the current UI locale.
--
-- This migration is intentionally general:
-- - no hard-coded work slugs,
-- - no partial launch-only Czech translations,
-- - safe to run repeatedly.
--
-- Public fallback behavior in the app:
-- CS: *_cs -> *_en -> legacy field
-- EN: *_en -> *_cs -> legacy field

update works
set
  title_en = coalesce(nullif(trim(title_en), ''), nullif(trim(title), '')),
  subtitle_en = coalesce(nullif(trim(subtitle_en), ''), nullif(trim(subtitle), '')),
  summary_en = coalesce(nullif(trim(summary_en), ''), nullif(trim(summary), ''))
where
  title_en is null
  or trim(coalesce(title_en, '')) = ''
  or (
    subtitle is not null
    and trim(coalesce(subtitle, '')) <> ''
    and (
      subtitle_en is null
      or trim(coalesce(subtitle_en, '')) = ''
    )
  )
  or (
    summary is not null
    and trim(coalesce(summary, '')) <> ''
    and (
      summary_en is null
      or trim(coalesce(summary_en, '')) = ''
    )
  );

-- Keep Czech localization opt-in.
-- Do not auto-copy English/legacy fields into *_cs; Czech pages already fall back
-- to *_en and then legacy fields until a real Czech title/summary is ready.

-- Language metadata normalization:
-- edition_language describes the language of this concrete edition/text.
-- original_language describes the original language of the literary work.
-- Neither value should be derived from the reader's UI locale.
update works
set edition_language = coalesce(nullif(trim(edition_language), ''), nullif(trim(canonical_language), ''))
where edition_language is null or trim(coalesce(edition_language, '')) = '';

-- For imported public-domain texts where we only have one source-language edition,
-- use the edition language as original_language only when the source metadata is absent.
-- This is intentionally source-based, not locale-based.
update works
set original_language = edition_language
where
  source_label = 'gutenberg'
  and origin_type = 'public_domain'
  and edition_language is not null
  and trim(edition_language) <> ''
  and (
    original_language is null
    or trim(coalesce(original_language, '')) = ''
  );

-- If a previous default accidentally marked imported Gutenberg/public-domain works
-- as Czech while their source metadata is otherwise unset, normalize them to English.
-- This matches the current launch catalogue of English public-domain imports.
-- Future non-English imports should set canonical_language/edition_language explicitly
-- in the editor and will not need this fallback.
update works
set
  canonical_language = 'en',
  edition_language = 'en',
  original_language = coalesce(nullif(trim(original_language), ''), 'en')
where
  source_label = 'gutenberg'
  and origin_type = 'public_domain'
  and lower(coalesce(canonical_language, '')) = 'cs'
  and (
    edition_language is null
    or trim(coalesce(edition_language, '')) = ''
    or lower(edition_language) = 'cs'
  );
