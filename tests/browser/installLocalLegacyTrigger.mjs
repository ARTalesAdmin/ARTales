import {readFileSync,writeFileSync,existsSync,renameSync} from "node:fs";
import {resolve} from "node:path";
if(process.env.GOLDEN_E2E_ISOLATED!=="yes")throw Error("Refusing to install golden migration bridge outside isolated CI");
const project=readFileSync(resolve("supabase/config.toml"),"utf8");
if(!project.includes('project_id = "artales-golden-browser"'))
 throw Error("Refusing non-golden Supabase project");
const baseline=readFileSync(resolve("supabase/migrations/20260926142755_remote_schema.sql"),"utf8");
if(!baseline.includes('artales_sync_profile_from_auth_user_v081')||
   !baseline.includes("meta ->> 'role'")||
   !baseline.includes('CREATE POLICY "Users can update own profile"')||
   !baseline.includes('CREATE POLICY "Invite managers and invitees can update invites"')||
   baseline.includes("CREATE TRIGGER zz_artales_profile_sync_v081"))
 throw Error("Baseline shape changed; review historical trigger bridge before continuing");
const file=resolve("supabase/migrations/20260926142756_golden_local_auth_trigger.sql");
if(existsSync(file))throw Error("Golden overlay already present, refusing overwrite");
writeFileSync(file,
"-- GOLDEN CI ONLY: restore the historical auth.users trigger omitted by schema-only baseline.\n"+
"-- No policy/security preflight bypass. Dropped with ephemeral CI database; never commit this SQL migration.\n"+
"CREATE TRIGGER zz_artales_profile_sync_v081 AFTER INSERT ON auth.users\n"+
"FOR EACH ROW EXECUTE FUNCTION public.artales_sync_profile_from_auth_user_v081();\n",
{flag:"wx"});
console.log("GOLDEN_LOCAL_HISTORY: generated exact legacy auth.users trigger on disposable DB");

const oneTime=resolve("supabase/migrations/20261028111000_artales_snapshot389_register.sql");
const oneTimeOutside=resolve("tests/browser/.golden-only-snapshot389-backfill.sql");
const oneTimeText=readFileSync(oneTime,"utf8");
if(!oneTimeText.includes("One-time evidence-backed readback registration for #389")||
 !oneTimeText.includes("historical_snapshot_storage_evidence_mismatch")||
 !oneTimeText.includes("INSERT INTO public.candidate_snapshots")||
 /\b(?:CREATE|ALTER|GRANT|REVOKE|DROP)\s+(?:TABLE|FUNCTION|POLICY|TRIGGER|VIEW)\b/i.test(oneTimeText)||
 existsSync(oneTimeOutside))
 throw Error("Unexpected #389 one-time migration; do not suppress new schema or security logic");
renameSync(oneTime,oneTimeOutside);
console.log("GOLDEN_LOCAL_HISTORY: excluded production-only #389 existing-data backfill from EMPTY local database (schema migrations remain active)");

const operationalSources=[
 ["20261103010000","20261103_artales_qa_batch_edition_rules_escalations.sql"],
 ["20261103020000","20261103_artales_semantic_qa_block_workflow.sql"],
 ["20261103030000","20261103_artales_editorial_assignments_v2.sql"],
 ["20261104010000","20261104_artales_ai_qa_durable_jobs.sql"],
 ["20261104020000","20261104_artales_qa_change_decisions_v4.sql"],
 ["20261104030000","20261104_artales_qa_closeout_v4.sql"],
 ["20261104040000","20261104_artales_safe_layout_commit_v4.sql"],
 ["20261105010000","20261105_artales_candidate_editorial_metadata_gate.sql"],
 ["20261105020000","20261105_artales_author_collection_bilingual_evidence.sql"],
 ["20261105030000","20261105_artales_candidate_bilingual_descriptions.sql"],
 ["20261106010000","20261106_artales_ai_gateway_usage.sql"],
 ["20261106020000","20261106_artales_editorial_completion_bilingual_guard.sql"],
];
for(const [stamp,name] of operationalSources){
 const original=readFileSync(resolve("ops/sql/"+name),"utf8");
 if(!original.includes("BEGIN;")||!original.trimEnd().endsWith("COMMIT;"))
  throw Error("Unrecognized historical manual SQL envelope: "+name);
 let source=original;
 if(name==="20261103_artales_editorial_assignments_v2.sql"){
  const marker="-- Targeted conversion of existing #389 tasks, retaining task IDs and audit.";
  if(!original.includes(marker)||!original.includes("389_semantic_revision_missing"))
   throw Error("Refusing to alter historically unrecognized editorial #389 backfill");
  source=original.slice(0,original.indexOf(marker)).trimEnd()+"\nCOMMIT;\n";
 }
 const transient=resolve("supabase/migrations/"+stamp+"_golden_"+name);
 if(existsSync(transient))throw Error("Refusing existing migration overlay "+stamp);
 writeFileSync(transient,source,{flag:"wx"});
 console.log("GOLDEN_LOCAL_HISTORY: replay canonical ops/sql/"+name+
  (source===original?"":" (only one-time #389 human assignment backfill omitted)"));
}

const cap=resolve("supabase/migrations/20261108100000_golden_observed_editorial_capabilities.sql");
if(existsSync(cap))throw Error("Refusing to replace observed capabilities schema");
writeFileSync(cap,`
-- GOLDEN ISOLATED ONLY: schema reconstructed by read-only inspection of live
-- public.artales_editorial_capabilities because its DDL is missing from canonical migrations.
-- Not a production migration; missing canonical DDL remains a tracked migration debt.
CREATE TABLE public.artales_editorial_capabilities(
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN
 ('text_review','work_description','author_bio','cover_art','author_visual',
  'collection_curation','second_review','visual_review','proofread')),
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,kind)
);
ALTER TABLE public.artales_editorial_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.artales_editorial_capabilities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.artales_editorial_capabilities TO authenticated;
CREATE POLICY artales_capability_owner_or_admin_read ON public.artales_editorial_capabilities
 FOR SELECT TO authenticated USING(profile_id=(SELECT auth.uid()) OR
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
  AND p.is_active AND p.role::text='admin'));
`,{flag:"wx"});
console.log("GOLDEN_LOCAL_HISTORY: added explicitly labeled live-schema reconstruction of missing capabilities table, without grants beyond SELECT");
