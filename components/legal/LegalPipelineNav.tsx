import Link from "next/link";
type Step="candidates"|"legal";
export function LegalPipelineNav({step,admin=false,candidateId}:{step:Step;admin?:boolean;candidateId?:string}){
 const candidateUrl=candidateId?`/member/candidates/${candidateId}`:"/member/candidates";
 const legalUrl=candidateId?`/member/candidates/${candidateId}/legal`:"/member/legal";
 return <nav className="ca-pipeline" aria-label="Redakční postup od námětu po publikaci">
  {admin?<Link href="/member/admin/prescreen/shadow">Prescreen</Link>:<span>Prescreen</span>}
  <span aria-hidden="true">›</span>
  <Link href={candidateUrl} aria-current={step==="candidates"?"step":undefined}>Kandidáti</Link>
  <span aria-hidden="true">›</span>
  <Link href={legalUrl} aria-current={step==="legal"?"step":undefined}>Právní screen</Link>
  <span aria-hidden="true">›</span>
  <span className="ca-pipeline-next" title="Následující etapa, zatím neaktivní">Snapshot · další etapa</span>
 </nav>;
}
