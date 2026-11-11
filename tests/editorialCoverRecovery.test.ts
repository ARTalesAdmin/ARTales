import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const field=read("components/editor/CandidateCoverInput.tsx");
const actions=read("app/member/editorial-detail/[candidateId]/actions.ts");
const page=read("app/member/editorial-detail/[candidateId]/page.tsx");
test("uploaded cover survives save failure and is reusable without reupload",()=>{
 assert.match(field,/saveCandidateCover\\(\\{candidateId,path:pathToSave,alt,caption\\}\\)/);
 assert.match(field,/setMessage\(result.message\)/);
 assert.match(field,/if\(result.ok\)router.refresh\(\)/);
 assert.match(field,/listCandidateCoverUploads\(candidateId\)/);
 assert.match(field,/type="radio"/);
 assert.match(field,/onChange=\{\(\)=>\{setPath\(p\)/);
 assert.match(page,/canEditCover\?<div className="ed-card__form"/);
 assert.doesNotMatch(field,/type="submit"/);
});
test("server persists cover through existing identity-bound field RPC, then validates closeout",()=>{
 assert.match(actions,/export async function saveCandidateCover/);
 assert.match(actions,/artales_save_candidate_editorial_field/);
 assert.match(actions,/artales_complete_editorial_task/);
 assert.match(actions,/return \{ok:true,closed,message:closeoutFailed/);
 assert.match(actions,/if\(actor.role!=="admin"\)/);
 assert.match(actions,/\.eq\("assigned_to",actor.id\)\.eq\("status","claimed"\)/);
});

test("cover upload and candidate link are a single editor confirmation with durable recovery",()=>{
 assert.match(field,/const \[pendingFile,setPendingFile\]=useState<File\|null>\(null\)/);
 assert.match(field,/if\(pendingFile\)\{/);
 assert.match(field,/\.upload\(target,pendingFile/);
 assert.match(field,/setPath\(target\)/);
 assert.match(field,/setPendingFile\(null\)/);
 assert.match(field,/Nahrát a dokončit obálku/);
 assert.match(field,/setPendingFile\(null\);if\(input\.current\)input\.current\.value=""/);
});
