"use client";
import {useState,useTransition} from "react";
import {applySemanticQaLayoutFix,resolveSemanticQaFlag,submitSemanticQaFlag} from "@/app/member/semantic/[candidateId]/qa-actions";
export type SemanticQaFlag={
 id:string;revision_sha256:string;target_atom_id:string;
 source_start:number;source_end:number;kind:string;comment:string;
 status:"open"|"resolved";created_at:string;resolution_note:string|null;
};
type Props={candidateId:string;revisionSha:string;selectedAtomId:string|null;
 selectedText:string|null;flags:SemanticQaFlag[];onSelect:(atomId:string)=>void;
 readonly?:boolean;databaseReady:boolean;canApplyLayoutFix:boolean};
const kinds=[{value:"text",label:"Text"},{value:"typography",label:"Sazba a řádky"},
 {value:"structure",label:"Struktura"},{value:"image",label:"Vizuál"},
 {value:"other",label:"Jiné"}];
export default function SemanticQaPanel(p:Props){
 const [kind,setKind]=useState("typography");
 const [comment,setComment]=useState("");
 const [resolutions,setResolutions]=useState<Record<string,string>>({});
 const [feedback,setFeedback]=useState("");
 const [pending,startTransition]=useTransition();
 const open=p.flags.filter(f=>f.status==="open");
 const selected=p.flags.filter(f=>f.target_atom_id===p.selectedAtomId);
 const submit=()=>{
  if(!p.selectedAtomId||pending)return;
  startTransition(async()=>{
   const result=await submitSemanticQaFlag({
    candidateId:p.candidateId,revisionSha:p.revisionSha,
    atomId:p.selectedAtomId!,kind,comment
   });
   setFeedback(result.message);
   if(result.ok)setComment("");
  });
 };
 const resolve=(id:string)=>{
  startTransition(async()=>{
   const result=await resolveSemanticQaFlag({
    candidateId:p.candidateId,flagId:id,resolutionNote:resolutions[id]??""
   });
   setFeedback(result.message);
  });
 };
 return <aside className="semantic-qa-panel" aria-label="Redakční nálezy a opravy">
  <div className="semantic-qa-panel__heading">
   <h2>QA nálezy</h2>
   <span>{open.length} otevřených · {p.flags.length-open.length} uzavřených</span>
  </div>
  {!p.databaseReady?<p role="alert">Trvalé QA záznamy zatím nejsou dostupné.
   Nelze bezpečně uzavřít kontrolu.</p>:null}
  <p>Vyber blok v jednom z panelů. Zvýrazní se obě odpovídající části a
   komentář zůstane připojený ke konkrétní neměnné revizi.</p>
  {p.selectedAtomId?<div className="semantic-qa-panel__selection">
   <strong>Vybraný blok</strong>
   <p>{p.selectedText?.slice(0,240)??p.selectedAtomId}</p>
   <small>{selected.length} nálezů pro tento blok</small>
  </div>:<p className="semantic-qa-panel__selection">Klikni na označení bloku v originálu nebo v kompozici.</p>}
  {p.selectedAtomId&&p.databaseReady&&!p.readonly?
   <form onSubmit={e=>{e.preventDefault();submit();}} className="semantic-qa-panel__form">
    <label>Druh problému<select value={kind} onChange={e=>setKind(e.target.value)}>
     {kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
    </select></label>
    <label>Co je třeba opravit?<textarea value={comment} minLength={15} maxLength={4000}
     rows={3} onChange={e=>setComment(e.target.value)}
     placeholder="Například: osamocené I na konci řádku; spojit s následujícím slovem."/></label>
    <button type="submit" disabled={pending||comment.trim().length<15}>Zaznamenat a vrátit k opravě</button>
   </form>:null}
  <h3>Seznam nálezů</h3>
  {p.flags.length===0?<p>Žádné nálezy. Stav není automaticky schválením.</p>:
   <div className="semantic-qa-panel__flags">{p.flags.map(f=><article key={f.id}
     className={"semantic-qa-panel__flag"+(f.status==="open"?" semantic-qa-panel__flag--open":"")}>
    <div><strong>{kinds.find(k=>k.value===f.kind)?.label??f.kind}</strong>
     {" · "}{f.status==="open"?"Čeká na opravu":"Uzavřeno"}
     <button type="button" onClick={()=>p.onSelect(f.target_atom_id)}>Najít blok</button>
    </div>
    <p>{f.comment}</p>
    {f.status==="resolved"?<small>{f.resolution_note}</small>:
     <div className="semantic-qa-panel__form">
      {p.canApplyLayoutFix&&f.kind==="typography"&&f.revision_sha256===p.revisionSha?
       <div className="semantic-qa-panel__repair">
        <strong>Vytvořit opravenou revizi:</strong>
        <button type="button" disabled={pending} onClick={()=>applyLayout(f.id,"compact")}>
          Zmenšit mezery u bloku</button>
        <button type="button" disabled={pending} onClick={()=>applyLayout(f.id,"airy")}>
          Zvětšit mezery</button>
        <button type="button" disabled={pending} onClick={()=>applyLayout(f.id,"centered")}>
          Zarovnat na střed</button>
       </div>:null}
      <label>Zdůvodnění uzavření po opravě / vysvětlení
       <textarea rows={2} minLength={30} maxLength={4000} value={resolutions[f.id]??""}
        onChange={e=>setResolutions(s=>({...s,[f.id]:e.target.value}))}/>
      </label>
      <button type="button" disabled={pending||(resolutions[f.id]?.trim().length??0)<30}
       onClick={()=>resolve(f.id)}>Uzavřít nález s důkazem</button>
     </div>}
   </article>)}</div>}
  <p role="status" aria-live="polite">{feedback}</p>
  <small>Uzavření nálezu nemění text ani jej samo neopravuje.
   Změny kompozice vyžadují novou revizi a další redakční kontrolu.</small>
 </aside>;
}
