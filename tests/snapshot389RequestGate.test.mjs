import test from "node:test";
import assert from "node:assert/strict";
import * as gate from "../lib/ingest/server/snapshot389RequestGate.ts";
const {validateSnapshot389Form}=gate.default??gate;
const candidate="98508359-bce1-4e73-b842-b69a9d1112d0";
const body=`candidate_id=${encodeURIComponent(candidate)}&confirm_private_original_with_cover=archive_only_not_publication`;
function request(text=body,origin="https://artales.net",headers={}){
  const bytes=Buffer.from(text);
  return new Request("https://artales.net/api/member/snapshot/389",{
    method:"POST",body:text,headers:{
      "origin":origin,"sec-fetch-site":"same-origin",
      "content-type":"application/x-www-form-urlencoded",
      "content-length":String(bytes.length),...headers
    }
  });
}
test("allows exactly one admin confirmation of private retention",async()=>{
 await validateSnapshot389Form(request());
});
test("rejects cross-origin, referer spoof and cross-site fetch",async()=>{
 await assert.rejects(()=>validateSnapshot389Form(request(body,"https://evil.example")),/invalid_request_origin/);
 await assert.rejects(()=>validateSnapshot389Form(request(body,"https://artales.net",{"sec-fetch-site":"cross-site"})),/invalid_request_origin/);
});
test("rejects wrong candidate, ambiguous duplicates and missing explicit image retention",async()=>{
 for(const changed of [
 body.replace(candidate,"00000000-0000-4000-8000-000000000002"),
 body+"&candidate_id="+candidate,
 body.replace("archive_only_not_publication","yes"),
 "candidate_id="+candidate
 ])await assert.rejects(()=>validateSnapshot389Form(request(changed)),/explicit_confirmation_required/);
});
test("refuses missing, mismatched and oversized body lengths",async()=>{
 await assert.rejects(()=>validateSnapshot389Form(request(body,"https://artales.net",{"content-length":"9999"})),/invalid_request_body/);
 await assert.rejects(()=>validateSnapshot389Form(request(body,"https://artales.net",{"content-length":"3"})),/invalid_request_body/);
 await assert.rejects(()=>validateSnapshot389Form(request(body,"https://artales.net",{"content-length":""})),/invalid_request_body/);
});
