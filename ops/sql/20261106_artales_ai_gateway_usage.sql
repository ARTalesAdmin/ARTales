-- ARTales P0 AI Gateway ledger. DRAFT: requires isolated DB verification before apply.
-- One row per gateway generation, not per job: retries may consume extra tokens.
-- No text or prompts are stored, and a missing cost is NULL (never zero).
BEGIN;
CREATE TABLE IF NOT EXISTS public.artales_semantic_ai_usage(
 generation_id text PRIMARY KEY CHECK(length(generation_id) BETWEEN 4 AND 160),
 job_id uuid NOT NULL REFERENCES public.artales_semantic_ai_qa_jobs(id) ON DELETE RESTRICT,
 candidate_id uuid NOT NULL REFERENCES public.work_candidates(id) ON DELETE RESTRICT,
 requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 model text NOT NULL CHECK(length(model) BETWEEN 3 AND 160),
 input_tokens bigint CHECK(input_tokens >= 0),
 output_tokens bigint CHECK(output_tokens >= 0),
 total_tokens bigint CHECK(total_tokens >= 0),
 cost_usd numeric(18,9) CHECK(cost_usd >= 0),
 cost_status text NOT NULL DEFAULT 'pending_reconciliation'
  CHECK(cost_status IN ('reported','pending_reconciliation','reconciled')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK((cost_status='reconciled' AND cost_usd IS NOT NULL)
    OR (cost_status<>'reconciled' AND cost_usd IS NULL))
);
CREATE INDEX IF NOT EXISTS artales_ai_usage_time_idx
 ON public.artales_semantic_ai_usage(recorded_at DESC);
CREATE INDEX IF NOT EXISTS artales_ai_usage_member_idx
 ON public.artales_semantic_ai_usage(requested_by,recorded_at DESC);
ALTER TABLE public.artales_semantic_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_semantic_ai_usage FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_semantic_ai_usage TO authenticated;
CREATE POLICY artales_ai_usage_read_admin ON public.artales_semantic_ai_usage
 FOR SELECT TO authenticated USING(
 EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active AND p.role::text='admin')
);
-- Service worker inserts only through the private server-side service client.
-- No write permission is granted to anon or authenticated.
COMMIT;
