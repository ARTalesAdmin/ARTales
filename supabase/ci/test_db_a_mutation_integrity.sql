-- Local-only DB-A integration: real writes to private schema, all synthetic, rolled back.
-- Prerequisite: 201_concurrency_fixture.sql, which commits synthetic candidate/source/review fixtures.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select is((public.promote_candidate_to_edit_text('11111111-1111-4111-8111-111111111111'::uuid))->>'result','promoted','synthetic candidate A promoted');
select is((public.promote_candidate_to_edit_text('33333333-3333-4333-8333-333333333333'::uuid))->>'result','promoted','synthetic candidate B promoted');
reset role;

create temp table db_a_ci_refs(kind text primary key,id uuid not null) on commit drop;
create function pg_temp.ref(k text) returns uuid language sql as $f$
 select id from db_a_ci_refs where kind=k
$f$;
create function pg_temp.rejects(statement text, expected_state text) returns boolean language plpgsql as $f$
begin
 execute statement;
 return false;
exception when others then
 return sqlstate=expected_state;
end
$f$;

with n as (insert into artales_evidence.source_snapshots(work_id,kind,source_uri,source_bytes)
 select matched_work_id,'external_raw','ci://source-a',convert_to('Source A: sample literary content','UTF8')
 from public.work_candidates where id='11111111-1111-4111-8111-111111111111'
 returning id) insert into db_a_ci_refs select 'srcA',id from n;
with n as (insert into artales_evidence.source_snapshots(work_id,kind,source_uri,source_bytes)
 select matched_work_id,'external_raw','ci://source-b',convert_to('Source B: a different text','UTF8')
 from public.work_candidates where id='33333333-3333-4333-8333-333333333333'
 returning id) insert into db_a_ci_refs select 'srcB',id from n;

select is((select sha256 from artales_evidence.source_snapshots where id=pg_temp.ref('srcA')),
 (select encode(extensions.digest(source_bytes,'sha256'),'hex') from artales_evidence.source_snapshots where id=pg_temp.ref('srcA')),'source SHA verified against stored bytes');
select ok(pg_temp.rejects(format('update artales_evidence.source_snapshots set kind=%L where id=%L','legacy_observed',pg_temp.ref('srcA')),'23000'),'source snapshot UPDATE rejected');
select ok(pg_temp.rejects(format('delete from artales_evidence.source_snapshots where id=%L',pg_temp.ref('srcA')),'23000'),'source snapshot DELETE rejected');
select ok(pg_temp.rejects(format(
 'insert into artales_evidence.source_components(snapshot_id,kind,byte_start,byte_end,disposition,explanation) values(%L,%L,0,50000,%L,%L)',
 pg_temp.ref('srcA'),'WORK_CONTENT','qa_text_only','out of bounds'),'23514'),'component outside original bytes rejected');

with n as (insert into artales_evidence.source_components(snapshot_id,kind,byte_start,byte_end,disposition,explanation)
 values(pg_temp.ref('srcA'),'WORK_CONTENT',0,10,'qa_text_only','synthetic A range') returning id)
 insert into db_a_ci_refs select 'compA',id from n;
with n as (insert into artales_evidence.source_components(snapshot_id,kind,byte_start,byte_end,disposition,explanation)
 values(pg_temp.ref('srcB'),'WORK_CONTENT',0,10,'qa_text_only','synthetic B range') returning id)
 insert into db_a_ci_refs select 'compB',id from n;
select ok(pg_temp.rejects(format('update artales_evidence.source_components set byte_end=5 where id=%L',pg_temp.ref('compA')),'23000'),'source anchors cannot change');

with n as (insert into artales_evidence.rights_dossiers(work_id,snapshot_id,policy_version,status)
 select work_id,id,'qa-policy-1','pending' from artales_evidence.source_snapshots where id=pg_temp.ref('srcA') returning id)
 insert into db_a_ci_refs select 'dossierA',id from n;
with n as (insert into artales_evidence.rights_dossiers(work_id,snapshot_id,policy_version,status)
 select work_id,id,'qa-policy-1','pending' from artales_evidence.source_snapshots where id=pg_temp.ref('srcB') returning id)
 insert into db_a_ci_refs select 'dossierB',id from n;
select ok(pg_temp.rejects(format(
 'insert into artales_evidence.rights_dossiers(work_id,snapshot_id,policy_version) select work_id,%L,%L from artales_evidence.source_snapshots where id=%L',
 pg_temp.ref('srcB'),'forged',pg_temp.ref('srcA')),'23503'),'dossier cannot reference other work snapshot');
select ok(pg_temp.rejects(format(
 'insert into artales_evidence.rights_evidence(dossier_id,component_id,jurisdiction,decision,evidence_bytes) values(%L,%L,%L,%L,decode(%L,%L))',
 pg_temp.ref('dossierA'),pg_temp.ref('compB'),'CZ','review_required','aa','hex'),'23514'),'component evidence cannot reference other dossier source');

with n as (insert into artales_evidence.rights_evidence(dossier_id,component_id,jurisdiction,decision,evidence_bytes)
 values(pg_temp.ref('dossierA'),pg_temp.ref('compA'),'CZ','review_required',convert_to('synthetic evidence','UTF8')) returning id)
 insert into db_a_ci_refs select 'evidenceA',id from n;
