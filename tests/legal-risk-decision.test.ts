import test from "node:test";
import assert from "node:assert/strict";
import {assessGutenbergRisk} from "../lib/legal/riskDecision";
const url="https://www.gutenberg.org/ebooks/4242";
const source=()=>{
 const audit={schema:"artales.public-domain-check.v1",gutenbergId:4242,
  outcome:"no",text:{status:"unknown",people:[{name:"An Unknown Author",died:null}]},
  translation:{status:"not_applicable",people:[]},
  gutenbergUsStatus:"unknown",sourceTextStatus:"not_checked",
  sourceTextNotice:null,originalPublicationYear:null};
 return {source_kind:"gutenberg",source_url:url,download_url:url+".epub.noimages",
  identity_match:"confirmed",language_match:"matches",illustration_use:"excluded",
  original_rights:"unknown",translation_rights:"not_applicable",source_terms:"unknown",
  notes:JSON.stringify(audit)};
};
test("missing death and publication year are uncertainty, not an explicit prohibition",()=>{
 const r=assessGutenbergRisk(source(),2026);
 assert.equal(r.eligible,true);
 assert.equal(r.blocking.length,0);
 assert(r.uncertainties.some(s=>s.includes("Neznámé úmrtí")));
});
test("copyright restriction or protected creator cannot be accepted as uncertainty",()=>{
 for(const mutate of [
  (s:ReturnType<typeof source>)=>{s.original_rights="restricted";},
  (s:ReturnType<typeof source>)=>{s.source_terms="restricted";},
  (s:ReturnType<typeof source>)=>{let a=JSON.parse(s.notes);a.text.status="protected";a.text.people[0].died=2000;s.notes=JSON.stringify(a);},
  (s:ReturnType<typeof source>)=>{let a=JSON.parse(s.notes);a.gutenbergUsStatus="restricted";s.notes=JSON.stringify(a);},
  (s:ReturnType<typeof source>)=>{let a=JSON.parse(s.notes);a.sourceTextNotice="Used by permission only";s.notes=JSON.stringify(a);},
 ]){
  const s=source();mutate(s);const r=assessGutenbergRisk(s,2026);
  assert.equal(r.eligible,false);assert(r.blocking.length>0);
 }
});
test("file identity and text-only exclusion remain mandatory",()=>{
 const a=source();a.download_url="https://evil.example/sample.epub";
 assert.equal(assessGutenbergRisk(a).eligible,false);
 const b=source();b.illustration_use="public_domain";
 assert.equal(assessGutenbergRisk(b).eligible,false);
});
test("risk consent route remains permission-bound and linked to immutable DB acceptance",async()=>{
 const {readFileSync}=await import("node:fs");
 const route=readFileSync("app/member/candidates/[id]/legal/accept-risk/route.ts","utf8");
 const sql=readFileSync("supabase/migrations/20261110113500_artales_gutenberg_risk_acceptance.sql","utf8");
 assert.match(route,/canProgressCandidate/);
 assert.match(route,/input\.confirm!==true/);
 assert.match(route,/candidate_legal_risk_acceptances/);
 assert.match(route,/ARTALES_RISK_ACCEPTED_V1/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/accepted_by=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/FOR INSERT TO authenticated/);
 assert.doesNotMatch(sql,/GRANT UPDATE|GRANT DELETE/);
 assert.match(sql,/risk_consent/);
 assert.match(sql,/s\.source_terms='restricted'/);
});
