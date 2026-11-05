import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const migration=read("ops/sql/20261105_artales_candidate_bilingual_descriptions.sql");
const form=read("components/editor/CandidateBilingualAnnotationFields.tsx");
const page=read("app/member/editorial-detail/[candidateId]/page.tsx");
const action=read("app/member/editorial-detail/[candidateId]/actions.ts");
const reader=read("app/reader/[slug]/page.tsx");

test("both Czech and English are required with 200-800 characters each",()=>{
 assert.match(form,/name="description_cs" required/);
 assert.match(form,/name="description_en" required/);
 assert.match(form,/const min=200,max=800/);
 assert.match(form,/disabled=\{cs\.trim\(\)\.length<min/);
 assert.match(form,/en\.trim\(\)\.length<min/);
 assert.match(page,/metadata\.work_description_cs/);
 assert.match(page,/metadata\.work_description_en/);
 assert.match(page,/\.every\(v=>/);
 assert.doesNotMatch(page,/name="value" required minLength=\{200\}/);
});
test("metadata saves both languages atomically; old single-language route fails closed",()=>{
 assert.match(action,/artales_save_candidate_bilingual_description/);
 assert.match(action,/p_description_cs:descriptionCs,p_description_en:descriptionEn/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.artales_save_candidate_bilingual_description/);
 assert.match(migration,/SET work_description_cs=v_cs,work_description_en=v_en/);
 assert.match(migration,/p_field='description' THEN RETURN pg_catalog\.jsonb_build_object\('result','bilingual_required'\)/);
 assert.match(migration,/t\.kind='work_description'/);
 assert.match(migration,/t\.status='claimed'/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.artales_save_candidate_bilingual_description/);
});
test("DB prevents half-completed descriptions and task closeout requires both languages",()=>{
 assert.match(migration,/artales_candidate_bilingual_description_pair_check/);
 assert.match(migration,/work_description_cs IS NULL AND work_description_en IS NULL/);
 assert.match(migration,/char_length\(btrim\(work_description_cs\)\) BETWEEN 200 AND 800/);
 assert.match(migration,/char_length\(btrim\(work_description_en\)\) BETWEEN 200 AND 800/);
 assert.match(migration,/WHEN 'work_description' THEN/);
 assert.match(migration,/char_length\(btrim\(coalesce\(m\.work_description_cs,''\)\)\) BETWEEN 200 AND 800/);
 assert.match(migration,/char_length\(btrim\(coalesce\(m\.work_description_en,''\)\)\) BETWEEN 200 AND 800/);
});
test("legacy publications, reader and original single-language drafts remain untouched",()=>{
 assert.doesNotMatch(migration,/ALTER TABLE public\.works|UPDATE public\.works|DELETE FROM public\.works/);
 assert.doesNotMatch(migration,/UPDATE public\.artales_candidate_editorial_metadata SET work_description =/);
 assert.match(reader,/<ReaderClient/);
});
