import {test} from "node:test";import {strict as assert} from "node:assert";
import {parseSnapshotReview} from "../lib/ingest/snapshotReview";
const id="98508359-bce1-4e73-b842-b69a9d1112d0",sha="a".repeat(64);
const form=new URLSearchParams({candidate_id:id,snapshot_sha256:sha,text_correspondence:"confirmed",
 image_disposition:"exclude_all",evidence_note:"Compared the exact locked edition with archived source, verified title, publisher, text and all relevant discrepancy records."});
test("valid review bound to immutable receipt",()=>assert.equal(parseSnapshotReview(form,id,sha).snapshot_sha256,sha));
test("rejects wrong SHA and too-short evidence",()=>{
 assert.throws(()=>parseSnapshotReview(form,id,"b".repeat(64)));
 const short=new URLSearchParams(form);short.set("evidence_note","ok");
 assert.throws(()=>parseSnapshotReview(short,id,sha));
});
