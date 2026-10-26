export const AUTO_SCREEN_PREFIX="Automaticky připravený komponentní právní screen:";
export type LegalDecisionRow={decision_no:number;source_id:string|null;verdict:string;rationale:string;recorded_at:string;source_facts:unknown};
export type LegalSourceRow={id:string;edition_title:string;source_url:string;download_url:string|null;identity_match:string;language_match:string;translation_status:string;translation_rights:string;original_rights:string;source_terms:string;evidence_url:string|null;notes:string;translator:string};
export type LegalReviewRun={outcome:"no"|"yes_without_illustrations"|"yes_with_illustrations";decisionNo:number;sourceId:string;recordedAt:string;edition:string;summary:string;downloadUrl:string|null;sourceUrl:string;approvalBlockers:string[]};
export type LegalHistoryEntry={decisionNo:number;recordedAt:string;label:string;automatic:boolean};
export const isAutomaticScreen=(d:Pick<LegalDecisionRow,"rationale"|"verdict">)=>d.verdict==="needs_evidence"&&d.rationale.startsWith(AUTO_SCREEN_PREFIX);
const statusLabel:Record<string,string>={
 likely_public_domain:"lhůta uplynula",protected:"ochrana trvá",needs_evidence:"údaje chybí",
 not_identified:"nezjištěno",not_applicable:"bez překladu",no_explicit_notice:"bez výslovného upozornění",
 not_checked:"kontrola nedostupná",possible_restriction:"zachyceno upozornění",unknown:"nezjištěno"
};
const human=(s:string)=>statusLabel[s]??"k ověření";
export function approvalBlockers(s:LegalSourceRow|undefined):string[]{
 if(!s)return ["Chybí přesná edice"];
 const missing:string[]=[];
 if(!s.download_url)missing.push("přesný soubor");
 if(s.identity_match!=="confirmed")missing.push("shoda díla");
 if(s.language_match!=="matches")missing.push("shoda jazyka");
 if(s.translation_status==="unknown")missing.push("původní text či překlad");
 if(s.translation_status==="original"&&(s.translator.trim()||s.translation_rights!=="not_applicable"))missing.push("práva původního znění");
 if(s.translation_status==="translated"&&(!s.translator.trim()||!["public_domain","licensed"].includes(s.translation_rights)))missing.push("práva překladatele");
 if(!["public_domain","licensed"].includes(s.original_rights))missing.push("práva původního textu");
 if(!["not_applicable","public_domain","licensed"].includes(s.translation_rights))missing.push("práva překladu");
 if(s.source_terms!=="cleared")missing.push("podmínky zdroje");
 if(!s.evidence_url)missing.push("odkaz na právní podklad");
 if((s.notes??"").trim().length<20)missing.push("doložení zdůvodnění");
 return [...new Set(missing)];
}
export function makeReviewHistory(decisions:LegalDecisionRow[],sources:LegalSourceRow[]){
 const byId=new Map(sources.map(s=>[s.id,s]));
 const checks:LegalReviewRun[]=decisions.filter(isAutomaticScreen).map(d=>{
  const src=d.source_id?byId.get(d.source_id):undefined;
  // These markers belong to this audit row; do not reuse source.notes from an earlier check.
  const parts=d.rationale.match(/;\s*(likely_public_domain|protected|needs_evidence)\s*;\s*(not_identified|not_applicable|likely_public_domain|protected|needs_evidence)\s*;\s*kontrola textu:\s*(no_explicit_notice|possible_restriction|not_checked)/);
  const summary=parts?`Autor: ${human(parts[1])} · Překlad: ${human(parts[2])} · Text: ${human(parts[3])}`:"Výsledek je uložený v auditním protokolu";
  let outcome:LegalReviewRun["outcome"]="no";
  try{const data=JSON.parse(src?.notes??"{}") as {schema?:string;outcome?:string};if(data.schema==="artales.public-domain-check.v1"&&["no","yes_without_illustrations","yes_with_illustrations"].includes(data.outcome??""))outcome=data.outcome as LegalReviewRun["outcome"];}catch{}
  return {outcome,decisionNo:d.decision_no,recordedAt:d.recorded_at,sourceId:d.source_id??"",edition:src?.edition_title??"Neznámá edice",summary,downloadUrl:src?.download_url??null,sourceUrl:src?.source_url??"",approvalBlockers:approvalBlockers(src)};
 });
 const labels:Record<string,string>={approved:"Schváleno",deferred:"Odloženo",rejected:"Vyřazeno",needs_evidence:"K dořešení"};
 const history:LegalHistoryEntry[]=decisions.map(d=>({decisionNo:d.decision_no,recordedAt:d.recorded_at,automatic:isAutomaticScreen(d),label:isAutomaticScreen(d)?"Automatický check":labels[d.verdict]??"Rozhodnutí"}));
 return {checks,history};
}
