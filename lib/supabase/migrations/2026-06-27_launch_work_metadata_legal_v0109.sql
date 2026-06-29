-- ARTales v0.10.9a — General bilingual work metadata backfill
--
-- Purpose:
-- - Normalize existing works into the new public metadata model.
-- - Treat current legacy work fields as the English/public fallback layer.
-- - Leave Czech metadata empty unless it has already been filled manually.
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
