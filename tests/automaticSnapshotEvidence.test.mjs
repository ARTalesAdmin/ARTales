import test from "node:test";
import assert from "node:assert/strict";
import * as moduleRef from "../lib/ingest/automaticSnapshotEvidence.ts";
const {verifyAutomaticEdition,formatAutomaticEditionAudit,AutomaticEditionHold}=moduleRef.default??moduleRef;
const sha="a".repeat(64),textSha="b".repeat(64),id=389,book="The Great God Pan",author="Arthur Machen";
const url="https://www.gutenberg.org/ebooks/389";
function example(){
 return{
  candidate:{proposed_title:book,proposed_author_name:author},
  lock:{source_id:"src",decision_no:9,source_url:url,download_url:url+".epub.noimages",source_facts:{}},
  source:{id:"src",source_kind:"gutenberg",edition_title:book,source_url:url,download_url:url+".epub.noimages",
    author_died:1947,translation_status:"original",translator:"",translation_rights:"not_applicable",
    original_rights:"public_domain",illustration_use:"excluded",source_terms:"cleared",
    language_code:"en",identity_match:"confirmed",language_match:"matches",
    notes:JSON.stringify({schema:"artales.public-domain-check.v1",gutenbergId:389,
     outcome:"yes_without_illustrations",text:{status:"public_domain",people:[{name:"Machen, Arthur",died:1947,source:url+".rdf"}]},
     translation:{status:"not_applicable"},illustrations:{status:"unknown"}})},
  decision:{source_id:"src",decision_no:9,verdict:"approved",territory:"CZ/EU"},
  receipt:{source_id:"src",decision_no:9,gutenberg_id:id,catalog_url:url,locked_file_url:url+".epub.noimages",
   sha256:sha,byte_count:125934,embedded_images:1,readback_status:"sha256_verified"},
  archivedSha256:sha,archivedBytes:125934,mirrorSha256:sha,mirrorBytes:125934,
  spineDocuments:9,textCharacters:137553,sourceTextSha256:textSha,imageCount:1,
  textCheck:{status:"no_explicit_notice",scope:"complete",translationCredit:false,notice:null},
  liveRdf:{people:[{name:"Machen, Arthur",died:1947}],contributors:[],checked:true,usStatus:"public_domain",url:url+".rdf"},
  verifiedAt:"2026-11-02T19:00:00.000Z",year:2026
 };
}
test("valid original and independently identical EPUB advances text only",()=>{
 const proof=verifyAutomaticEdition(example());
 assert.equal(proof.publicDomainFrom,2018);
 assert.equal(proof.images,"exclude_all");assert.equal(proof.privateImages,1);
 assert.equal(proof.rightsEvidenceSource,"live_gutenberg_rdf");
 assert.equal(proof.publicationAuthorized,false);
 assert(formatAutomaticEditionAudit(proof).length>=80);
});
test("historical approved RDF evidence remains distinguishable if live endpoint unavailable",()=>{
 const d=example();d.liveRdf.checked=false;d.liveRdf.people=[];
 assert.equal(verifyAutomaticEdition(d).rightsEvidenceSource,"approved_locked_gutenberg_rdf_evidence");
});
for(const [name,change] of [
 ["mirror differs",d=>{d.mirrorSha256="c".repeat(64);}],
 ["archive differs",d=>{d.archivedSha256="c".repeat(64);}],
 ["author death conflicts",d=>{d.source.author_died=1950;}],
 ["not yet public domain",d=>{d.source.author_died=1970;const z=JSON.parse(d.source.notes);z.text.people[0].died=1970;d.source.notes=JSON.stringify(z);}],
 ["translation discovered",d=>{d.textCheck.translationCredit=true;}],
 ["restriction discovered",d=>{d.textCheck.status="possible_restriction";}],
 ["image mismatch",d=>{d.imageCount=2;}],
 ["unknown translation",d=>{d.source.translation_status="unknown";}],
 ["unapproved legal source",d=>{d.decision.verdict="needs_evidence";}],
 ["unmatched title",d=>{d.candidate.proposed_title="Another story";}],
 ["new RDF death disagrees",d=>{d.liveRdf.people[0].died=1950;}],
 ["missing historical rights evidence",d=>{d.source.notes="{}";}]
]){
 test("fail closed: "+name,()=>{
  const d=example();change(d);assert.throws(()=>verifyAutomaticEdition(d),AutomaticEditionHold);
 });
}
