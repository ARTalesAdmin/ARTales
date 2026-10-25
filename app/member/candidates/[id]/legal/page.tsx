import Link from "next/link";
import {notFound} from "next/navigation";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {addLegalSource,recordLegalVerdict,requestSnapshot,reviewSnapshot} from "@/lib/actions/legalScreen";
import "../../candidates.css";

export default async function LegalScreen({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string;requested?:string;reviewed?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:c},{data:sources},{data:decisions},{data:requests}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status").eq("id",id).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).order("created_at",{ascending:false}),
  db.from("candidate_legal_decisions").select("decision_no,verdict,rationale,source_id,source_facts,recorded_at").eq("candidate_id",id).order("decision_no",{ascending:false}),
  db.from("candidate_snapshot_requests").select("id,source_id,status,created_at").eq("candidate_id",id).order("created_at",{ascending:false})
 ]);
 if(!c)notFound();
 const isAdmin=profile.role==="admin";
 const latest=decisions?.[0];
 const pending=requests?.find(r=>r.status==="pending");
 const q=await searchParams;
 return <main className="ca-root">
  <p><Link href={`/member/candidates/${id}`}>← Kandidát</Link></p>
  <header className="ca-head"><div><p className="ca-eyebrow">Právní screen · CZ/EU</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name} · Prověření zdroje, nikoli snapshot</p></div></header>
  {(q.requested||pending)?<p role="status" className="ca-success">Čeká na schválení administrátorem. Snapshot zatím nevznikl.</p>:null}
  {q.reviewed?<p role="status" className="ca-success">Rozhodnutí o požadavku bylo zapsáno. Samotný snapshot se v této etapě nevytváří.</p>:null}
  {q.ok?<p className="ca-success" role="status">Zapsáno.</p>:null}
  {q.error?<p className="ca-error" role="alert">Zápis se nezdařil. Zkontroluj podklady nebo oprávnění.</p>:null}
  <section className="ca-card"><h2>Vyhledání edic</h2><p>Výchozí katalog je Project Gutenberg. Doplňkově lze hledat v Open Library. Konkrétní verzi textu je nutné ověřit samostatně.</p>
   <a target="_blank" rel="noopener noreferrer" href={`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(c.proposed_title+" "+c.proposed_author_name)}`}>Hledat v Gutenberg (výchozí) ↗</a>
   <p><a target="_blank" rel="noopener noreferrer" href={`https://openlibrary.org/search?q=${encodeURIComponent(c.proposed_title+" "+c.proposed_author_name)}`}>Open Library (alternativní) ↗</a></p>
  </section>
  <form className="ca-card ca-form" action={addLegalSource.bind(null,id)}><h2>Přidat zdroj / edici</h2>
   <label>Zdroj<select name="source_kind"><option value="gutenberg">Project Gutenberg</option><option value="open_library">Open Library</option><option value="library">Knihovna / archiv</option><option value="other">Jiný zdroj</option></select></label>
   <label>Název edice<input name="edition_title" required maxLength={300}/></label>
   <label>Odkaz na zdroj<input name="source_url" type="url" required maxLength={1000}/></label>
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
   <label>Ilustrace<select name="illustration_use"><option value="excluded">Nepřebírat</option><option value="unknown">Neověřeno</option><option value="public_domain">Volné dílo</option><option value="licensed">Licence</option><option value="restricted">Omezeno</option></select></label>
   <label>Podmínky zdroje<select name="source_terms"><option value="unknown">Neověřeno</option><option value="cleared">Ověřeny</option><option value="restricted">Omezeno</option></select></label>
   <label>Odkaz na právní podklad<input name="evidence_url" type="url" maxLength={1000}/></label>
   <label>Zdůvodnění / poznámky<textarea name="notes" rows={4} maxLength={5000}/></label>
   <button className="ca-btn ca-primary" type="submit">Uložit edici</button>
  </form>
  <section className="ca-card"><h2>Posuzované edice</h2>
   {sources?.length?sources.map(s=><article key={s.id} style={{borderTop:"1px solid var(--artales-border)",paddingBlock:14}}>
    <strong>{s.edition_title}</strong><p>{s.source_kind} · {s.edition_year??"Rok neuveden"} · {s.language_code||"jazyk neuveden"}</p>
    <p><a target="_blank" rel="noopener noreferrer" href={s.source_url}>Katalogový záznam ↗</a>
     {s.read_url?<> · <a href={s.read_url} target="_blank" rel="noopener noreferrer">Číst externě ↗</a></>:null}</p>
    <small>Originál: {s.original_rights} · Překlad: {s.translation_rights} · Podmínky: {s.source_terms}</small>
   </article>):<p>Zatím žádné zapsané edice.</p>}
  </section>
  <form className="ca-card ca-form" action={recordLegalVerdict.bind(null,id)}><h2>Rozhodnutí</h2>
   <p>Právní kontrolu a schválení zdroje může provádět editor i administrátor a vyžaduje doložený právní základ. Žádný obsah se nepřebírá ani nepublikuje.</p>
   <label>Edice<select name="source_id"><option value="">Bez konkrétní edice</option>{sources?.map(s=><option key={s.id} value={s.id}>{s.edition_title}</option>)}</select></label>
   <label>Výsledek<select name="verdict"><option value="needs_evidence">Doplnit podklady</option><option value="deferred">Odložit</option><option value="approved">Právně ověřeno</option><option value="rejected">Vyřadit</option></select></label>
   <label>Zdůvodnění<textarea name="rationale" minLength={15} maxLength={5000} rows={4} required/></label>
   <button className="ca-btn ca-primary" type="submit">Zapsat rozhodnutí</button>
  </form>
  <section className="ca-card"><h2>Návrh snapshotu</h2>
  <p>Editor může odeslat požadavek; pouze administrátor jej může schválit. Schválení zde ještě nestahuje ani nezakládá text.</p>
  {pending?<p role="status"><strong>Čeká na schválení.</strong></p>:null}
  {requests?.map(r=><p key={r.id}>{r.status==="pending"?"Čeká na schválení":r.status==="approved"?"Schválený požadavek — bez ingestu":"Zamítnutý požadavek"} · {new Date(r.created_at).toLocaleDateString("cs-CZ")}</p>)}
  {latest?.verdict==="approved"&&!pending&&!requests?.some(r=>r.status==="approved")?
  <form action={requestSnapshot.bind(null,id)} className="ca-form"><label>Vybraná právně ověřená edice
  <input type="hidden" name="source_id" value={latest.source_id??""}/>
  <strong>{sources?.find(s=>s.id===latest.source_id)?.edition_title??"Vybraný zdroj"}</strong></label>
  <button className="ca-btn ca-secondary" type="submit">Navrhnout snapshot — požádat o schválení</button></form>:null}
  {isAdmin&&pending?<form action={reviewSnapshot.bind(null,id)} className="ca-form">
  <input type="hidden" name="request_id" value={pending.id}/>
  <button className="ca-btn ca-primary" type="submit" name="decision" value="approved">Schválit požadavek na snapshot</button>
  <button className="ca-btn ca-secondary" type="submit" name="decision" value="rejected">Zamítnout požadavek</button>
  </form>:null}
  </section>
  <section className="ca-card"><h2>Historie rozhodnutí</h2>{decisions?.length?decisions.map(d=><article key={d.decision_no}><p><strong>#{d.decision_no} · {d.verdict}</strong> · {new Date(d.recorded_at).toLocaleDateString("cs-CZ")}</p><p>{d.rationale}</p></article>):<p>Zatím bez rozhodnutí.</p>}</section>
 </main>;
}
