import Link from "next/link";
import {SNAPSHOT_GENERAL_V1_ENABLED} from "@/lib/ingest/snapshotGeneralFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
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
  <section className="ca-card"><h2>Archiv původního vydání</h2>
   <SnapshotActionPanel candidateId={candidateId} state={state} canArchive={profile.role==="admin"}/>
  </section>
  {receipt?<section className="ca-card"><h2>Technické důkazy archivního EPUBu</h2>
   <p>Ověření skutečných bajtů originálu, SHA-256, pořadí dokumentů a seznamu obrazových součástí. Výsledek sám o sobě nepotvrzuje právní stav ani obsahovou shodu edice.</p>
   <p><a href={"/api/member/snapshot/"+candidateId+"/technical-evidence"} target="_blank" rel="noopener noreferrer">Ověřit originál a zobrazit technický protokol (JSON)</a></p>
  </section>:null}
  {receipt?<section className="ca-card"><h2>Kontrola literární shody vydání</h2>
    <p>Originál SHA-256: <code>{receipt.sha256}</code>. Soukromě archivované ilustrace: {receipt.embedded_images}.</p>
    <p><a href={receipt.catalog_url} target="_blank" rel="noopener noreferrer">Záznam vydání v katalogu Gutenberg</a></p>
    {profile.role==="admin"?<form className="ca-form" action={`/api/member/snapshot/${candidateId}/review`} method="post">
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
    </form>:null}
    {query.result==="reviewed"?<p role="status" className="ca-success">Záznam kontroly uložen. Aktuální stav se řídí posledním rozhodnutím.</p>:null}
    {state.status==="verified_for_composition"?<p className="ca-success">Poslední kontrola potvrdila shodu textu pro kompozici bez publikace původních ilustrací.</p>:null}
    {state.status!=="verified_for_composition"?<p>Kompozice ještě není povolená. Je třeba potvrdit shodu textu a vyloučení neprověřených ilustrací.</p>:null}
  </section>:null}
  {receipt&&profile.role==="admin"?<section className="ca-card">
   <h2>Automaticky ověřit vydání a sestavit sémantické bloky</h2>
   <p>Systém porovná archiv s nezávisle načteným Gutenberg souborem,
   zkontroluje právní lock, rok úmrtí, překlad, textová omezení a všechny
   soukromě archivované obrázky. Při jakékoliv nejasnosti se zastaví.
   Vytvoří pouze interní sémantickou revizi, nikoliv veřejnou publikaci.</p>
   <AutomaticSnapshotCompose candidateId={candidateId}/>
  </section>:null}
  {state.status==="verified_for_composition"&&profile.role==="admin"?<section className="ca-card">
   <h2>Sémantická kompozice</h2>
   <p>Vytvoření sémantických bloků z ověřeného archivu; obrázky zůstanou soukromé.</p>
   <form method="post" action={"/api/member/semantic/"+candidateId+"/compose"}>
    <button type="submit" className="ca-btn ca-primary">Převést EPUB na bloky</button>
   </form>
   <Link href={"/member/semantic/"+candidateId}>Otevřít redakční QA</Link>
  </section>:null}
 </main>;
}
