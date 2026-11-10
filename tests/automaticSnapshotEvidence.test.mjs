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

function anthologyExample(){
 const d=example(),id=540,url="https://www.gutenberg.org/ebooks/540";
 const editor={name:"Lang, Andrew",died:1912,role:"editor",source:url+".rdf"};
 d.candidate={proposed_title:"The Red Fairy Book",proposed_author_name:"Andrew Lang"};
 d.lock={...d.lock,source_url:url,download_url:url+".epub.noimages"};
 d.source={...d.source,edition_title:"The Red Fairy Book",source_url:url,
  download_url:url+".epub.noimages",author_died:null,
  notes:JSON.stringify({schema:"artales.public-domain-check.v1",gutenbergId:id,
   outcome:"yes_without_illustrations",
   text:{status:"public_domain",people:[editor]},
   translation:{status:"not_applicable"},illustrations:{status:"unknown"}})};
 d.receipt={...d.receipt,gutenberg_id:id,catalog_url:url,
  locked_file_url:url+".epub.noimages"};
 d.liveRdf={people:[],contributors:[{role:"marcrel:edt",name:"Lang, Andrew",died:1912}],
  checked:true,usStatus:"public_domain",url:url+".rdf"};
 return d;
}
test("editor-only historical anthology composes using previously cleared RDF editor evidence",()=>{
 const proof=verifyAutomaticEdition(anthologyExample());
 assert.equal(proof.authorDied,1912);
 assert.equal(proof.publicDomainFrom,1983);
 assert.equal(proof.textCreators[0].role,"editor");
 assert.equal(proof.rightsEvidenceSource,"live_gutenberg_rdf");
 assert.equal(proof.images,"exclude_all");
});
test("verified contributor death must be valid even if anthology candidate has no author death",()=>{
 const d=anthologyExample();const z=JSON.parse(d.source.notes);
 z.text.people[0].died=null;d.source.notes=JSON.stringify(z);
 assert.throws(()=>verifyAutomaticEdition(d),/text_creator_identity_role_or_death_unverified/);
});
test("unexpected creator role and mismatching editor RDF still fail closed",()=>{
 const a=anthologyExample();const z=JSON.parse(a.source.notes);
 z.text.people[0].role="illustrator";a.source.notes=JSON.stringify(z);
 assert.throws(()=>verifyAutomaticEdition(a),/text_creator_identity_role_or_death_unverified/);
 const b=anthologyExample();b.liveRdf.contributors[0].died=1950;
 assert.throws(()=>verifyAutomaticEdition(b),/live_rdf_contradicts_locked_legal_evidence/);
});
test("multiple original writers must all have expired terms and match live RDF",()=>{
 const d=anthologyExample(),url=d.receipt.catalog_url+".rdf";
 d.candidate.proposed_author_name="Various Authors";d.source.author_died=null;
 const people=[
  {name:"Writer, Alice",died:1899,role:"autor",source:url},
  {name:"Writer, Bob",died:1901,role:"autor",source:url}
 ];
 const evidence=JSON.parse(d.source.notes);
 evidence.text.people=people;d.source.notes=JSON.stringify(evidence);
 d.liveRdf={...d.liveRdf,people:people.map(p=>({name:p.name,died:p.died})),
  contributors:people.map(p=>({role:"dcterms:creator",name:p.name,died:p.died}))};
 const result=verifyAutomaticEdition(d);
 assert.equal(result.textCreators.length,2);assert.equal(result.publicDomainFrom,1972);
 const missing={...d,liveRdf:{...d.liveRdf,contributors:d.liveRdf.contributors.slice(0,1),people:[]}};
 assert.throws(()=>verifyAutomaticEdition(missing),/live_rdf_contradicts_locked_legal_evidence/);
 const protectedWriter=JSON.parse(d.source.notes);protectedWriter.text.people[1].died=1980;
 d.source.notes=JSON.stringify(protectedWriter);
 assert.throws(()=>verifyAutomaticEdition(d),/text_creator_identity_role_or_death_unverified/);
});
test("original single author with legacy missing role remains supported",()=>{
 const proof=verifyAutomaticEdition(example());
 assert.equal(proof.textCreators[0].role,"author");
});

