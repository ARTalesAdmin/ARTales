-- ARTales v0.10.11a
-- Normalize language metadata for current English public-domain imports.
--
-- Context:
-- Earlier imports sometimes used the Czech UI locale as edition/original language.
-- The public UI must not infer that an English edition is Czech just because the
-- interface is Czech. This migration only touches public-domain rows that already
-- declare canonical_language = 'en'.

update public.works
set
  edition_language = 'en',
  original_language = case
    when original_language is null
      or trim(coalesce(original_language, '')) = ''
      or lower(original_language) = 'cs'
      then 'en'
    else original_language
  end,
  updated_at = now()
where origin_type = 'public_domain'
  and lower(coalesce(canonical_language, '')) = 'en'
  and (
    edition_language is null
    or trim(coalesce(edition_language, '')) = ''
    or lower(edition_language) = 'cs'
    or original_language is null
    or trim(coalesce(original_language, '')) = ''
    or lower(original_language) = 'cs'
  );
