import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {uniqueExistingAuthor,matchesExistingAuthor} from "../lib/editorial/existingAuthorMatch";

const authors=[
 {id:"1",name:"Joseph Sheridan Le Fanu",name_en:"Joseph Sheridan Le Fanu"},
 {id:"2",name:"Arthur Machen",name_en:null},
 {id:"3",name:"Andrew Lang",name_en:"Andrew Lang"}
];

test("Carmilla: link the existing full author, never create a second profile",()=>{
 assert.equal(uniqueExistingAuthor("Sheridan Le Fanu",authors)?.id,"1");
 assert.equal(uniqueExistingAuthor("Arthur Machen",authors)?.id,"2");
 assert.equal(matchesExistingAuthor("Le Fanu","Joseph Sheridan Le Fanu"),false);
 assert.equal(uniqueExistingAuthor("Unknown Editor",authors),null);
});
test("ambiguous bylines must not auto-link",()=>{
 const expanded=[...authors,{id:"4",name:"Thomas Sheridan Le Fanu",name_en:null}];
 assert.equal(uniqueExistingAuthor("Sheridan Le Fanu",expanded),null);
});
test("the assigned task opens through claim-first server action",()=>{
 const action=readFileSync("app/member/editorial-pipeline/actions.ts","utf8");
 const page=readFileSync("app/member/editorial-pipeline/page.tsx","utf8");
 assert.match(action,/export async function openAssignedEditorialTask/);
 assert.match(action,/artales_claim_editorial_task/);
 assert.match(action,/artales_save_candidate_editorial_field/);
 assert.match(action,/uniqueExistingAuthor/);
 assert.match(action,/artales_complete_editorial_task/);
 assert.match(page,/mode==="mine"\?<form action=\{openAssignedEditorialTask\}/);
});
test("canonical migration retains actor gate and only admits unique byline matches",()=>{
 const sql=readFileSync("supabase/migrations/20261110130000_artales_unique_existing_author_byline.sql","utf8");
 assert.match(sql,/artales_save_candidate_editorial_field/);
 assert.match(sql,/not_claimed/);
 assert.match(sql,/count\(\*\)/);
 assert.match(sql,/author_name_mismatch/);
 assert.doesNotMatch(sql,/UPDATE public\.authors/);
});

test("already-linked author can finish the claimed biography task without relinking",()=>{
 const action=readFileSync("app/member/editorial-pipeline/actions.ts","utf8");
 assert.match(action,/if\(candidate&&authorRows\)/);
 assert.match(action,/meta\.author_id===author\.id/);
 assert.match(action,/if\(!meta\?\.author_id\)/);
 assert.match(action,/task\.kind==="author_bio"/);
 assert.match(action,/if\(closeoutError\|\|completed\?\.result!=="completed"\)/);
 assert.match(action,/error=evidence_missing#author/);
});


test("already-linked valid author portrait can close its claimed visual task",()=>{
 const action=readFileSync("app/member/editorial-pipeline/actions.ts","utf8");
 assert.match(action,/portrait_image_path,portrait_image_alt/);
 assert.match(action,/verifiedPortrait=Boolean\(author\.portrait_image_path/);
 assert.match(action,/task\.kind==="author_visual"&&verifiedPortrait/);
 assert.match(action,/artales_complete_editorial_task/);
 assert.match(action,/if\(closeoutError\|\|completed\?\.result!=="completed"\)/);
});
