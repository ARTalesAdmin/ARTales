-- Approved edition typography is public only for already published work.
-- Non-published editorial rules remain visible only to assigned staff RLS.
GRANT SELECT (candidate_id,term) ON public.artales_work_typography_rules TO anon;
CREATE POLICY artales_published_work_typography_read
 ON public.artales_work_typography_rules FOR SELECT TO anon,authenticated
 USING (EXISTS (
   SELECT 1 FROM public.artales_semantic_publications rel
   JOIN public.works w ON w.id=rel.work_id
   WHERE rel.candidate_id=artales_work_typography_rules.candidate_id
     AND w.status='published'::public.work_status
 ));
