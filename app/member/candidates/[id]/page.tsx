import Link from "next/link";
import {CANDIDATES_AB_ENABLED} from "@/lib/candidates/featureFlag";
import {LEGAL_SCREEN_V1_ENABLED} from "@/lib/legal/featureFlag";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {getEditorialPeople} from "@/lib/editorial/staffDirectory";
import {canProgressCandidate} from "@/lib/editorial/candidateAuthority";
import {createClient} from "@/lib/supabase/server";
import {updateCandidate} from "@/lib/actions/candidateIntake";
import "../candidates.css";
export default async function CandidateDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string;error?:string}>}) {
 if(!CANDIDATES_AB_ENABLED)notFound();
 const profile=await requireEditorOrAdmin();
 const {id}=await params; if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const {data:c,error}=await db.from("work_candidates").select("*").eq("id",id).maybeSingle();
 if(error||!c)notFound();
 const [{data:semanticRevision},{data:tasks},{data:legalLock},{data:publication}]=await Promise.all([
  db.from("candidate_semantic_revisions").select("revision_sha256").eq("candidate_id",id)
   .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("artales_editorial_tasks").select("kind,status").eq("candidate_id",id),
  db.from("candidate_legal_locks").select("decision_no").eq("candidate_id",id).maybeSingle(),
  db.from("artales_semantic_publications").select("candidate_id").eq("candidate_id",id).maybeSingle()
 ]);
 const staff=await getEditorialPeople([c.created_by]);
 const creator=staff.find(p=>p.id===c.created_by)?.display_name??"Původní editor";
 const canProgress=await canProgressCandidate(id,profile);
 const activeTasks=(tasks??[]).filter(t=>["open","claimed","returned"].includes(t.status));
 const completeTasks=(tasks??[]).filter(t=>t.status==="completed");
 const paramsQuery=await searchParams;
 const statuses:Record<string,string>={new:"Nový",checking:"V posouzení",ready:"Připraveno pro právní screen",deferred:"Odloženo",rejected:"Zamítnuto"};
 const metadata=c.prescreen_metadata??{};
 const action=updateCandidate.bind(null,id);
 return <main className="ca-root"><p><Link href="/member/candidates">← Kandidáti</Link></p><header className="ca-head"><div><p className="ca-eyebrow">{c.origin==="prescreen"?"Původ: Prescreen":"Ručně založený námět"}</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name}</p><p className="ca-hint">Vložil(a): <strong>{creator}</strong> · {c.origin==="manual"?"Ručně založený titul":"Společný Prescreen"}</p></div></header>
 {paramsQuery.saved?<p role="status" className="ca-success">Změny byly uloženy.</p>:null}{paramsQuery.error?<p role="alert" className="ca-error">Uložení se nezdařilo. Obnov stránku a zkus to znovu.</p>:null}
 {semanticRevision?<section className="ca-card" aria-label="Aktuální redakční práce">
  <h2>Redakční příprava díla</h2>
  <p>{publication?"Dílo je již v katalogu.":"Text a další podklady se připravují v redakční kartě, nikoli v bibliografické evidenci."}</p>
  <p><strong>{completeTasks.length} dokončených úkolů</strong> · {activeTasks.length} otevřených nebo rozpracovaných
   · {legalLock?"Právní zdroj zamknut":"Právní zámek čeká"}</p>
  <p>Označení „Nový“ níže označuje pouze původní evidenční stav kandidáta.</p>
  <Link className="ca-btn ca-primary" href={`/member/editorial-detail/${id}`}>Otevřít redakční kartu a stav vydání →</Link>
  <span> </span><Link className="ca-btn ca-secondary" href={`/member/semantic/${id}`}>Textové QA →</Link>
 </section>:null}
 <section className="ca-card"><h2>Bibliografický námět</h2><dl className="ca-facts"><div><dt>První vydání</dt><dd>{metadata.firstPublished??"Neznámé"}</dd></div><div><dt>Úmrtí autora</dt><dd>{metadata.authorDied??"Neznámé"}</dd></div><div><dt>Podklad pro výběr</dt><dd>{c.origin==="prescreen"?"Open Library (předběžný tip)":"Ručně"}</dd></div><div><dt>Právní stav</dt><dd>{legalLock?"Zvolený zdroj právně uzamčen":"Zdroj bez právního zámku"}</dd></div></dl>
 {metadata.sourceUrl?<p><a href={metadata.sourceUrl} target="_blank" rel="noopener noreferrer">Bibliografický záznam ↗</a> — není schválenou edicí.</p>:null}
 {metadata.prescreenReason?<p>V Prescreenu: {metadata.prescreenReason}</p>:null}
 {c.origin_reference&&c.origin!=="prescreen"?<p>Původní odkaz: {c.origin_reference}</p>:null}</section>
 {LEGAL_SCREEN_V1_ENABLED&&canProgress?<section className="ca-card"><h2>Právní screen</h2><p>Prověřit konkrétní edice, práva a zdroje bez převzetí textu.</p><Link className="ca-btn ca-primary" href={`/member/legal/${id}`}>Otevřít právní screen →</Link></section>:null}
 {canProgress?<form className="ca-card ca-form" action={action}><h2>Stav bibliografického kandidáta</h2><label>Stav<select name="status" defaultValue={c.status}>{Object.entries(statuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Priorita (0–100)<input type="number" name="priority" min={0} max={100} defaultValue={c.priority}/></label><label>Interní poznámky<textarea name="notes" rows={6} maxLength={5000} defaultValue={c.notes??""}/></label><p className="ca-hint">„Připraveno“ znamená pouze připravenost k pozdějšímu právnímu screenu. Nejde o souhlas s publikací.</p><button className="ca-btn ca-primary" type="submit">Uložit změny</button></form>:<p className="ca-card">Zpracování tohoto ručně vloženého titulu provádí původní editor nebo administrátor.</p>}</main>;
}