import Link from "next/link";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getCandidateSnapshotState} from "@/lib/ingest/server/getCandidateSnapshotState";
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
   <p><strong>{state.actionLabel}</strong></p>
   {state.status==="archived_verification_pending"?<p>Originál je uložen; čeká kontrola shody edice a převzetí do nového semantického Editoru.</p>:null}
   {state.status==="archiving"?<p>Předchozí pokus již převzal archivaci. Neopakujte ji; při problému proveďte kontrolu.</p>:null}
   {state.status==="ready"&&profile.role==="admin"?<>
    <p>Akce jednorázově získá EPUB schválené Gutenberg edice, uloží původní bajty do soukromého archivu a ověří SHA-256. Ilustrace mohou být uchovány pouze soukromě, nikdy automaticky publikovány.</p>
    <form action={`/api/member/snapshot/${candidateId}`} method="post" className="ca-form">
      <input type="hidden" name="candidate_id" value={candidateId}/>
      <label><input type="checkbox" name="private_original_retention" value="archive_only" required/>
      Potvrzuji výhradně soukromou archivaci původního souboru včetně případných obrázků, nikoli jejich zveřejnění.</label>
      <button type="submit" className="ca-btn ca-primary">Vytvořit Snapshot</button>
    </form>
   </>:null}
   {state.status==="ready"&&profile.role!=="admin"?<p>Snapshot může spustit administrátor. Editor může sledovat stav.</p>:null}
   {state.status==="failed"||state.status==="acquisition_required"?<p>Vyžaduje kontrolu člověkem. Automatické opakování není povoleno.</p>:null}
  </section>
 </main>;
}
