import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {GOLDEN,createGoldenEpub} from "./goldenBook";
import {parseGutenbergRdf} from "../../lib/legal/gutenbergRights";
import {inspectCompleteEpubText} from "../../lib/legal/epubInspection";
import {assessPublicDomain} from "../../lib/legal/publicDomainCheck";
import {planLockedSnapshot,inspectOperatorProvidedSource} from "../../lib/ingest/verifiedLegalSnapshotHandoff";
import {extractEpub} from "../../lib/ingest/epubSemanticExtractor";
import {composeSemanticRevision,verifySemanticRevision,walkSemanticAtoms,recomposeSemanticBatch} from "../../lib/semantic/compose";
import {classifyGutenbergApparatus,selectEditorialEdition} from "../../lib/semantic/editionProjection";
import {getSemanticPageUnits,projectSemanticReader,verifyReaderProjection} from "../../lib/semantic/readerProjection";
import type {GutenbergBook} from "../../lib/legal/gutenbergCatalog";

const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const book:GutenbergBook={
 id:GOLDEN.gutenbergId,title:GOLDEN.catalogTitle,authors:[{name:GOLDEN.authorCatalog,died:GOLDEN.authorDied}],
 translators:[],catalogUrl:GOLDEN.catalogUrl,languages:["en"],
 files:[{url:GOLDEN.epubUrl,label:"EPUB",format:"epub"}],
 readUrl:null,usCopyrightFlag:false
};
const rdf="<rdf:RDF xmlns:rdf='urn:rdf'><dcterms:rights>Public domain in the USA.</dcterms:rights>"+
 "<pgterms:agent rdf:about='authors/1'><pgterms:name>Twain, Mark</pgterms:name>"+
 "<pgterms:deathdate>1910</pgterms:deathdate></pgterms:agent></rdf:RDF>";
const rights={
 people:[{name:GOLDEN.authorCatalog,died:GOLDEN.authorDied}],
 contributors:[{name:GOLDEN.authorCatalog,died:GOLDEN.authorDied,role:"dcterms:creator"}],
 checked:true,url:GOLDEN.catalogUrl+".rdf",usStatus:"public_domain" as const
};
const packet={
 actor:{id:GOLDEN.actorId,role:"admin" as const,is_active:true},
 candidate:{id:GOLDEN.candidateId,proposed_title:GOLDEN.candidateTitle,proposed_author_name:GOLDEN.authorDisplay},
 source:{id:GOLDEN.sourceId,candidate_id:GOLDEN.candidateId,source_kind:"gutenberg",
   edition_title:GOLDEN.catalogTitle,source_url:GOLDEN.catalogUrl,download_url:GOLDEN.epubUrl,
   identity_match:"confirmed",language_match:"matches",text_format:"epub",language_code:"en"},
 approved:{decision_no:GOLDEN.decisionNo,candidate_id:GOLDEN.candidateId,source_id:GOLDEN.sourceId,
   verdict:"approved",territory:"CZ/EU",recorded_at:"2026-11-11T10:00:00.000Z",reviewed_by:GOLDEN.actorId},
 lock:{candidate_id:GOLDEN.candidateId,source_id:GOLDEN.sourceId,decision_no:GOLDEN.decisionNo,
   source_url:GOLDEN.catalogUrl,download_url:GOLDEN.epubUrl,locked_at:"2026-11-11T10:01:00.000Z",
   locked_by:GOLDEN.actorId,illustrations:[],
   source_facts:{kind:"gutenberg",edition:GOLDEN.catalogTitle,identityMatch:"confirmed",
    languageMatch:"matches",originalRights:"public_domain",sourceTerms:"cleared",
    translationRights:"not_applicable",translationStatus:"original",textFormat:"epub",language:"en"}
 }
};

