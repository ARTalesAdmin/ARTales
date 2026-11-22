-- One canonical catalog of editor-controlled legacy Reader block styles.
-- Registry identities remain defined by lib/blocks.ts; no local work overrides.
CREATE TABLE IF NOT EXISTS public.artales_legacy_block_styles (
 block_type text PRIMARY KEY,
 style jsonb NOT NULL CHECK(jsonb_typeof(style)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES public.profiles(id),
 CONSTRAINT artales_legacy_block_styles_type_shape CHECK(length(block_type) BETWEEN 2 AND 60)
);
ALTER TABLE public.artales_legacy_block_styles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.artales_legacy_block_styles TO anon,authenticated;
GRANT INSERT,UPDATE ON public.artales_legacy_block_styles TO authenticated;
CREATE POLICY artales_legacy_block_styles_public_read ON public.artales_legacy_block_styles
 FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY artales_legacy_block_styles_staff_insert ON public.artales_legacy_block_styles
 FOR INSERT TO authenticated WITH CHECK (
  updated_by=(select auth.uid()) AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid())
    AND p.is_active AND p.role IN ('admin'::public.app_role,'editor'::public.app_role)
  )
 );
CREATE POLICY artales_legacy_block_styles_staff_update ON public.artales_legacy_block_styles
 FOR UPDATE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid())
   AND p.is_active AND p.role IN ('admin'::public.app_role,'editor'::public.app_role))
 ) WITH CHECK(
  updated_by=(select auth.uid()) AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid())
    AND p.is_active AND p.role IN ('admin'::public.app_role,'editor'::public.app_role)
  )
 );
