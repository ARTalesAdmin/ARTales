import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as moduleRef from "../lib/ingest/candidateUuid.ts";
const {isCandidateUuid}=moduleRef.default??moduleRef;
const id389="98508359-bce1-4e73-b842-b69a9d1112d0";
test("real candidate #389 passes UUID validation used by auto-compose",()=>{
 assert.equal(isCandidateUuid(id389),true);
 assert.equal(isCandidateUuid(id389.toUpperCase()),true);
 const route=readFileSync(new URL("../app/api/member/snapshot/[candidateId]/auto-compose/route.ts",import.meta.url),"utf8");
 assert.match(route,/if\(!isCandidateUuid\(candidateId\)\)/);
});
test("malformed IDs are refused before any write or storage access",()=>{
 for(const v of [
  "98508359-bce1-4e73-b842b69a9d1112d0",
  "98508359-bce1-4e73-b842-b69a9d1112d0/extra",
  "98508359-bce1-4e73-b842-b69a9d1112d0%00",
  "98508359-bce1-4e73-b842-b69a9d1112d",
  "98508359-bce1-4e73-b842-b69a9d1112d0'",
  "not-an-id","",null,undefined,42,{}
 ])assert.equal(isCandidateUuid(v),false,String(v));
});
