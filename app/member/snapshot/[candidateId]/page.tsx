import Link from "next/link";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getCandidateSnapshotState} from "@/lib/ingest/server/getCandidateSnapshotState";
import {SnapshotActionPanel} from "@/components/snapshot/SnapshotActionPanel";
import {notFound} from "next/navigation";
import "../../candidates/candidates.css";
export const dynamic="force-dynamic";
export default async function SnapshotCandidate({params,searchParams}:{params:Promise<{candidateId:string}>;searchParams:Promise<{result?:string}>}){
 const {candidateId}=await params;const profile=await requireEditorOrAdmin();
 if(!SNAPSHOT_GENERAL_V1_ENABLED)notFound();
 if(!/^[0-9a-f-]{36}$/i.test(candidateId))notFound();
 const db=await createClient();
 const {data:candidate}=await db.from("work_candidates").select("proposed_title,proposed_author_name")
  .eq("id",candidateId).maybeSingle();
 if(!candidate)notFound();
 const state=await getCandidateSnapshotState(candidateId);
 const query=await searchParams;
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">ARTales / Snapshot</p>
  <h1>{candidate.proposed_title}</h1><p>{candidate.proposed_author_name}</p></div></header>
  <p className="ca-links"><Link href={`/member/legal/${candidateId}`}>← Právní screen</Link></p>
  {query.result==="archived"?<p role="status" className="ca-success">Snapshot byl bezpečně uložen a jeho SHA-256 ověřeno. Následuje kontrola obsahu edice.</p>:null}
  {query.result==="already_archived"?<p role="status" className="ca-success">Tento titul už má uložený Snapshot; žádný nový soubor nevznikl.</p>:null}
  <section className="ca-card"><h2>Archiv původního vydání</h2>
   <SnapshotActionPanel candidateId={candidateId} state={state} canArchive={profile.role==="admin"}/>
  </section>
 </main>;
}
