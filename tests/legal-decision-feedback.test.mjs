import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=(p:string)=>readFileSync(p,"utf8");

test("illustration approval cannot fail silently",()=>{
 const ui=file("components/legal/LegalReviewActions.tsx");
 assert.match(ui,/const imageConflict=/);
 assert.match(ui,/disabled:!LEGAL_IMAGE_APPROVAL_ENABLED/);
 assert.match(ui,/disabled=\{o.disabled\}/);
 assert.match(ui,/Archiv originálního EPUBu včetně obrázků zůstává soukromý/);
 assert.match(ui,/selected\.outcome!=="yes_with_illustrations"/);
 assert.match(ui,/Tlačítko je zablokované z uvedeného důvodu/);
 assert.match(ui,/role="alert"/);
 assert.match(ui,/missing_evidence/);
 assert.match(ui,/setSubmitError/);
 assert.doesNotMatch(ui,/window\.alert/);
});
test("legal decision preserves server verification and explicit follow-up",()=>{
 const route=file("app/member/legal/[id]/decision/route.ts");
 const page=file("app/member/candidates/[id]/legal/page.tsx");
 assert.match(route,/includeImages&&recordedOutcome!=="yes_with_illustrations"/);
 assert.match(route,/if\(includeImages&&!LEGAL_IMAGE_APPROVAL_ENABLED\)/);
 assert.match(route,/illustration_publication_not_supported/);
 assert.match(file("lib/legal/featureFlag.ts"),/LEGAL_IMAGE_APPROVAL_ENABLED = false/);
 assert.match(route,/missing_evidence/);
 assert.match(route,/cannot_save_decision/);
 assert.match(page,/Rozhodnutí bylo úspěšně uloženo do historie/);
 assert.match(page,/Právní kontrola dokončena · pokračuj ke Snapshotu/);
 assert.match(page,/lockScreening\.bind/);
 assert.match(page,/latest\?\.verdict==="approved"/);
});

test("refresh retains effective latest automatic check even when chosen state was empty",()=>{
 const ui=file("components/legal/LegalReviewActions.tsx");
 const helper=file("lib/legal/reviewHistory.ts");
 assert.match(helper,/export function selectLegalReviewRun/);
 assert.match(helper,/checks\.find\(c=>String\(c\.decisionNo\)===chosen\)\?\?checks\[0\]/);
 assert.match(ui,/const selected=selectLegalReviewRun\(checks,chosen\)/);
 assert.match(ui,/const effectiveChosen=String\(selected\?\.decisionNo\?\?""\)/);
 assert.match(ui,/value=\{effectiveChosen\}/);
 assert.match(ui,/form\.set\("decision_no",effectiveChosen\)/);
 assert.match(ui,/automatickému právnímu checku #\$\{effectiveChosen\}/);
});
