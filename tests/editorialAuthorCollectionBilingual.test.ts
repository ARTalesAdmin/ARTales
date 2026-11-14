import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateAuthorFormValues,getDefaultAuthorFormValues} from "../lib/forms/authorForm";
import {validateCollectionFormValues,getDefaultCollectionFormValues} from "../lib/forms/collectionForm";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
import {readyAuthorTaskKinds} from "../lib/editorial/authorTaskEvidence";
const authorAction=read("lib/actions/authors.ts");
const collectionAction=read("lib/actions/collections.ts");
const authorNew=read("app/member/authors/new/page.tsx");
const collectionNew=read("app/member/collections/new/page.tsx");
const candidate=read("app/member/editorial-detail/[candidateId]/page.tsx");
const gate=read("ops/sql/20261105_artales_author_collection_bilingual_evidence.sql");

test("new authors need independent bounded Czech and English biographies",()=>{
 const values=getDefaultAuthorFormValues();
 values.name_en="An author";values.slug="an-author";
 values.bio_cs="X".repeat(200);values.bio_en="Y".repeat(200);
 assert.equal(validateAuthorFormValues(values,true),null);
 values.bio_en="Y".repeat(199);
 assert.equal(validateAuthorFormValues(values,true),"bilingual_description_required");
 values.bio_en="Y".repeat(801);
 assert.equal(validateAuthorFormValues(values,true),"bilingual_description_required");
 // Existing authors remain editable without retroactive invalidation.
 assert.equal(validateAuthorFormValues(values),null);
 assert.match(authorAction,/validateAuthorFormValues\(values,!candidateId\)/);
 assert.match(authorNew,/BilingualProfileText/);
 assert.match(authorNew,/required=\{!candidateId\}/);
});
test("new collections need independent bounded localized descriptions",()=>{
 const values=getDefaultCollectionFormValues();
 values.title_cs="Poe";values.slug="poe";
 values.description_cs="A".repeat(200);values.description_en="B".repeat(800);
 assert.equal(validateCollectionFormValues(values,true),null);
 values.description_cs="";
 assert.equal(validateCollectionFormValues(values,true),"bilingual_description_required");
 values.description_cs="A".repeat(200);values.description_en="B".repeat(801);
 assert.equal(validateCollectionFormValues(values,true),"bilingual_description_required");
 assert.equal(validateCollectionFormValues(values),null);
 assert.match(collectionAction,/validateCollectionFormValues\(values,true\)/);
 assert.match(collectionNew,/required=\{true\}/);
});
test("candidate tasks require stored CS/EN evidence, never one fallback",()=>{
 assert.match(gate,/c\.description_cs/);
 assert.match(gate,/c\.description_en/);
 assert.match(gate,/a\.bio_cs/);
 assert.match(gate,/a\.bio_en/);
 assert.match(gate,/BETWEEN 200 AND 800/);
 assert.match(candidate,/readyAuthorTaskKinds\(author\?\?\{\}\)/);
 assert.doesNotMatch(gate,/UPDATE public\.authors|UPDATE public\.collections/);
});
test("new collection roundtrips to exact candidate editor without requiring QA",()=>{
 assert.match(collectionAction,/createdCollectionId/);
 assert.match(collectionAction,/safeReturnTo/);
 assert.match(collectionNew,/name="returnTo"/);
 assert.match(candidate,/err\.createdCollectionId/);
 assert.match(candidate,/\/member\/collections\/new\?returnTo=/);
 assert.match(candidate,/recommendedCollectionId/);
});

test("bio and portrait have independent task readiness, while PostgreSQL remains authoritative",()=>{
 const bio={bio_cs:"A".repeat(200),bio_en:"B".repeat(800),portrait_image_path:null,portrait_image_alt:null};
 assert.deepEqual(readyAuthorTaskKinds(bio),["author_bio"]);
 assert.deepEqual(readyAuthorTaskKinds({...bio,bio_en:"B".repeat(199)}),[]);
 assert.deepEqual(readyAuthorTaskKinds({...bio,portrait_image_path:"authors/joseph/portrait/image.png",portrait_image_alt:"Portrait"}),["author_bio","author_visual"]);
 assert.deepEqual(readyAuthorTaskKinds({...bio,bio_cs:"",portrait_image_path:"authors/joseph/portrait/image.png",portrait_image_alt:"Portrait"}),["author_visual"]);
 const save=read("app/member/editorial-detail/[candidateId]/actions.ts");
 assert.match(save,/linked\.author_id!==value/);
 assert.match(save,/if\(!readyKinds\.has\(task\.kind\)\)continue/);
 assert.match(save,/artales_complete_editorial_task/);
 assert.match(candidate,/err\.waiting==="author_visual"/);
 assert.match(read("lib/actions/authors.ts"),/readyAuthorTaskKinds\(values\)/);
});


test("author profile may start as an internal draft only in verified editorial context",()=>{
 const values=getDefaultAuthorFormValues();
 values.name_en="Johann Wolfgang von Goethe";values.slug="johann-wolfgang-von-goethe";
 assert.equal(validateAuthorFormValues(values),null);
 assert.equal(validateAuthorFormValues(values,true),"bilingual_description_required");
 assert.match(authorAction,/candidateIdFromAuthorReturnTo/);
 assert.match(authorAction,/artales_save_candidate_editorial_field/);
 assert.match(authorAction,/linkedId!==authorId/);
 assert.match(authorNew,/required=\{!candidateId\}/);
 assert.match(authorNew,/disabled=\{Boolean\(candidateId\)\}/);
});

test("portrait upload persists metadata immediately then closes only owned visual work",()=>{
 const uploader=read("components/media/EditorialImageUploadField.tsx");
 const action=read("lib/actions/authors.ts");
 const page=read("app/member/authors/[slug]/edit/page.tsx");
 assert.match(uploader,/persistAuthorPortrait\(\{authorId,path:storagePath,alt:accessibleAlt,caption\}\)/);
 assert.match(page,/authorId=\{author.id\}/);
 assert.match(action,/export async function persistAuthorPortrait/);
 assert.match(action,/file.name===fileName/);
 assert.match(action,/portrait_image_path:input.path/);
 assert.match(action,/\.eq\("kind","author_visual"\)\.eq\("assigned_to",actor.id\)\.eq\("status","claimed"\)/);
 assert.match(action,/artales_complete_editorial_task/);
});
