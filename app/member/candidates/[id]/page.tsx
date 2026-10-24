import Link from "next/link";
import {CANDIDATES_AB_ENABLED} from "@/lib/candidates/featureFlag";
import {notFound} from "next/navigation";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {updateCandidate} from "@/lib/actions/candidateIntake";
import "../candidates.css";
export default async function CandidateDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string;error?:string}>}) {
 if(!CANDIDATES_AB_ENABLED)notFound();
 await requireEditorOrAdmin();
 const {id}=await params; if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const db=await createClient();
 const {data:c,error}=await db.from("work_candidates").select("*").eq("id",id).maybeSingle();
 if(error||!c)notFound();
 const paramsQuery=await searchParams;
 const statuses:Record<string,string>={new:"Nový",checking:"V posouzení",ready:"Připraveno pro právní screen",deferred:"Odloženo",rejected:"Zamítnuto"};
 const metadata=c.prescreen_metadata??{};
 const action=updateCandidate.bind(null,id);
 return <main className="ca-root"><p><Link href="/member/candidates">← Kandidáti</Link></p><header className="ca-head"><div><p className="ca-eyebrow">{c.origin==="prescreen"?"Původ: Prescreen":"Ručně založený námět"}</p><h1>{c.proposed_title}</h1><p>{c.proposed_author_name}</p></div></header>
 {paramsQuery.saved?<p role="status" className="ca-success">Změny byly uloženy.</p>:null}{paramsQuery.error?<p role="alert" className="ca-error">Uložení se nezdařilo. Obnov stránku a zkus to znovu.</p>:null}
 <section className="ca-card"><h2>Bibliografický námět</h2><dl className="ca-facts"><div><dt>První vydání</dt><dd>{metadata.firstPublished??"Neznámé"}</dd></div><div><dt>Úmrtí autora</dt><dd>{metadata.authorDied??"Neznámé"}</dd></div><div><dt>Podklad pro výběr</dt><dd>{c.origin==="prescreen"?"Open Library (předběžný tip)":"Ručně"}</dd></div><div><dt>Právní stav</dt><dd>Neposouzeno</dd></div></dl>
 {metadata.sourceUrl?<p><a href={metadata.sourceUrl} target="_blank" rel="noopener noreferrer">Bibliografický záznam ↗</a> — není schválenou edicí.</p>:null}
 {metadata.prescreenReason?<p>V Prescreenu: {metadata.prescreenReason}</p>:null}
 {c.origin_reference&&c.origin!=="prescreen"?<p>Původní odkaz: {c.origin_reference}</p>:null}</section>
 <form className="ca-card ca-form" action={action}><h2>Redakční zpracování</h2><label>Stav<select name="status" defaultValue={c.status}>{Object.entries(statuses).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Priorita (0–100)<input type="number" name="priority" min={0} max={100} defaultValue={c.priority}/></label><label>Interní poznámky<textarea name="notes" rows={6} maxLength={5000} defaultValue={c.notes??""}/></label><p className="ca-hint">„Připraveno“ znamená pouze připravenost k pozdějšímu právnímu screenu. Nejde o souhlas s publikací.</p><button className="ca-btn ca-primary" type="submit">Uložit změny</button></form></main>;
}