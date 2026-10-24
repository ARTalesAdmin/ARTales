import Link from "next/link";
import CandidateCatalogAssist from "./CandidateCatalogAssist";
import {notFound} from "next/navigation";
import {CANDIDATES_AB_ENABLED} from "@/lib/candidates/featureFlag";
import {requireEditorOrAdmin} from "@/lib/guards";
import {createManualCandidate} from "@/lib/actions/candidateIntake";
import "../candidates.css";
export default async function NewCandidate({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(!CANDIDATES_AB_ENABLED)notFound();
 await requireEditorOrAdmin();const {error}=await searchParams;
 return <main className="ca-root"><p><Link href="/member/candidates">← Kandidáti</Link></p><header className="ca-head"><div><p className="ca-eyebrow">Redakční evidence</p><h1>Nový kandidát</h1><p>Založení námětu není právním schválením ani založením publikovaného díla.</p></div></header>
 {error?<p className="ca-error" role="alert">{error==="duplicate"?"Tento kandidát nebo dílo již existuje.":"Založení se nezdařilo; ověř vstup a oprávnění."}</p>:null}
 <CandidateCatalogAssist/><form action={createManualCandidate} className="ca-form ca-card"><label>Název díla<input id="candidate-title" name="title" maxLength={300} required/></label><label>Autor / autoři<input id="candidate-author" name="author" maxLength={200} required/></label><label>Odkaz na původ námětu (volitelné)<input id="candidate-reference" name="reference" maxLength={500}/></label><label>Priorita (0–100)<input name="priority" type="number" min="0" max="100" defaultValue={50}/></label><label>Poznámky<textarea name="notes" maxLength={5000} rows={4}/></label><button className="ca-btn ca-primary" type="submit">Uložit kandidáta</button></form></main>;
}