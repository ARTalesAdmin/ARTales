import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {captureGutenbergBytes,getPg11FixtureRequest,extractPg11Components,composePg11Pilot} from "../ingest/gutenbergSnapshot";
import {evaluateRightsScan,type RightsScanDossier} from "../rightsScanDossier";
import {composeSemanticPg11,submitSemanticIssue,recomposeSemanticLayout,verifySemanticRevision,walkSemanticAtoms} from "../semantic/compose";
import {compareAliceThreeWays,syntheticLegacyFixture} from "../semantic/tripleQA";

const hash=(s:Uint8Array)=>createHash("sha256").update(s).digest("hex");
/** Local, deterministic, read-only pilot. No actual legal clearance or publication. */
export function proveAliceFlow(){
 const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
 const snapshot=captureGutenbergBytes(bytes,getPg11FixtureRequest());
 const components=extractPg11Components(snapshot);
 if(components.status!=="ready_for_fixture")throw Error("source component boundary refused");
 const pilot=composePg11Pilot(snapshot);
 const now="2026-10-11T12:00:00.000Z",later="2026-10-11T13:00:00.000Z";
 const dossier:RightsScanDossier={
  format:"artales-rights-dossier-v1",candidateId:"fixture:alice",sourceId:snapshot.snapshot_ref,
  editionId:"fixture:gitenberg-2016",snapshotSetId:snapshot.snapshot_ref,targetJurisdiction:"EU_CZ",
  policyVersion:"fixture-pending-v1",
  scanner:{engine:"deterministic-fixture",version:"1",ranAt:later},
  capture:{rawSourceSha256:snapshot.bytes_sha256,rawSourceByteLength:snapshot.bytes_length,
   rawSourceArchiveRef:"fixture://pg11-bytes",capturedAt:now,inventoryComplete:true,collectorVersion:"fixture-v1"},
  snapshots:components.content_components.filter(c=>c.original).map(c=>{
    const span=c.original!;
    return {id:c.id,kind:c.kind,sourceId:snapshot.snapshot_ref,editionId:"fixture:gitenberg-2016",
      sha256:hash(bytes.subarray(span.byte_start,span.byte_end)),byteLength:span.byte_end-span.byte_start,
      capturedAt:now,archiveRef:"fixture://component/"+c.id};
  }),
  evidence:[],
  decisions:components.content_components.filter(c=>c.original).map(c=>({
    componentId:c.id,action:c.kind==="WORK_CONTENT"?"include" as const:"exclude" as const,
    finding:"unknown" as const,confidence:"low" as const,evidenceIds:[],
    rationale:c.kind==="WORK_CONTENT"?"Pending independent Czech territorial legal verification.":
     "Nonliterary source component excluded pending specific edition review.",
    ...(c.kind!=="WORK_CONTENT"?{exclusionMethod:"omit_from_ingest" as const}:{})
  }))
 };
 const rights=evaluateRightsScan(dossier);
 if(rights.outcome==="candidate_draft_eligible"||rights.publicationAuthorized!==false)
  throw Error("Fixture-only automated legal decision must never clear release");
 const semantic=composeSemanticPg11(snapshot,{work_id:"fixture:alice",work_slug:"alices-adventures-in-wonderland"});
 verifySemanticRevision(semantic.revision,semantic.original_raw);
 const old=syntheticLegacyFixture(semantic.revision);
 const comparison=compareAliceThreeWays(semantic.revision,old);
 if(comparison.can_cutover!==false||comparison.legacy_status!=="synthetic_comparison")
  throw Error("Synthetic legacy comparison cannot be declared approved");
 const atom=walkSemanticAtoms(semantic.revision.blocks).find(a=>a.raw.includes("Alice was beginning"));
 if(!atom)throw Error("Missing anchored Alice paragraph");
 const issue=submitSemanticIssue(semantic.revision,{id:"fixture-review-1",target_atom_id:atom.id,
  kind:"typography",reason:"Reviewer requests a clear first-paragraph indentation.",
  requested_layout:"indent_small"});
 const revised=recomposeSemanticLayout(semantic.revision,issue,semantic.original_raw);
 verifySemanticRevision(revised,semantic.original_raw);
 if(revised.parent_revision_ref!==semantic.revision.revision_ref||
  revised.revision_ref===semantic.revision.revision_ref||revised.release_allowed!==false)
  throw Error("Revision ancestry or publication lock not preserved");
 return {
  schema:"artales.alice.vertical-proof.v1" as const, mode:"synthetic_read_only" as const,
  source_sha256:snapshot.bytes_sha256,source_bytes:snapshot.bytes_length,
  source_component_count:components.content_components.length,
  rights_outcome:rights.outcome,rights_issues:rights.issues.map(i=>i.code),
  source_composition_verified:true,semantic_schema:semantic.revision.schema,
  semantic_initial_revision:semantic.revision.revision_ref,semantic_corrected_revision:revised.revision_ref,
  revision_parent:revised.parent_revision_ref,review_issues:revised.review_issues.length,
  legacy_comparison:comparison.legacy_status,
  release_allowed:false as const,actual_legacy_reconciliation:false as const,
  database_writes:0 as const,live_editions_changed:0 as const,
  missing_gates:["verified_rights_evidence","actual_legacy_snapshot","real_work_uuid",
   "signed_persistent_revision","independent_editor_review","publication_gate"] as const,
 };
}
