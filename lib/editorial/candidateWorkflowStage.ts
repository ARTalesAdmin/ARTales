/** One visible candidate stage, derived from durable downstream evidence.
 * The original work_candidates.status is an intake field, not workflow truth.
 * This module is read-only and never re-writes historical candidate records.
 */
export type CandidateWorkflowStage=
 "published"|"editorial"|"archived"|"archive_attention"|"legal_ready"|
 "approval_pending"|"uncertainty"|"deferred"|"rejected"|"new";
export type CandidateWorkflowEvidence={
 intakeStatus:string;latestVerdict?:string|null;legalLocked:boolean;
 snapshotStatus?:"verified"|"attention"|null;hasRevision:boolean;published:boolean;
};
export function candidateWorkflowStage(e:CandidateWorkflowEvidence):CandidateWorkflowStage{
 if(e.published)return "published";
 if(e.hasRevision)return "editorial";
 if(e.snapshotStatus==="verified")return "archived";
 if(e.snapshotStatus==="attention")return "archive_attention";
 if(e.legalLocked)return "legal_ready";
 if(e.latestVerdict==="approved")return "approval_pending";
 if(e.latestVerdict==="rejected"||e.intakeStatus==="rejected")return "rejected";
 if(e.latestVerdict==="deferred"||e.intakeStatus==="deferred")return "deferred";
 if(e.latestVerdict==="needs_evidence")return "uncertainty";
 return "new";
}
export const candidateWorkflowLabels:Record<CandidateWorkflowStage,string>={
 published:"Publikováno",editorial:"Redakční práce",archived:"Archiv připraven",
 archive_attention:"Prověřit archiv",legal_ready:"Právní check dokončen",
 approval_pending:"Dokončit předání",uncertainty:"Vyřešit nejistotu",
 deferred:"Pozastaveno",rejected:"Vyřazeno",new:"Čeká na právní check"
};
export function candidateWorkflowDestination(id:string,s:CandidateWorkflowStage):string{
 if(s==="editorial"||s==="published")return "/member/editorial-detail/"+id;
 if(s==="archived"||s==="archive_attention"||s==="legal_ready")return "/member/snapshot/"+id;
 return "/member/legal/"+id;
}
export function candidateWorkflowAction(s:CandidateWorkflowStage):string{
 if(s==="published")return "Otevřít dílo";
 if(s==="editorial")return "Pokračovat v redakci";
 if(s==="archived"||s==="legal_ready")return "Pokračovat ve zpracování";
 if(s==="archive_attention")return "Prověřit archiv";
 if(s==="uncertainty")return "Rozhodnout o nejistotě";
 if(s==="approval_pending")return "Dokončit právní předání";
 if(s==="deferred")return "Zobrazit pozastavení";
 if(s==="rejected")return "Zobrazit důvod";
 return "Provést právní check";
}