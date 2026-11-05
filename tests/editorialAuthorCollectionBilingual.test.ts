import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateAuthorFormValues,getDefaultAuthorFormValues} from "../lib/forms/authorForm";
import {validateCollectionFormValues,getDefaultCollectionFormValues} from "../lib/forms/collectionForm";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
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
 assert.match(authorAction,/validateAuthorFormValues\(values,true\)/);
 assert.match(authorNew,/BilingualProfileText/);
 assert.match(authorNew,/required=\{true\}/);
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
 assert.match(candidate,/\[author\?\.bio_en,author\?\.bio_cs\]\.every/);
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
