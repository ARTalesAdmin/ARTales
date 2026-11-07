import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {assessEditorialRelease,type ReleaseReadinessInput} from "../lib/editorial/releaseReadiness";
const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const latest="a".repeat(64), earlier="b".repeat(64);
const base=():ReleaseReadinessInput=>({
 latestSha:latest,revisionStatus:"draft",imageSelection:"none",
 legalApproved:true,snapshotConfirmed:true,sourceAuthorized:true,published:false,
 tasks:[
  {kind:"text_review",status:"superseded",revision_sha256:earlier},
  {kind:"text_review",status:"completed",revision_sha256:latest},
  ...["cover_art","work_description","collection_curation","author_bio","author_visual"]
   .map(kind=>({kind,status:"completed",revision_sha256:earlier}))
 ],
 openFindings:0,unacceptedChanges:0,pendingAi:false,
 metadata:{authorId:"id",collectionId:"id",descriptionCs:"a".repeat(250),
  descriptionEn:"b".repeat(250),coverPath:"works/cover.webp",coverAlt:"Complete cover alt"},
 author:{bioCs:"a".repeat(250),bioEn:"b".repeat(250),
  portraitPath:"authors/portrait.webp",portraitAlt:"Complete portrait alt"},
 collection:{descriptionCs:"a".repeat(250),descriptionEn:"b".repeat(250)}
});
test("layout revision does not invalidate finished work-scoped metadata",()=>{
 assert.deepEqual(assessEditorialRelease(base()),{ready:true,blockers:[]});
});
test("latest revision QA must be completed after each new revision",()=>{
 const x=base();x.latestSha="c".repeat(64);
 assert.equal(assessEditorialRelease(x).ready,false);
 assert.match(assessEditorialRelease(x).blockers.join(" "),/aktuální textová revize/i);
});
test("open cover, unapproved source, AI or missing bilingual text block release",()=>{
 const x=base();
 x.tasks.find(t=>t.kind==="cover_art")!.status="open";
 x.sourceAuthorized=false;x.pendingAi=true;x.metadata!.descriptionCs="Too short";
 const blockers=assessEditorialRelease(x).blockers.join("\n");
 assert.match(blockers,/Obálka/);assert.match(blockers,/Archivní zdroj neodpovídá/);
 assert.match(blockers,/AI/);assert.match(blockers,/anglická anotace/);
});
test("release is explicitly admin-approved, uses latest source and the real bilingual assets",()=>{
 const sql=file("supabase/migrations/20261107104000_artales_release_verified_snapshot_gate.sql");
 const action=file("app/member/editorial-pipeline/actions.ts");
 const page=file("app/member/editorial-detail/[candidateId]/page.tsx");
 const candidate=file("app/member/candidates/[id]/page.tsx");
 const pipeline=file("app/member/editorial-pipeline/page.tsx");
 assert.match(sql,/p\.role::text='admin'/);
 assert.match(sql,/v_rev\.revision_sha256<>p_revision_sha256/);
 assert.match(sql,/t\.kind='text_review'/);
 assert.match(sql,/t\.revision_sha256=p_revision_sha256/);
 assert.match(sql,/t\.kind=v_task_kind/);
 assert.doesNotMatch(sql,/t\.revision_sha256=p_revision_sha256[\s\S]{0,100}t\.kind=v_task_kind/);
 assert.match(sql,/v_snapshot\.readback_status IS DISTINCT FROM 'sha256_verified'/);
 assert.match(sql,/candidate_snapshot_claims/);
 assert.match(sql,/storage\.objects archived/);
 assert.match(sql,/legal_lock\.source_url=v_snapshot\.catalog_url/);
 assert.doesNotMatch(sql,/v_snapshot\.publication_authorized IS DISTINCT FROM true/);
 assert.doesNotMatch(sql,/v_snapshot\.semantic_ready IS DISTINCT FROM true/);
 assert.match(sql,/INSERT INTO public\.works/);
 assert.match(sql,/INSERT INTO public\.artales_semantic_publications/);
 assert.match(sql,/v_meta\.cover_image_path/);
 assert.match(sql,/v_meta\.work_description_cs/);
 assert.match(sql,/v_meta\.work_description_en/);
 assert.match(action,/requireAdmin\(\)/);
 assert.match(action,/work_description_en/);
 assert.match(page,/id="publication-readiness"/);
 assert.match(page,/sourceAuthorized/);
 assert.doesNotMatch(page,/snapshotRes\.data\?\.publication_authorized/);
 assert.doesNotMatch(page,/snapshotRes\.data\?\.semantic_ready/);
 assert.match(page,/snapshotRes\.data\.readback_status==="sha256_verified"/);
 assert.match(candidate,/Otevřít redakční kartu a stav vydání/);
 assert.match(pipeline,/id="rozpracovana-dila"/);
});
test("member work card remains readable after own tasks complete",()=>{
 const page=file("app/member/editorial-detail/[candidateId]/page.tsx");
 assert.match(page,/!tasks\.some\(t=>t\.assigned_to===me\.id\)/);
 assert.doesNotMatch(page,/!tasks\.some\(t=>t\.assigned_to===me\.id&&/);
});