select is((select evidence_sha256 from artales_evidence.rights_evidence where id=pg_temp.ref('evidenceA')),
 (select encode(extensions.digest(evidence_bytes,'sha256'),'hex') from artales_evidence.rights_evidence where id=pg_temp.ref('evidenceA')),'rights evidence hash from actual bytes');
select ok(pg_temp.rejects('update artales_evidence.rights_evidence set jurisdiction=''US''','23000'),'rights evidence cannot be changed');
select is((select status from artales_evidence.rights_dossiers where id=pg_temp.ref('dossierA')),'pending','no automatic legal approval');

with n as (insert into artales_evidence.text_revisions(work_id,source_snapshot_id,semantic_blocks,recipe_version,semantic_sha256)
 select work_id,id,'[{"kind":"poem","stanzas":[{"lines":["first line","second line"]}]}]'::jsonb,'qa-composer-v1',repeat('0',64)
 from artales_evidence.source_snapshots where id=pg_temp.ref('srcA') returning id)
 insert into db_a_ci_refs select 'textA',id from n;
with n as (insert into artales_evidence.text_revisions(work_id,source_snapshot_id,semantic_blocks,recipe_version)
 select work_id,id,'[{"kind":"paragraph","text":"another work"}]'::jsonb,'qa-composer-v1'
 from artales_evidence.source_snapshots where id=pg_temp.ref('srcB') returning id)
 insert into db_a_ci_refs select 'textB',id from n;
select is((select semantic_sha256 from artales_evidence.text_revisions where id=pg_temp.ref('textA')),
 (select encode(extensions.digest(convert_to(semantic_blocks::text,'UTF8'),'sha256'),'hex') from artales_evidence.text_revisions where id=pg_temp.ref('textA')),'server overwrote false client revision digest');
select ok(pg_temp.rejects('update artales_evidence.text_revisions set recipe_version=''forged''','23000'),'text revision cannot change');
select ok(pg_temp.rejects(format(
 'insert into artales_evidence.text_revisions(work_id,source_snapshot_id,semantic_blocks,recipe_version) select work_id,%L,%L::jsonb,%L from artales_evidence.source_snapshots where id=%L',
 pg_temp.ref('srcB'),'[{"kind":"paragraph","text":"wrong work"}]','qa-v1',pg_temp.ref('srcA')),'23503'),'revision cannot use other work source');
select ok(pg_temp.rejects(format(
 'insert into artales_evidence.text_revisions(work_id,source_snapshot_id,parent_revision_id,semantic_blocks,recipe_version) select work_id,id,%L,%L::jsonb,%L from artales_evidence.source_snapshots where id=%L',
 pg_temp.ref('textB'),'[{"kind":"paragraph","text":"wrong parent"}]','qa-v2',pg_temp.ref('srcA')),'23503'),'revision parent must belong to same work');

with n as (insert into artales_evidence.metadata_revisions(work_id,facts,citations,public_copy,recipe_version,content_sha256)
 select matched_work_id,'{"original_language":"unknown"}'::jsonb,'[]'::jsonb,'{"description":"synthetic"}'::jsonb,'qa-blurb-v1',repeat('0',64)
 from public.work_candidates where id='11111111-1111-4111-8111-111111111111' returning id)
 insert into db_a_ci_refs select 'metaA',id from n;
select is((select content_sha256 from artales_evidence.metadata_revisions where id=pg_temp.ref('metaA')),
 (select encode(extensions.digest(convert_to(jsonb_build_object('facts',facts,'citations',citations,'copy',public_copy,'recipe',recipe_version)::text,'UTF8'),'sha256'),'hex')
 from artales_evidence.metadata_revisions where id=pg_temp.ref('metaA')),'metadata digest derived from facts and public copy');
select ok(pg_temp.rejects('update artales_evidence.metadata_revisions set public_copy=''{}''::jsonb','23000'),'metadata revision immutable');

with n as (insert into artales_evidence.visual_revisions(work_id,asset_bytes,style_version)
 select matched_work_id,decode('89abcdef','hex'),'qa-cover-v1'
 from public.work_candidates where id='11111111-1111-4111-8111-111111111111' returning id)
 insert into db_a_ci_refs select 'visualA',id from n;
select is((select asset_sha256 from artales_evidence.visual_revisions where id=pg_temp.ref('visualA')),
 (select encode(extensions.digest(asset_bytes,'sha256'),'hex') from artales_evidence.visual_revisions where id=pg_temp.ref('visualA')),'visual revision SHA is computed from asset bytes');
select ok(pg_temp.rejects('delete from artales_evidence.visual_revisions','23000'),'visual cannot be deleted');

insert into artales_evidence.review_events(work_id,artifact_kind,artifact_id,artifact_sha256,reviewer_id,result,reason)
select r.work_id,'text',r.id,r.semantic_sha256,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','returned','Synthetic QA return, not legal approval'
from artales_evidence.text_revisions r where r.id=pg_temp.ref('textA');
select ok(pg_temp.rejects('update artales_evidence.review_events set result=''approved''','23000'),'review decisions cannot be rewritten');
select is((select count(*)::integer from artales_evidence.review_events),1,'exactly one synthetic audit event');
select * from finish();
rollback;