test("GOLDEN source -> legal facts -> locked edition -> verified local binary -> semantic QA -> Reader",()=>{
 const raw=createGoldenEpub();
 const check=inspectCompleteEpubText(raw,GOLDEN.epubUrl);
 assert.equal(check.fullTextCheck?.scope,"complete");
 assert.equal(check.fullTextCheck?.status,"no_explicit_notice");
 assert.equal(check.fullTextEvidence?.spineDocuments,2);
 assert.equal(check.fullTextEvidence?.epubSha256,sha(raw));
 const assessment=assessPublicDomain({
  book,rights,prescreenDeath:GOLDEN.authorDied,candidateAuthor:GOLDEN.authorDisplay,
  originalPublicationYear:1876,textCheck:check.fullTextCheck!,epub:check,year:2026
 });
 assert.equal(assessment.outcome,"yes_without_illustrations");
 assert.equal(assessment.text.status,"public_domain");
 assert.equal(assessment.translation.status,"not_applicable");
 const planned=planLockedSnapshot(packet,book);
 assert.equal(planned.selection.catalog_url,GOLDEN.catalogUrl);
 assert.equal(planned.legal_decision_ref,"legal:"+GOLDEN.candidateId+":"+GOLDEN.decisionNo);
 assert.equal(planned.publication_authorized,false);
 const captured=inspectOperatorProvidedSource(planned,raw,GOLDEN.actorId,"2026-11-11T10:02:00.000Z");
 assert.equal(captured.captured.manifest.sha256,sha(raw));
 assert.equal(captured.archive_status,"not_persisted");
 assert.equal(captured.publication_authorized,false);
 // A local binary is NOT a production Snapshot receipt: real Storage and DB
 // boundaries are tested separately in the isolated PostgreSQL suite.
 const extracted=extractEpub(raw);
 assert.equal(extracted.epub_sha256,sha(raw));
 const revision=composeSemanticRevision({
  work_id:GOLDEN.candidateId,work_slug:"golden-test-never-publish",
  snapshot_ref:"sha256:"+sha(raw),source_bytes_sha256:extracted.text_sha256,
  component_id:extracted.component_id,original_byte_start:0,original_raw:extracted.text
 });
 verifySemanticRevision(revision,extracted.text);
 assert.equal(revision.release_allowed,false);
 const selection=selectEditorialEdition(extracted.text);
 const atoms=walkSemanticAtoms(revision.blocks);
 const apparatus=classifyGutenbergApparatus(extracted.text,atoms);
 assert(apparatus.automaticAtomIds.length>=1);
 const units=getSemanticPageUnits(revision,selection.range);
 assert(units.length>0);
 assert(!units.some(x=>x.source_atom_ids.some(id=>apparatus.automaticAtomIds.includes(id))));
 assert(units.some(x=>"atom" in x.node&&x.node.atom.raw.includes("imaginary hero")));
 const ambiguous=atoms.find(x=>x.raw.includes("NOTE."))!;
 assert(ambiguous);
 assert(!apparatus.automaticAtomIds.includes(ambiguous.id));
 const revised=recomposeSemanticBatch(revision,[{
  flagId:"qa-golden-editor-1",atomId:ambiguous.id,
  reason:"Human reviewer explicitly excluded the ambiguous edition note.",
  kind:"exclude_from_edition"
 }],extracted.text);
 verifySemanticRevision(revised,extracted.text);
 assert.equal(revised.source.normalized_text,revision.source.normalized_text);
 assert(revised.editorial_exclusions?.includes(ambiguous.id));
 assert(!getSemanticPageUnits(revised,selection.range).some(x=>x.source_atom_ids.includes(ambiguous.id)));
 const pages=projectSemanticReader(revised,{
  mode:"paged",viewport_width:440,viewport_height:700,font_scale:1,editionRange:selection.range
 });
 assert.equal(verifyReaderProjection(revised,pages,selection.range).ok,true);
 assert(pages.length>0);
 console.log("GOLDEN_TRACE "+JSON.stringify({
  schema:GOLDEN.schema,sourceSha256:sha(raw),documents:extracted.documents.length,
  textSha256:extracted.text_sha256,legalOutcome:assessment.outcome,
  lockedDecision:GOLDEN.decisionNo,automaticOmissions:apparatus.automaticAtomIds.length,
  manualExclusions:revised.editorial_exclusions?.length??0,pages:pages.length,
  sourceUnchanged:true,publicationAuthorized:false,databaseWrites:0
 }));
});

test("GOLDEN rejects wrong catalog, author, and stale approval without weakening the gate",()=>{
 assert.throws(()=>planLockedSnapshot(packet,{...book,title:"A Different Book"}));
 assert.throws(()=>planLockedSnapshot(packet,{...book,authors:[{name:"Unrelated Writer",died:1910}]}));
 assert.throws(()=>planLockedSnapshot({...packet,approved:{...packet.approved,recorded_at:"2026-11-11T10:05:00.000Z"}},book));
 assert.throws(()=>planLockedSnapshot({...packet,source:{...packet.source,download_url:GOLDEN.catalogUrl+".txt"}},book));
});
