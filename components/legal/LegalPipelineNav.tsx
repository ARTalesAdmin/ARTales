import Link from "next/link";
type Step="candidates"|"legal";
export function LegalPipelineNav({step,admin=false,candidateId}:{step:Step;admin?:boolean;candidateId?:string}){
 return <nav className="ca-pipeline" aria-label="Redakční postup">
  {admin?<Link href="/member/admin/prescreen/shadow">Prescreen</Link>:<span>Prescreen</span>}
  <span aria-hidden="true">›</span><Link href={candidateId?`/member/candidates/${candidateId}`:"/member/candidates"}>Kandidáti</Link>
  <span aria-hidden="true">›</span><Link aria-current={step==="legal"?"step":undefined} href={candidateId?`/member/legal/${candidateId}`:"/member/legal"}>Právní screen</Link>
  <span aria-hidden="true">›</span><span className="ca-pipeline-next">Snapshot (další etapa)</span>
 </nav>;
}