test("Carmilla: a shortened public byline matches uniquely approved full Gutenberg name",()=>{
 const d=example(),gutenbergId=10007;
 const catalog="https://www.gutenberg.org/ebooks/"+gutenbergId;
 d.candidate={proposed_title:"Carmilla",proposed_author_name:"Sheridan Le Fanu"};
 d.lock={...d.lock,source_url:catalog,download_url:catalog+".epub.noimages"};
 d.source={...d.source,edition_title:"Carmilla",source_url:catalog,
  download_url:catalog+".epub.noimages",author_died:1873,
  notes:JSON.stringify({schema:"artales.public-domain-check.v1",
   gutenbergId,outcome:"yes_without_illustrations",
   text:{status:"public_domain",people:[
    {name:"Le Fanu, Joseph Sheridan",died:1873,role:"autor",source:catalog+".rdf"}
   ]},translation:{status:"not_applicable"},illustrations:{status:"unknown"},
   originalPublicationYear:1871})};
 d.receipt={...d.receipt,gutenberg_id:gutenbergId,catalog_url:catalog,
  locked_file_url:catalog+".epub.noimages"};
 d.liveRdf={...d.liveRdf,people:[{name:"Le Fanu, Joseph Sheridan",died:1873}],
  contributors:[{role:"dcterms:creator",name:"Le Fanu, Joseph Sheridan",died:1873}],
  url:catalog+".rdf"};
 const verified=verifyAutomaticEdition(d);
 assert.equal(verified.contributorNameMatch,"abbreviated_given_names");
 assert.equal(verified.authorDied,1873);
 assert.equal(verified.publicDomainFrom,1944);
 assert.equal(verified.images,"exclude_all");
 assert.match(formatAutomaticEditionAudit(verified),/abbreviated_given_names/);
 const wrong=structuredClone(d);
 wrong.candidate.proposed_author_name="Sheridan Smith";
 assert.throws(()=>verifyAutomaticEdition(wrong),/candidate_contributor_identity_unverified/);
 const ambiguous=structuredClone(d);
 const evidence=JSON.parse(ambiguous.source.notes);
 evidence.text.people.push({name:"Le Fanu, Patrick Sheridan",died:1881,
  role:"autor",source:catalog+".rdf"});
 ambiguous.source.notes=JSON.stringify(evidence);
 ambiguous.liveRdf.contributors.push({role:"dcterms:creator",
  name:"Le Fanu, Patrick Sheridan",died:1881});
 assert.throws(()=>verifyAutomaticEdition(ambiguous),
  /candidate_contributor_identity_ambiguous/);
});

function translatedExample(){
 const d=example(),id=2527,url="https://www.gutenberg.org/ebooks/2527";
 d.candidate={proposed_title:"The Sorrows of Young Werther",proposed_author_name:"Johann Wolfgang von Goethe"};
 d.lock={...d.lock,source_url:url,download_url:url+".epub.noimages"};
 d.source={...d.source,edition_title:d.candidate.proposed_title,source_url:url,
  download_url:url+".epub.noimages",author_died:1832,translator_died:1888,
  translation_status:"translated",translation_rights:"public_domain",
  translator:"Boylan, R. Dillon (Richard Dillon)",
  notes:JSON.stringify({schema:"artales.public-domain-check.v1",gutenbergId:id,
   outcome:"yes_without_illustrations",text:{status:"public_domain",people:[
    {name:"Goethe, Johann Wolfgang von",died:1832,role:"autor",source:url+".rdf"}
   ]},translation:{status:"public_domain",people:[
    {name:"Boylan, R. Dillon (Richard Dillon)",died:1888,role:"překladatel",source:url+".rdf"}
   ]},illustrations:{status:"unknown"}})};
 d.receipt={...d.receipt,gutenberg_id:id,catalog_url:url,locked_file_url:url+".epub.noimages"};
 d.textCheck={...d.textCheck,translationCredit:true};
 d.liveRdf={checked:true,usStatus:"public_domain",url:url+".rdf",
  people:[{name:"Goethe, Johann Wolfgang von",died:1832}],
  contributors:[
   {role:"dcterms:creator",name:"Goethe, Johann Wolfgang von",died:1832},
   {role:"marcrel:trl",name:"Boylan, R. Dillon (Richard Dillon)",died:1888}
  ]};
 return d;
}
test("a separately cleared public-domain translation can be composed without images",()=>{
 const result=verifyAutomaticEdition(translatedExample());
 assert.equal(result.translation,"public_domain_translation");
 assert.equal(result.translators.length,1);
 assert.equal(result.publicDomainFrom,1959);
 assert.equal(result.images,"exclude_all");
 assert.equal(result.publicationAuthorized,false);
});
for(const [name,mutation] of [
 ["unknown translator death",d=>{const n=JSON.parse(d.source.notes);n.translation.people[0].died=null;d.source.notes=JSON.stringify(n);}],
 ["newer protected translator",d=>{const n=JSON.parse(d.source.notes);n.translation.people[0].died=1985;d.source.notes=JSON.stringify(n);}],
 ["RDF translator conflict",d=>{d.liveRdf.contributors[1].died=1900;}],
 ["RDF translator missing",d=>{d.liveRdf.contributors.pop();}],
 ["recorded translator name conflict",d=>{d.source.translator="A different translator";}],
 ["recorded translator death conflict",d=>{d.source.translator_died=1900;}],
 ["missing locked translation people",d=>{const n=JSON.parse(d.source.notes);delete n.translation.people;d.source.notes=JSON.stringify(n);}],
 ["unapproved translator rights",d=>{d.source.translation_rights="unknown";}],
 ["partial original scan",d=>{d.textCheck.scope="partial";}],
 ["unknown source scan",d=>{d.textCheck.status="not_checked";}],
 ["modern rights notice",d=>{d.textCheck.notice="copyright 2024";}]
]){
 test("translation fails closed: "+name,()=>{
  const d=translatedExample();mutation(d);
  assert.throws(()=>verifyAutomaticEdition(d),AutomaticEditionHold);
 });
}
test("an unexpected credited translator blocks an approved original",()=>{
 const d=example();d.liveRdf.contributors.push({
  role:"marcrel:trl",name:"Unapproved Translator",died:1900
 });
 assert.throws(()=>verifyAutomaticEdition(d),/live_rdf_translation_requires_separate_clearance/);
});
