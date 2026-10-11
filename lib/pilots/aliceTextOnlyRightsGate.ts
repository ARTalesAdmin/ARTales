import {inspectRealAliceRights} from "./aliceRealRightsDesk";
import {composePg11Pilot,captureGutenbergBytes,getPg11FixtureRequest} from "../ingest/gutenbergSnapshot";
import {createHash} from "node:crypto";

/** Text-only editorial eligibility is NOT a publication authorization. */
export function assessAliceTextOnlyDraft(bytes:Uint8Array,checkedAt:string){
 const report=inspectRealAliceRights(bytes,checkedAt);
 const snapshot=captureGutenbergBytes(bytes,getPg11FixtureRequest(checkedAt));
 const pilot=composePg11Pilot(snapshot,false);
 if(!pilot.qa.ok||pilot.blocks.filter(b=>b.block.type==="chapter").length!==12||
  report.source.sha256!==snapshot.bytes_sha256)throw Error("Untrusted literary source");
 const work=report.componentInventory.find(c=>c.kind==="WORK_CONTENT");
 const excluded=report.componentInventory.filter(c=>c.kind!=="WORK_CONTENT");
 if(!work?.sha256||work.disposition!=="qa_text_only"||
   excluded.length!==5||excluded.some(c=>c.disposition!=="exclude"))
   throw Error("Unsafe inclusion boundary");
 const sourceText=Buffer.from(bytes).subarray(work.byteStart!,work.byteEnd!).toString("utf8");
 if(/\[(?:Illustration|Image|Translation|Translator)\s*:/i.test(sourceText))
   throw Error("Embedded later edition content must be separately reviewed");
 const textDigest=createHash("sha256").update(Buffer.from(bytes).subarray(work.byteStart!,work.byteEnd!)).digest("hex");
 if(textDigest!==work.sha256)throw Error("Literary component digest mismatch");
 return {
  schema:"artales.text-only-eligibility.v1" as const,
  decision:"eligible_for_editorial_draft" as const,
  author:"Lewis Carroll",author_death_year:1898,
  territorial_basis:"CZ/EU author-life-plus-70, original English only",
  edition_note:"Millennium Fulcrum edition-related claims excluded; no new translation or image included",
  checked_at:checkedAt,
  source_uri:report.source.uri,source_sha256:report.source.sha256,
  component_id:work.id,component_sha256:textDigest,
  included:[work.id],excluded:excluded.map(c=>({id:c.id,kind:c.kind,reason:"Excluded from text-only ingest; retained in source snapshot."})),
  chapter_count:12,
  publication_authorized:false as const,
  legal_specialist_required:false as const,
  release_review_required:true as const,
  scan_evidence_status:report.scan.outcome,
 };
}
