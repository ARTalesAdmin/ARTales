import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/guards";
import {createClient} from "@/lib/supabase/server";
import {getServerSupabaseConnection} from "@/lib/supabase/connectionIsolation";
import {getWorkForEditBySlug} from "@/lib/dbWorks";
import {selfPilotAllowed} from "@/lib/semantic/selfPilotDraft";
import {verifySignedReadback} from "@/lib/semantic/verifySignedReadback";
import {walkSemanticAtoms} from "@/lib/semantic/compose";
import {enqueueSelfPilot,saveOwnSemanticDraft,approveOwnAliceTextQa,requestOwnAliceIndent} from "./actions";
import {claimEditorialTask} from "@/app/member/editorial-tasks/actions";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
type Props={params:Promise<{slug:string}>;searchParams:Promise<{notice?:string;error?:string}>};
type Task={id:string;status:string;assignee_user_id:string|null;source_external_id:string|null};
export default async function SelfSemanticPilot({params,searchParams}:Props){
 const actor=await requireAdmin();
 const conn=getServerSupabaseConnection();
 if(!selfPilotAllowed({actorId:actor.id,configuredActorId:process.env.ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID,
  deployment:process.env.VERCEL_ENV??process.env.NEXT_PUBLIC_VERCEL_ENV,
  connectionEnabled:conn.enabled,connectionReason:conn.reason}))notFound();
 const {slug}=await params;
 const search=await searchParams;
 const work=await getWorkForEditBySlug(slug);
 if(!work)notFound();
 const db=await createClient();
 const [{data:tasks,error:taskError},{data:current,error:readError},{data:captures,error:captureError},{data:approval,error:approvalError}]=await Promise.all([
  db.from("editorial_tasks").select("id,status,assignee_user_id,source_external_id")
    .eq("work_id",work.id).eq("source_external_id","semantic-v2-selfpilot:"+work.id).limit(1),
  db.rpc("get_semantic_v2_editor_state",{p_work_id:work.id}),
  db.rpc("list_semantic_v2_self_sources",{p_work_id:work.id}),
  db.rpc("get_semantic_v2_editor_approval",{p_work_id:work.id})
 ]);
 const task=!taskError?(tasks as Task[]|null)?.[0]:undefined;
 const eligibleSources=(!captureError&&captures?.result==="ready"&&Array.isArray(captures.sources))
  ? (captures.sources as {snapshot_id:string;source_sha256:string;captured_at:string;source_uri:string|null;byte_length:number}[])
  : [];
 let verified:ReturnType<typeof verifySignedReadback>|null=null;
 let validationError=false;
 try{if(!readError&&current?.result==="ready")verified=verifySignedReadback(current,{work_id:work.id,slug});}
 catch{validationError=true;}
 const approved=Boolean(!approvalError&&approval?.result==="approved_editorial_only"&&verified&&approval.draft_id===verified.draft_id&&approval.revision_sha256===verified.revision.revision_sha256&&approval.publication_allowed===false);
 const unavailable=Boolean(taskError||readError||validationError||(task&&Boolean(approvalError))||(task&&current?.result==="blocked"&&current?.reason!=="claimed_work_task_required"));
 const canSave=Boolean(task?.status==="claimed"&&task.assignee_user_id===actor.id&&!approved&&!unavailable&&
    (!verified||Boolean(verified.pending_issue))) && approval?.result!=="approved_editorial_only";
 return <main style={{maxWidth:980,margin:"auto",padding:"36px 20px"}}>
  <p><Link href="/member/editorial-tasks">← Redakční úkoly</Link></p>
  <p style={{letterSpacing:".08em",fontSize:12}}>ARTales · Soukromý pilot sémantického editoru</p>
  <h1>{work.title}</h1>
  <p><strong>Testovací režim.</strong> Pracuje pouze s archivovaným zdrojem a oddělenou sémantickou revizí.
   Nikdy nemění veřejnou čtečku, její poznámky, postup čtení ani stav vydání.</p>
  {search.notice?<p role="status">Změna byla přijata; zobrazený stav je nově načten ze serveru.</p>:null}
  {search.error?<p role="alert">Akci nebylo možné bezpečně potvrdit ({search.error}). Ověř zdroj a stav úkolu.</p>:null}
  {unavailable?<p role="alert">Databázový pilot nebo ověření revize nejsou dostupné. Zápis je zablokován.</p>:null}
  <section style={{border:"1px solid #888",borderRadius:12,padding:20,margin:"20px 0"}}>
   <h2>1. Můj redakční úkol</h2>
   {!task?<><p>Vyber archivovaný zdroj podle data a kontrolního otisku. Pokud žádný není dostupný,
     chybí zatím důvěryhodný archivní záznam a nelze vytvořit úkol.</p>
    <form action={enqueueSelfPilot}>
     <input type="hidden" name="slug" value={slug}/><input type="hidden" name="work" value={work.id}/>
     <label htmlFor="source">Archivovaný zdroj</label>
     <select id="source" name="snapshot" required defaultValue="" style={{display:"block",width:"100%",padding:10,margin:"8px 0"}}>
      <option value="" disabled>Vyber zdroj díla</option>
      {eligibleSources.map(src=><option key={src.snapshot_id} value={src.snapshot_id}>
       {src.captured_at.slice(0,10)} · {src.source_sha256.slice(0,12)} · {src.byte_length} bajtů
      </option>)}
     </select>
     <button type="submit" disabled={unavailable||eligibleSources.length===0}>Založit soukromý úkol</button>
    </form></>:
    <><p>Stav: <strong>{task.status==="claimed"?"Převzatý mnou":task.status==="open"?"Čeká na převzetí":task.status}</strong></p>
     {task.status==="open"?<form action={claimEditorialTask}>
      <input type="hidden" name="task_id" value={task.id}/>
      <button type="submit">Převzít jako editor</button>
     </form>:null}</>}
  </section>
  <section style={{border:"1px solid #888",borderRadius:12,padding:20,margin:"20px 0"}}>
   <h2>2. Uložená sémantická revize</h2>
   {approved?<p role="status"><strong>Redakčně schváleno</strong> — úkol uzavřen. Revize je neměnná; publikace zůstává zakázána.</p>:null}
   {approval?.result==="approved_editorial_only"&&!approved?<p role="alert">Nesoulad schválení a uložené revize. Všechny úpravy jsou zablokované.</p>:null}
   {verified?<><p role="status">Nezávisle ověřený záznam: revize {verified.revision.round+1},
    SHA-256 <code>{verified.revision.revision_sha256}</code></p>
    <p>Zdroj <code>{verified.source_sha256}</code>. Publikace: <strong>zakázána</strong>.</p>
    <p>{verified.pending_issue?"Vráceno k cílené typografické opravě.":"Uloženo; další úprava vyžaduje nezávislé vrácení s přesnou kotvou."}</p>
    <details><summary>Zkontrolovat uložený zdrojový text</summary>
     <pre style={{whiteSpace:"pre-wrap",maxHeight:420,overflow:"auto"}}>{verified.revision.source.normalized_text}</pre>
    </details></>:<p>Žádná ověřená uložená revize. Následující uložení vytvoří první koncept.</p>}
   {slug==="alices-adventures-in-wonderland"&&verified&&!verified.pending_issue&&!approved&&
    task?.status==="claimed"&&task.assignee_user_id===actor.id&&!unavailable?
    <form action={requestOwnAliceIndent}>
     <input type="hidden" name="slug" value={slug}/>
     <input type="hidden" name="work" value={work.id}/>
     <label htmlFor="atom-target">Oprava odsazení jednoho bloku</label>
     <select id="atom-target" name="atom" required defaultValue="" style={{display:"block",width:"100%",margin:"8px 0",padding:10}}>
      <option value="" disabled>Vyber konkrétní odstavec</option>
      {walkSemanticAtoms(verified.revision.blocks).filter(a=>a.raw.trim().length>0).slice(0,300).map(a=>
       <option key={a.id} value={a.id}>{a.raw.slice(0,110)}</option>)}
     </select>
     <button type="submit">Navrhnout odsazení vybraného bloku</button>
     <p>Vznikne jedna přesně ukotvená připomínka. Poté lze uložit opravenou revizi; původní text zůstane beze změny.</p>
    </form>:null}
   {canSave?<form action={saveOwnSemanticDraft}>
    <input type="hidden" name="slug" value={slug}/><input type="hidden" name="work" value={work.id}/>
    <input type="hidden" name="parent" value={verified?.draft_id??""}/>
    <button type="submit">{verified?"Uložit opravu podle vrácené poznámky":"Sestavit a uložit první revizi ze zdroje"}</button>
    <p>Po uložení se stav znovu načte z databáze a ověří podle hashe. Pro další kolo je nutný nezávislý reviewer.</p>
   </form>:<p>Ukládání je dostupné jen po převzetí vlastního úkolu; případně musí existovat přesně ukotvená vrácená oprava.</p>}
  </section>
  {slug==="alices-adventures-in-wonderland"&&verified&&task?.status==="claimed"&&
   task.assignee_user_id===actor.id&&!verified.pending_issue&&!approved&&!unavailable&&
   approval?.result==="not_approved"?<section style={{border:"1px solid #888",borderRadius:12,padding:20,margin:"20px 0"}}>
    <h2>3. Uzavření textového QA</h2>
    <p>Jen pro importovanou Alenku. Stvrzuješ neměnnou textovou revizi po vlastní kontrole;
     neověřuje to samo o sobě práva, obrázky ani Reader. <strong>Nic se nezveřejní.</strong></p>
    <form action={approveOwnAliceTextQa}>
     <input type="hidden" name="slug" value={slug}/>
     <input type="hidden" name="work" value={work.id}/>
     <input type="hidden" name="draft" value={verified.draft_id}/>
     <input type="hidden" name="digest" value={verified.revision.revision_sha256}/>
     <button type="submit">Schválit textové QA — bez publikace</button>
    </form>
   </section>:null}
  <p><strong>Schvalování:</strong> Pro tento jediný archivní pilot lze potvrdit vlastní textové QA. Všechna ostatní díla zatím zachovávají původní nezávislou kontrolu. Publikace a Reader cutover nejsou povoleny.</p>
 </main>;
}
