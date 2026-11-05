import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/member/editorial-pipeline/page.tsx");
const actions=read("app/member/editorial-pipeline/actions.ts");
const details=read("app/member/editorial-detail/[candidateId]/page.tsx");
test("role-scoped pool separates own assigned from eligible unowned work",()=>{
 assert.match(page,/const mine=active\.filter\(t=>t\.assigned_to===profile\.id\)/);
 assert.match(page,/t\.assigned_to===null/);
 assert.match(page,/eligible\.has\(t\.kind\)/);
 assert.match(page,/mode:"mine"\|"available"\|"admin"/);
 assert.match(page,/const others=isAdmin\?/);
});
test("pool and admin handoff are identity-bound and audited through RPCs",()=>{
 assert.match(actions,/artales_release_editorial_task/);
 assert.match(actions,/artales_reassign_editorial_task/);
 assert.match(actions,/requireAdmin\(\)/);
 assert.match(actions,/requireEditorOrAdmin\(\)/);
 assert.match(actions,/refreshEditorialQueue\(\)/);
 assert.match(page,/Přeřadit úkol/);
 assert.match(page,/Potřebuji úkol předat/);
});
test("work pool links to correct candidate details without replacing semantic QA",()=>{
 assert.match(page,/\/member\/editorial-detail\//);
 assert.match(page,/\/member\/semantic\//);
 assert.match(details,/id="collection"/);
 assert.match(details,/id="author"/);
 assert.match(details,/id="cover"/);
});
test("unshipped monthly-review RPC/UI and public reader are not part of pool release",()=>{
 assert.doesNotMatch(actions,/completeMethodologyReview/);
 assert.doesNotMatch(page,/artales_editorial_methodology_reviews/);
 assert.doesNotMatch(page,/artales_semantic_change_reviews/);
});
