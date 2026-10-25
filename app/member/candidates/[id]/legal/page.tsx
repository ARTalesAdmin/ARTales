import Link from "next/link";
import {notFound} from "next/navigation";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {addLegalSource,recordLegalVerdict} from "@/lib/actions/legalScreen";
import "../../candidates.css";

export default async function LegalScreen({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;ok?:string}>}){
 if(!LEGAL_SCREEN_V1_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const [{data:c},{data:sources},{data:decisions}]=await Promise.all([
  db.from("work_candidates").select("id,proposed_title,proposed_author_name,status").eq("id",id).maybeSingle(),
  db.from("candidate_legal_sources").select("*").eq("candidate_id",id).order("created_at",{ascending:false}),
  db.from("candidate_legal_decisions").select("decision_no,verdict,rationale,source_facts,recorded_at").eq("candidate_id",id).order("decision_no",{ascending:false})
 ]);
 if(!c)notFound();
 const isAdmin=profile.role==="admin";
 const q=await searchParams;
 return <main className="ca-root">
  <p><Link href={`/member/candidates/${id}`}>← Kandidát</Link></p>
  <header className="ca-head"><div><p className="ca-eyebrow">Právní screen · CZ/EU</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name} · Prověření zdroje, nikoli snapshot</p></div></header>
  {q.ok?<p className="ca-success" role="status">Zapsáno.</p>:null}
  {q.error?<p className="ca-error" role="alert">Zápis se nezdařil. Zkontroluj podklady nebo oprávnění.</p>:null}
  <section className="ca-card"><h2>Vyhledání edic</h2><p>Vyhledej možné edice v katalogu Open Library. Konkrétní verzi textu je nutné ověřit samostatně.</p>
   <a target="_blank" rel="noopener noreferrer" href={`https://openlibrary.org/search?q=${encodeURIComponent(c.proposed_title+" "+c.proposed_author_name)}`}>Hledat v Open Library ↗</a>
   <p><a target="_blank" rel="noopener noreferrer" href={`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(c.proposed_title+" "+c.proposed_author_name)}`}>Hledat v Project Gutenberg ↗</a></p>
  </section>
  <form className="ca-card ca-form" action={addLegalSource.bind(null,id)}><h2>Přidat zdroj / edici</h2>
   <label>Zdroj<select name="source_kind"><option value="open_library">Open Library</option><option value="gutenberg">Project Gutenberg</option><option value="library">Knihovna / archiv</option><option value="other">Jiný zdroj</option></select></label>
   <label>Název edice<input name="edition_title" required maxLength={300}/></label>
   <label>Odkaz na zdroj<input name="source_url" type="url" required maxLength={1000}/></label>
   <label>Odkaz pro čtení / náhled (volitelné)<input name="read_url" type="url" maxLength={1000}/></label>
   <label>Rok edice<input name="edition_year" type="number" min="1400" max="2100"/></label>
   <label>Jazyk<input name="language_code" maxLength={30} placeholder="cs / en"/></label>
   <label>Překladatel<input name="translator" maxLength={300}/></label><label>Ilustrátor<input name="illustrator" maxLength={300}/></label>
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
   <p>Schválení provádí pouze administrátor a vyžaduje doložený právní základ. Žádný obsah se nepřebírá ani nepublikuje.</p>
   <label>Edice<select name="source_id"><option value="">Bez konkrétní edice</option>{sources?.map(s=><option key={s.id} value={s.id}>{s.edition_title}</option>)}</select></label>
   <label>Výsledek<select name="verdict"><option value="needs_evidence">Doplnit podklady</option><option value="deferred">Odložit</option>{isAdmin?<><option value="approved">Schválit zdroj</option><option value="rejected">Vyřadit</option></>:null}</select></label>
   <label>Zdůvodnění<textarea name="rationale" minLength={15} maxLength={5000} rows={4} required/></label>
   <button className="ca-btn ca-primary" type="submit">Zapsat rozhodnutí</button>
  </form>
  <section className="ca-card"><h2>Historie rozhodnutí</h2>{decisions?.length?decisions.map(d=><article key={d.decision_no}><p><strong>#{d.decision_no} · {d.verdict}</strong> · {new Date(d.recorded_at).toLocaleDateString("cs-CZ")}</p><p>{d.rationale}</p></article>):<p>Zatím bez rozhodnutí.</p>}</section>
 </main>;
}
