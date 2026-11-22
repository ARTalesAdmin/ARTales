-- PostgREST merge/upsert requires table-wide SELECT on conflict rows.
-- Anonymous readers still retain only column-level SELECT (block_type,style).
-- Modification remains restricted to active editor/admin through RLS.
GRANT SELECT ON TABLE public.artales_legacy_block_styles TO authenticated;
