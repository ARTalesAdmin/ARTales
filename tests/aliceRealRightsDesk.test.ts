import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectRealAliceRights} from "../lib/pilots/aliceRealRightsDesk";
const source=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
test("actual pinned Alice source builds auditable byte inventory and legal HOLD",()=>{
 const result=inspectRealAliceRights(source);
 assert.equal(result.source.bytes,173595);
 assert.equal(result.source.sha256,"49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094");
 assert.equal(result.componentInventory.length,6);
 assert.equal(result.componentInventory.filter(c=>c.kind==="WORK_CONTENT").length,1);
 assert.equal(result.componentInventory.filter(c=>c.kind==="SOURCE_WRAPPER").length,2);
 assert.equal(result.componentInventory.filter(c=>c.kind==="EDITION_CONTENT").length,2);
 assert.equal(result.componentInventory.find(c=>c.kind==="ASSET")?.byteStart,null);
 assert.equal(result.scan.outcome,"needs_specialist_review");
 assert.equal(result.scan.publicationAuthorized,false);
 assert.deepEqual(result.scan.includedSnapshotIds,[]);
 assert.ok(result.scan.issues.some(i=>i.code==="review_requested"&&i.componentId==="pg11:work-text"));
 assert.equal(result.legalFinding.termEndedAfterYear,1968);
 assert.equal(result.dossier.capture.inventoryComplete,true);
});
test("source tampering cannot produce a rights report",()=>{
 const changed=Buffer.from(source);
 changed[100]^=1;
 assert.throws(()=>inspectRealAliceRights(changed),/SHA-256/);
});
