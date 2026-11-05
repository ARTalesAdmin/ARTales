-- ARTales controlled learning: monthly human methodology review, no automatic AI self-training.
BEGIN;
CREATE TABLE IF NOT EXISTS public.artales_editorial_methodology_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 month_start date NOT NULL UNIQUE,
 due_date date NOT NULL,
 assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 completed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
 conclusion text,
 CHECK((status='completed')=(completed_at IS NOT NULL AND completed_by IS NOT NULL
  AND length(btrim(coalesce(conclusion,''))) BETWEEN 25 AND 4000))
);
ALTER TABLE public.artales_editorial_methodology_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_editorial_methodology_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_editorial_methodology_reviews TO authenticated;
DROP POLICY IF EXISTS artales_methodology_admin_read ON public.artales_editorial_methodology_reviews;
CREATE POLICY artales_methodology_admin_read ON public.artales_editorial_methodology_reviews FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
 AND p.is_active AND p.role::text='admin'));
CREATE OR REPLACE FUNCTION public.artales_schedule_monthly_methodology_review()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $schedule$
DECLARE v_admin uuid;v_start date;v_id uuid;
BEGIN
 IF current_setting('request.jwt.claim.role',true)<>'service_role'
 THEN RAISE EXCEPTION 'service_worker_only' USING errcode='42501';END IF;
 SELECT p.id INTO v_admin FROM public.profiles p WHERE p.display_name='Luboš Žížlavský'
  AND p.is_active AND p.role::text='admin';
 IF v_admin IS NULL THEN RETURN pg_catalog.jsonb_build_object('result','admin_missing');END IF;
 v_start:=date_trunc('month',current_date)::date;
 INSERT INTO public.artales_editorial_methodology_reviews(month_start,due_date,assigned_to)
 VALUES(v_start,(v_start+interval '1 month - 1 day')::date,v_admin)
 ON CONFLICT(month_start) DO NOTHING RETURNING id INTO v_id;
 RETURN pg_catalog.jsonb_build_object('result',CASE WHEN v_id IS NULL THEN 'already_exists' ELSE 'created' END);
END $schedule$;
REVOKE ALL ON FUNCTION public.artales_schedule_monthly_methodology_review() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_schedule_monthly_methodology_review() TO service_role;
CREATE OR REPLACE FUNCTION public.artales_complete_methodology_review(p_id uuid,p_conclusion text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE v_actor uuid:=auth.uid();v_count int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_actor
  AND p.is_active AND p.role::text='admin') THEN
  RAISE EXCEPTION 'admin_required' USING errcode='42501';END IF;
 IF p_conclusion IS NULL OR length(btrim(p_conclusion)) NOT BETWEEN 25 AND 4000 THEN
  RETURN pg_catalog.jsonb_build_object('result','conclusion_required');END IF;
 UPDATE public.artales_editorial_methodology_reviews SET status='completed',
  completed_at=now(),completed_by=v_actor,conclusion=btrim(p_conclusion)
 WHERE id=p_id AND assigned_to=v_actor AND status='open';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN pg_catalog.jsonb_build_object('result',CASE WHEN v_count=1 THEN 'completed' ELSE 'not_open' END);
END $finish$;
REVOKE ALL ON FUNCTION public.artales_complete_methodology_review(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artales_complete_methodology_review(uuid,text) TO authenticated;
COMMIT;
