-- Safe atomic upserts update the conflict key as well as the style payload.
-- RLS remains authoritative; unrecognized block types cannot be persisted.
GRANT UPDATE (block_type) ON public.artales_legacy_block_styles TO authenticated;
ALTER TABLE public.artales_legacy_block_styles
  ADD CONSTRAINT artales_legacy_block_type_known
  CHECK (block_type IN ('book_part','chapter','paragraph','headline','quote','poem','letter','newspaper_article','place_line','separator','note','footnote','dedication','preface','afterword','acknowledgement','image','table'));
