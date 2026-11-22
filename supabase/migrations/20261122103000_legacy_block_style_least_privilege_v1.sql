-- Enforce least privilege even when Supabase has broad default table grants.
-- Public Reader only needs block_type and style; staff write is subject to RLS.
REVOKE ALL ON TABLE public.artales_legacy_block_styles FROM PUBLIC, anon, authenticated;
GRANT SELECT (block_type,style) ON TABLE public.artales_legacy_block_styles TO anon,authenticated;
GRANT INSERT (block_type,style,updated_by,updated_at) ON TABLE public.artales_legacy_block_styles TO authenticated;
GRANT UPDATE (style,updated_by,updated_at) ON TABLE public.artales_legacy_block_styles TO authenticated;
