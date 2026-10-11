import test from "node:test";
import assert from "node:assert/strict";
import {planLegacyReviews,type ReviewWork} from "../lib/editorial/planLegacyReviews";
const ready=(workId:string,title=workId):ReviewWork=>({workId,title,status:"published",sourcePinned:true,semanticRevisionReady:true,rights:"cleared",risk:"ordinary"});
const staff=[{userId:"admin",role:"admin" as const,active:true,capacity:2},{userId:"editor1",role:"editor" as const,active:true,capacity:2},{userId:"editor2",role:"editor" as const,active:true,capacity:2}];
test("pilot reviewed by admin, rest balanced across staff including admin",()=>{
 const r=planLegacyReviews([ready("pilot"),ready("A"),ready("B"),ready("C"),ready("D"),ready("E")],staff,"admin",["pilot"]);
 assert.equal(r.find(x=>x.workId==="pilot")?.assigneeUserId,"admin");
 const counts=new Map(staff.map(s=>[s.userId,r.filter(x=>x.assigneeUserId===s.userId).length]));
 assert.deepEqual([...counts.values()].sort(),[2,2,2]);
});
test("legal uncertainty, blocked rights, missing source or composition never enter review queue",()=>{
 const a=planLegacyReviews([
 {...ready("uncertain"),rights:"needs_review"}, {...ready("blocked"),rights:"blocked"},
 {...ready("missing"),sourcePinned:false},{...ready("uncomposed"),semanticRevisionReady:false}
 ],staff,"admin",[]);
 assert.deepEqual(new Set(a.map(x=>x.stage)),new Set(["legal_review","legal_block","source_recovery","semantic_composition"]));
 assert.ok(a.every(x=>x.assigneeUserId===null));
});
test("no capacity never creates assignment",()=>{
 const r=planLegacyReviews([ready("a")],staff.map(s=>({...s,capacity:0})),"admin",[]);
 assert.equal(r[0].assigneeUserId,null);
});
test("inactive or impersonated admin is rejected",()=>{
 assert.throws(()=>planLegacyReviews([ready("a")],staff,"absent",[]),/administrator/);
 assert.throws(()=>planLegacyReviews([ready("a")],staff.map(s=>s.userId==="admin"?{...s,active:false}:s),"admin",[]));
});
test("duplicate work or staff identifiers fail closed",()=>{
 assert.throws(()=>planLegacyReviews([ready("a"),ready("a")],staff,"admin",[]),/duplicate/);
 assert.throws(()=>planLegacyReviews([ready("a")],[...staff,staff[0]],"admin",[]),/duplicate/);
});
