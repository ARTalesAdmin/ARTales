import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("editorial server actions disable repeat submit and explain pending work",()=>{
 const pending=read("components/editor/EditorialPendingButton.tsx");
 assert.match(pending,/useFormStatus/);
 assert.match(pending,/disabled={pending\|\|disabled}/);
 assert.match(pending,/role="status"/);
 for(const p of ["app/member/editorial-detail/[candidateId]/page.tsx",
 "app/member/authors/new/page.tsx","app/member/authors/[slug]/edit/page.tsx",
 "app/member/collections/new/page.tsx","app/member/collections/[slug]/edit/page.tsx",
 "components/editor/CandidateBilingualAnnotationFields.tsx"])
  assert.match(read(p),/EditorialPendingButton/);
});
test("normal editor uploads without redundant technical visual fields",()=>{
 const image=read("components/media/EditorialImageUploadField.tsx");
 const cover=read("components/editor/CandidateCoverInput.tsx");
 const card=read("app/member/editorial-detail/[candidateId]/page.tsx");
 assert.match(image,/showAdvanced\?<details/);
 assert.match(image,/type="hidden" name={altName}/);
 assert.match(image,/type="hidden" name={captionName}/);
 assert.match(image,/isUploading\?<p role="status"/);
 assert.match(cover,/showAdvanced\?<details/);
 assert.match(card,/showAdvanced={me.role==="admin"}/);
 assert.match(cover,/setVerifiedPath\(pathToSave\)/);
});
test("manual Werther exception and QA evidence guard remain unchanged",()=>{
 const actions=read("app/member/editorial-detail/[candidateId]/actions.ts");
 assert.match(actions,/artales_save_candidate_editorial_field/);
 const qa=read("components/editor/SemanticQaPanel.tsx");
 assert.match(qa,/confirmOmittedSemanticQaFlags/);
 const author=read("lib/actions/authors.ts");
 assert.match(author,/artales_complete_editorial_task/);
});
