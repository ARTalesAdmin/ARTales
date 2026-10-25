import Link from "next/link";
import {LegalSourceDiscovery} from "@/components/legal/LegalSourceDiscovery";
import {GutenbergSourcePicker} from "@/components/legal/GutenbergSourcePicker";
import {AutomaticLegalScreen} from "@/components/legal/AutomaticLegalScreen";
import {LegalPipelineNav} from "@/components/legal/LegalPipelineNav";
import {notFound} from "next/navigation";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {addLegalSource,addLegalIllustration,recordLegalVerdict,lockScreening} from "@/lib/actions/legalScreen";
import "../../candidates.css";

export default async function LegalScreen({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string;requested?:string;reviewed?:string;locked?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:c},{data:sources},{data:decisions},{data:locks},{data:illustrations}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status").eq("id",id).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).order("created_at",{ascending:false}),
  db.from("candidate_legal_decisions").select("decision_no,verdict,rationale,source_id,source_facts,recorded_at").eq("candidate_id",id).order("decision_no",{ascending:false}),
  db.from("candidate_legal_locks").select("*").eq("candidate_id",id).limit(1),
  db.from("candidate_legal_illustrations").select("id,source_id,asset_url,creator,archive_rights,publication_rights,planned_use,evidence_url").in("source_id",(await db.from("candidate_legal_sources").select("id").eq("candidate_id",id)).data?.map(s=>s.id)??[])
 ]);
 if(!c)notFound();

 const latest=decisions?.[0];
 const latestAutoSource=sources?.find(source=>source.id===latest?.source_id);
 let previousFacts:Record<string,unknown>|null=null;
 try{if(latestAutoSource?.notes?.startsWith('{'))previousFacts=JSON.parse(latestAutoSource.notes) as Record<string,unknown>;}catch{}

 const locked=locks?.[0];
 const q=await searchParams;
 return <main className="ca-root">

  <header className="ca-head"><div><p className="ca-eyebrow">Právní screen · CZ/EU</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name} · Prověření zdroje, nikoli snapshot</p></div></header>
  {locked?<p role="status" className="ca-success">Právní screen uzamčen. Snapshot je samostatná další etapa.</p>:null}
  {q.reviewed?<p role="status" className="ca-success">Rozhodnutí o požadavku bylo zapsáno. Samotný snapshot se v této etapě nevytváří.</p>:null}
  {q.ok?<p className="ca-success" role="status">Zapsáno.</p>:null}
  {q.error?<p className="ca-error" role="alert">Zápis se nezdařil. Zkontroluj podklady nebo oprávnění.</p>:null}
  <LegalPipelineNav step="legal" candidateId={id} admin={profile.role==="admin"}/>
  <p className="ca-links"><Link href="/member/legal">← Přehled právních screenů</Link> · <Link href={`/member/candidates/${id}`}>Bibliografický kandidát</Link></p>
  {!locked?<AutomaticLegalScreen candidateId={id}/>:null}
  {previousFacts?<section className="ca-card"><h2>Poslední uložené automatické posouzení</h2><p><strong>{latestAutoSource?.edition_title}</strong> · rozhodnutí #{latest?.decision_no} · {latest?.recorded_at?new Date(latest.recorded_at).toLocaleString("cs-CZ"):""}</p><p>Autor: {String((previousFacts.author as {status?:string}|undefined)?.status??"neověřeno")} · Překlad: {String((previousFacts.translation as {status?:string}|undefined)?.status??"neověřeno")} · Ilustrace: {String((previousFacts.illustrations as {status?:string}|undefined)?.status??"neověřeno")}</p><p><a href={latestAutoSource?.download_url??latestAutoSource?.source_url} target="_blank" rel="noopener noreferrer">Přesný vybraný zdroj a podklady</a></p><details><summary>Podrobnosti a auditní důvody</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(previousFacts,null,2)}</pre></details></section>:null}

  {!locked?<details className="ca-card"><summary>Pokročilé · ruční zdroje, edice a právní evidence</summary><LegalSourceDiscovery title={c.proposed_title} author={c.proposed_author_name}/><GutenbergSourcePicker candidateId={id}/><form id="legal-source-form" className="ca-card ca-form" action={addLegalSource.bind(null,id)}><h2>Přidat zdroj / edici</h2>
   <label>Zdroj<select name="source_kind"><option value="gutenberg">Project Gutenberg</option><option value="open_library">Open Library</option><option value="library">Knihovna / archiv</option><option value="other">Jiný zdroj</option></select></label>
   <label>Název edice<input name="edition_title" required maxLength={300}/></label>
   <label>Stránka konkrétní edice<input name="source_url" type="url" required maxLength={1000}/></label>
   <label>Přesná URL souboru, který má být později stažen<input name="download_url" type="url" required maxLength={1000}/></label>
   <label>Jde o originál, nebo překlad?<select name="translation_status"><option value="unknown">Nezjištěno</option><option value="original">Originál</option><option value="translated">Překlad</option></select></label>
   <label>Odkaz pro čtení / náhled (volitelné)<input name="read_url" type="url" maxLength={1000}/></label>
   <label>Rok edice<input name="edition_year" type="number" min="1400" max="2100"/></label>
   <label>Jazyk<input name="language_code" maxLength={30} placeholder="cs / en"/></label>
   <label>Překladatel<input name="translator" maxLength={300}/></label><label>Ilustrátor<input name="illustrator" maxLength={300}/></label>
   <fieldset><legend>Orientační chronologie (ověřit podklady)</legend>
   <label>Úmrtí autora<input name="author_died" type="number" min="1000" max="2100"/></label>
   <label>Úmrtí překladatele<input name="translator_died" type="number" min="1000" max="2100"/></label>
   <label>Úmrtí ilustrátora<input name="illustrator_died" type="number" min="1000" max="2100"/></label>
   <p>Datum úmrtí napoví možnou volnost práv; samo o sobě není právním schválením. Více autorů či zvláštní ochranu řeš ručně.</p></fieldset>
   <label>Shoda díla<select name="identity_match"><option value="uncertain">Nutno ověřit</option><option value="confirmed">Potvrzená</option><option value="mismatch">Neshoda</option></select></label>
   <label>Shoda jazyka<select name="language_match"><option value="uncertain">Nutno ověřit</option><option value="matches">Potvrzená</option><option value="mismatch">Neshoda</option></select></label>
   <label>Formát<select name="text_format"><option value="unknown">Neověřeno</option><option value="plain_text">Čistý text</option><option value="html">HTML</option><option value="epub">EPUB</option><option value="ocr_pdf">OCR/PDF</option><option value="scan">Sken</option><option value="catalog_only">Pouze katalog</option></select></label>
   <label>Úplnost<select name="completeness"><option value="unknown">Neověřeno</option><option value="complete">Úplný text</option><option value="partial">Část textu</option></select></label>
   <label>Kvalita textu<select name="text_quality"><option value="unknown">Neověřeno</option><option value="verified">Ověřený text</option><option value="needs_cleanup">Vyžaduje čištění</option></select></label>
   <label>Práva původního textu<select name="original_rights"><option value="unknown">Neověřeno</option><option value="public_domain">Volné dílo</option><option value="licensed">Licence</option><option value="restricted">Omezeno</option></select></label>
   <label>Práva překladu<select name="translation_rights"><option value="unknown">Neověřeno</option><option value="not_applicable">Bez překladu</option><option value="public_domain">Volné dílo</option><option value="licensed">Licence</option><option value="restricted">Omezeno</option></select></label>
   <label>Ilustrace — v této fázi orientačně<select name="illustration_use"><option value="unknown">Neověřeno / evidovat samostatně</option><option value="excluded">Text bez ilustrací</option><option value="unknown">Neověřeno</option><option value="public_domain">Volné dílo</option><option value="licensed">Licence</option><option value="restricted">Omezeno</option></select></label>
   <label>Podmínky zdroje<select name="source_terms"><option value="unknown">Neověřeno</option><option value="cleared">Ověřeny</option><option value="restricted">Omezeno</option></select></label>
   <label>Odkaz na právní podklad<input name="evidence_url" type="url" maxLength={1000}/></label>
   <label>Zdůvodnění / poznámky<textarea name="notes" rows={4} maxLength={5000}/></label>
   <button className="ca-btn ca-primary" type="submit">Uložit edici</button>
  </form></details>:null}
  <details className="ca-card"><summary>Evidence zdrojových edic</summary><h2>Posuzované edice</h2>
   {sources?.length?sources.map(s=><article key={s.id} style={{borderTop:"1px solid var(--artales-border)",paddingBlock:14}}>
    <strong>{s.edition_title}</strong><p>{s.source_kind} · {s.edition_year??"Rok neuveden"} · {s.language_code||"jazyk neuveden"}</p>
    <p><a target="_blank" rel="noopener noreferrer" href={s.source_url}>Katalogový záznam ↗</a>
     {s.read_url?<> · <a href={s.read_url} target="_blank" rel="noopener noreferrer">Číst externě ↗</a></>:null}</p>
    <small>Soubor: {s.download_url??"není určen"} · Originál: {s.original_rights} · Překlad: {s.translation_rights} · Podmínky: {s.source_terms}</small>
   </article>):<p>Zatím žádné zapsané edice.</p>}
  </details>
  <details className="ca-card"><summary>Pokročilé · podklady a inventář ilustrací</summary><h2>Ilustrace · samostatné právní posouzení</h2>
  <p>Obrázky se evidují bez jejich stahování. Použitelný text není blokován nejasnými právy ilustrací.</p>
  {illustrations?.map(i=><p key={i.id}><a href={i.asset_url} target="_blank" rel="noopener noreferrer">{i.creator||"Ilustrace"}</a> · Archivace: {i.archive_rights} · Publikace: {i.publication_rights} · Záměr: {i.planned_use}</p>)}
  {!locked?<form className="ca-form" action={addLegalIllustration.bind(null,id)}>
   <label>Edice<select name="source_id" required>{sources?.map(src=><option key={src.id} value={src.id}>{src.edition_title}</option>)}</select></label>
   <label>Odkaz obrázku<input type="url" name="asset_url" required maxLength={1000}/></label>
   <label>Ilustrátor<input name="creator" maxLength={300}/></label>
   <label>Právo archivovat<select name="archive_rights"><option value="unknown">Neověřeno</option><option value="cleared">Doloženo</option><option value="restricted">Omezeno</option></select></label>
   <label>Právo publikovat<select name="publication_rights"><option value="unknown">Neověřeno</option><option value="cleared">Doloženo</option><option value="restricted">Omezeno</option></select></label>
   <label>Záměr<select name="planned_use"><option value="exclude">Pouze evidence, bez kopie</option><option value="archive_only">Archivovat, nepublikovat</option><option value="publish">Archivovat a publikovat</option></select></label>
   <label>Právní podklad<input name="evidence_url" type="url" maxLength={1000}/></label>
   <label>Poznámky<textarea name="notes" maxLength={2000}/></label>
   <button className="ca-btn ca-secondary" type="submit">Přidat ilustraci do evidence</button>
   </form>:null}
  </details>
  {!locked?<form className="ca-card ca-form" action={recordLegalVerdict.bind(null,id)}><h2>Rozhodnutí</h2>
   <p>Právní kontrolu a schválení zdroje může provádět editor i administrátor a vyžaduje doložený právní základ. Žádný obsah se nepřebírá ani nepublikuje.</p>
   <label>Edice<select name="source_id"><option value="">Bez konkrétní edice</option>{sources?.map(s=><option key={s.id} value={s.id}>{s.edition_title}</option>)}</select></label>
   <label>Výsledek<select name="verdict"><option value="needs_evidence">Doplnit podklady</option><option value="deferred">Odložit</option><option value="approved">Právně ověřeno</option><option value="rejected">Vyřadit</option></select></label>
   <label>Zdůvodnění<textarea name="rationale" minLength={15} maxLength={5000} rows={4} required/></label>
   <button className="ca-btn ca-primary" type="submit">Zapsat rozhodnutí</button>
  </form>:null}
  <section className="ca-card"><h2>Uzamčení prověřené verze</h2>
  <p>Výsledek obsahuje přesný zdrojový soubor, stav práv původního textu, překladu i každé evidované ilustrace a odkazy na důkazy. Uzamčení neprovádí snapshot.</p>
  {locked?<><p><strong>Zamčeno dne {new Date(locked.locked_at).toLocaleDateString("cs-CZ")}.</strong></p>
  <p><a href={`/member/candidates/${id}/legal/report`}>Stáhnout předávací protokol (JSON)</a></p></>:null}
  {!locked&&latest?.verdict==="approved"&&latest.source_id?
    <form action={lockScreening.bind(null,id)} className="ca-form">
      <input type="hidden" name="source_id" value={latest.source_id}/>
      <input type="hidden" name="decision_no" value={latest.decision_no}/>
      <p>Vybraný soubor: {sources?.find(s=>s.id===latest.source_id)?.download_url??"neurčeno"}</p>
      <button type="submit" className="ca-btn ca-primary">Uzamknout právně prověřený zdroj</button>
    </form>:null}
  </section>
  <details className="ca-card"><summary>Historie právních rozhodnutí</summary><h2>Historie rozhodnutí</h2>{decisions?.length?decisions.map(d=><article key={d.decision_no}><p><strong>#{d.decision_no} · {d.verdict}</strong> · {new Date(d.recorded_at).toLocaleDateString("cs-CZ")}</p><p>{d.rationale}</p></article>):<p>Zatím bez rozhodnutí.</p>}</details>
 </main>;
}
