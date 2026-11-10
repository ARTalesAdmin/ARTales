import Link from "next/link";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {canProgressCandidate} from "@/lib/editorial/candidateAuthority";
import {createClient} from "@/lib/supabase/server";
import {getCandidateSnapshotState} from "@/lib/ingest/server/getCandidateSnapshotState";
import {SnapshotActionPanel} from "@/components/snapshot/SnapshotActionPanel";
import {AutomaticSnapshotCompose} from "@/components/snapshot/AutomaticSnapshotCompose";
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
 const canProgress=await canProgressCandidate(candidateId,profile);
 const state=await getCandidateSnapshotState(candidateId);
 const {data:receipt}=await db.from("candidate_snapshots").select("sha256,embedded_images,catalog_url")
  .eq("candidate_id",candidateId).maybeSingle();
 const query=await searchParams;
 return <main className="ca-root">
  <header className="ca-head"><div><p className="ca-eyebrow">ARTales / Snapshot</p>
  <h1>{candidate.proposed_title}</h1><p>{candidate.proposed_author_name}</p></div></header>
  <p className="ca-links"><Link href={`/member/legal/${candidateId}`}>← Právní screen</Link></p>
  {query.result==="archived"?<p role="status" className="ca-success">Snapshot byl bezpečně uložen a jeho SHA-256 ověřeno. Následuje kontrola obsahu edice.</p>:null}
  {query.result==="already_archived"?<p role="status" className="ca-success">Tento titul už má uložený Snapshot; žádný nový soubor nevznikl.</p>:null}
  <section className="ca-card"><h2>Příprava textového vydání</h2>
   <SnapshotActionPanel candidateId={candidateId} state={state} canArchive={canProgress}/>
  </section>
  {receipt&&profile.role==="admin"?<details className="ca-card"><summary>Technické důkazy (administrátor)</summary>
   <p>SHA-256 původního archivu, integrita souboru a evidence obrazových součástí.</p>
   <a href={"/api/member/snapshot/"+candidateId+"/technical-evidence"} target="_blank" rel="noopener noreferrer">Zobrazit technický protokol (JSON)</a>
  </details>:null}
  {receipt&&canProgress?<section className="ca-card">
   <h2>Další krok: redakční příprava</h2>
   <p>Systém naváže na poslední ověřený krok. Pokud již bloky existují, otevře
   redakční kartu. Jinak ověří archiv a právní zdroj a vytvoří bloky a úkoly.
   Při problému ukáže konkrétní důvod; nic automaticky nezveřejní.</p>
   <AutomaticSnapshotCompose candidateId={candidateId} autoStart={query.result==="archived"}/>
  </section>:null}
  {receipt&&canProgress&&profile.role==="admin"?<details className="ca-card"><summary>Záložní ruční kontrola vydání (administrátor)</summary><h2>Ruční kontrola literární shody</h2>
    <p>Ruční posouzení slouží pouze pro výjimečné případy, nemění uzamčený právní audit ani automatické kontroly.</p>
    <p>Originál SHA-256: <code>{receipt.sha256}</code>. Soukromě archivované ilustrace: {receipt.embedded_images}.</p>
    <p><a href={receipt.catalog_url} target="_blank" rel="noopener noreferrer">Záznam vydání v katalogu Gutenberg</a></p>
    <form className="ca-form" action={`/api/member/snapshot/${candidateId}/review`} method="post">
      <input type="hidden" name="candidate_id" value={candidateId}/>
      <input type="hidden" name="snapshot_sha256" value={receipt.sha256}/>
      <label>Kontrola textu<select name="text_correspondence" defaultValue="needs_review">
        <option value="needs_review">Ještě ověřit</option><option value="confirmed">Ověřená shoda — pro kompozici</option>
        <option value="rejected">Zamítnuto</option></select></label>
      <label>Ilustrace<select name="image_disposition" defaultValue="exclude_all">
        <option value="exclude_all">Vyřadit z veřejného vydání</option>
        <option value="requires_separate_review">Samostatné prověření práv</option></select></label>
      <label>Důkazy shody konkrétní edice (min. 80 znaků)<textarea name="evidence_note" rows={5}
        minLength={80} maxLength={4000} required/></label>
      <button type="submit" className="ca-btn ca-primary">Uložit kontrolu vydání</button>
    </form>
    {query.result==="reviewed"?<p role="status" className="ca-success">Záznam kontroly uložen. Aktuální stav se řídí posledním rozhodnutím.</p>:null}
    {state.status==="verified_for_composition"?<p className="ca-success">Poslední kontrola potvrdila shodu textu pro kompozici bez publikace původních ilustrací.</p>:null}
    {state.status!=="verified_for_composition"?<p>Automatické ověření ještě nebylo dokončeno. Ruční potvrzení je záloha a nenahrazuje nezávislé ověření právních důkazů.</p>:null}
  </details>:null}
 </main>;
}
