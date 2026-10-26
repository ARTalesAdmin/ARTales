import test from "node:test";
import assert from "node:assert/strict";
import {legalOverviewStage,legalOverviewMatches,legalOverviewPresentation} from "../lib/legal/overviewStatus";
test("untested and automatic audits remain in needs-attention",()=>{
 assert.equal(legalOverviewStage(false,null),"not_checked");
 assert.equal(legalOverviewStage(false,{verdict:"needs_evidence"}),"in_review");
 assert.equal(legalOverviewMatches("not_checked","pending"),true);
 assert.equal(legalOverviewMatches("in_review","pending"),true);
});
test("approved but not yet locked is verified",()=>{
 assert.equal(legalOverviewStage(false,{verdict:"approved"}),"verified");
 assert.equal(legalOverviewMatches("verified","verified"),true);
 assert.equal(legalOverviewMatches("verified","processed"),false);
});
test("locked or rejected are both processed but clearly distinct",()=>{
 assert.equal(legalOverviewStage(true,{verdict:"approved"}),"locked");
 assert.equal(legalOverviewStage(false,{verdict:"rejected"}),"rejected");
 assert.equal(legalOverviewMatches("locked","processed"),true);
 assert.equal(legalOverviewMatches("rejected","processed"),true);
 assert.notEqual(legalOverviewPresentation.locked.label,legalOverviewPresentation.rejected.label);
});
