import { requireAdmin } from "@/lib/guards";
import { isCandidatesFixturePreview } from "@/lib/fixtures/workCandidates";
import { getServerSupabaseConnection } from "@/lib/supabase/connectionIsolation";

export function isPrescreenFixture(): boolean {
  const target=getServerSupabaseConnection();
  return isCandidatesFixturePreview() && !target.enabled &&
    target.reason==="preview_unconfigured";
}
export async function requirePrescreenAccess(){
  if(isPrescreenFixture())return {fixture:true as const,userId:null};
  const target=getServerSupabaseConnection();
  if(!target.enabled)throw new Error("prescreen_preview_database_unavailable");
  const profile=await requireAdmin();
  return {fixture:false as const,userId:profile.id};
}
