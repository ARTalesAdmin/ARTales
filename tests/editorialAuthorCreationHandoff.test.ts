import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {candidateIdFromAuthorReturnTo,safeAuthorReturnTo,newAuthorMatchesCandidateName}
 from "../lib/editorial/candidateAuthorCreation";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const candidate="823aef5f-e134-4efb-949e-bf11683deaae";

test("candidate author creation context accepts only exact work-card routes",()=>{
 assert.equal(candidateIdFromAuthorReturnTo("/member/editorial-detail/"+candidate),candidate);
 assert.equal(candidateIdFromAuthorReturnTo("/member/editorial-detail/"+candidate+"#author"),candidate);
 for(const path of ["//evil.example","/member/editorial-detail/invalid",
 "/member/editorial-detail/"+candidate+"?other=x",
 "/member/editorial-detail/"+candidate+"/../other","https://evil.example"])
  assert.equal(candidateIdFromAuthorReturnTo(path),null);
 assert.equal(safeAuthorReturnTo("//evil.example"),null);
 assert.equal(safeAuthorReturnTo("/\\evil.example"),null);
 assert.equal(newAuthorMatchesCandidateName("Johann Wolfgang von Goethe"," johann wolfgang von goethe "),true);
 assert.equal(newAuthorMatchesCandidateName("Johann Wolfgang von Goethe","Somebody Goethe"),false);
});
test("author creation checks actor, identity, and canonical candidate link with readback",()=>{
 const src=read("lib/actions/authors.ts");
 assert.match(src,/\.eq\("assigned_to",profile.id\)/);
 assert.match(src,/\.eq\("status","claimed"\)\.in\("kind",\["author_bio","author_visual"\]\)/);
 assert.match(src,/matchesExistingAuthor/);
 assert.match(src,/if\(matching.length>1\)/);
 assert.match(src,/\.insert\(payload\)/);
 assert.match(src,/p_candidate_id:candidateId,p_field:"author",p_value:authorId/);
 assert.match(src,/linkedId!==authorId/);
 assert.match(src,/createdAuthorId=/);
 assert.doesNotMatch(src,/\.from\("artales_candidate_editorial_metadata"\)\s*\.update\(/);
});
test("candidate author remains private and cannot bypass bio/portrait evidence",()=>{
 const src=read("lib/actions/authors.ts");
 assert.match(src,/values\.is_public_visible=false/);
 assert.match(src,/const readyKinds=reusedExisting\?\[\]:readyAuthorTaskKinds\(values\)/);
 assert.match(src,/artales_complete_editorial_task/);
 assert.match(read("app/member/authors/new/page.tsx"),/required=\{!candidateId\}/);
});
