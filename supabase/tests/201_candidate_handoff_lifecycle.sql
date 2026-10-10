-- Disposable local PostgreSQL only. All synthetic fixtures rollback with this test.
-- Exercises DB RLS + RPC behavior; does not constitute external legal clearance.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Authentication subjects are synthetic. Never run this file on a linked project.
insert into auth.users(id,email,role,aud,instance_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-admin@invalid.example','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-editor@invalid.example','authenticated','authenticated','00000000-0000-0000-0000-000000000000'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','qa-reader@invalid.example','authenticated','authenticated','00000000-0000-0000-0000-000000000000');

insert into public.profiles(id,email,display_name,role,is_active) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-admin@invalid.example','CI Admin','admin',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-editor@invalid.example','CI Editor','editor',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','qa-reader@invalid.example','CI Reader','reader',true);

insert into public.authors(id,name,slug,created_by,updated_by)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','CI Source Author','ci-source-author',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.work_candidates
 (id,proposed_title,proposed_author_name,status,discovery_status,rights_status,
  identity_status,normalized_author_name,matched_author_id,created_by,updated_by)
select id,title,'CI Source Author','ready','complete','clear','matched','CI Source Author',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from (values
 ('11111111-1111-4111-8111-111111111111'::uuid,'CI Happy Path'),
 ('22222222-2222-4222-8222-222222222222'::uuid,'CI Altered Rights'),
 ('33333333-3333-4333-8333-333333333333'::uuid,'CI Atomic Rollback')
) as fixture(id,title);

insert into public.work_candidate_sources
 (id,candidate_id,provider,source_type,source_reference,language,identity_match,status,created_by,updated_by)
select
 case c.id
 when '11111111-1111-4111-8111-111111111111'::uuid then '44444444-4444-4444-8444-444444444441'::uuid
 when '22222222-2222-4222-8222-222222222222'::uuid then '44444444-4444-4444-8444-444444444442'::uuid
 else '44444444-4444-4444-8444-444444444443'::uuid end,
 c.id,'Synthetic Public Test','text','ci-fixture:'||c.id::text,
 'en','strong','candidate','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.work_candidates c
where c.id in ('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333');

update public.work_candidates c set preferred_source_id=s.id
from public.work_candidate_sources s
where s.candidate_id=c.id and c.id in
 ('11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333');

insert into public.work_candidate_component_rights
 (candidate_id,source_id,component_type,decision,publication_effect,reason,
  reviewed_by,reviewed_at,created_by,updated_by)
select s.candidate_id,s.id, component.kind,
 case when component.kind='WORK_CONTENT' then 'usable' else 'not_applicable' end,
 'allow','CI reviewed original content and excluded editorial layer',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now(),
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.work_candidate_sources s
cross join (values ('WORK_CONTENT'),('EDITION_CONTENT')) as component(kind)
where s.candidate_id in ('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333');

-- Authenticate as the submitting administrator.
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

select is((public.register_candidate_source_capture(
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444441',
 'Synthetic original text for happy path',
 '[{"component_type":"WORK_CONTENT","included":true},{"component_type":"EDITION_CONTENT","included":false}]'::jsonb,
 'Synthetic provenance note; not a real legal determination.'
))->>'result','pending_independent_review','admin saved pending snapshot for happy path');
select is((public.register_candidate_source_capture(
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444442',
 'Synthetic original text for rights change',
 '[{"component_type":"WORK_CONTENT","included":true},{"component_type":"EDITION_CONTENT","included":false}]'::jsonb,
 'Synthetic provenance note; not a real legal determination.'
))->>'result','pending_independent_review','admin saved pending snapshot for rights alteration');
select is((public.register_candidate_source_capture(
 '33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444443',
 'Synthetic original text for rollback',
 '[{"component_type":"WORK_CONTENT","included":true},{"component_type":"EDITION_CONTENT","included":false}]'::jsonb,
 'Synthetic provenance note; not a real legal determination.'
))->>'result','pending_independent_review','admin saved pending snapshot for rollback');
select is((public.review_candidate_source_capture(
 (select id from public.candidate_source_captures where candidate_id='11111111-1111-4111-8111-111111111111'),
 (select source_sha256 from public.candidate_source_captures where candidate_id='11111111-1111-4111-8111-111111111111'),
 'Independent review note is explicitly required and sufficiently long.',
 'public_domain'::public.work_origin_type,'manual'::public.work_source_label
))->>'result','self_review_forbidden','submitting admin cannot review own snapshot');

-- Second actor: distinct logged-in editor; no caller-supplied reviewer ID.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select is((public.review_candidate_source_capture(
 (select id from public.candidate_source_captures where candidate_id='11111111-1111-4111-8111-111111111111'),
 (select source_sha256 from public.candidate_source_captures where candidate_id='11111111-1111-4111-8111-111111111111'),
 'Independent review performed on the exact synthetic content and rights.',
 'public_domain'::public.work_origin_type,'manual'::public.work_source_label
))->>'result','review_recorded','editor signed happy-path snapshot');
select is((public.review_candidate_source_capture(
 (select id from public.candidate_source_captures where candidate_id='22222222-2222-4222-8222-222222222222'),
 (select source_sha256 from public.candidate_source_captures where candidate_id='22222222-2222-4222-8222-222222222222'),
 'Independent review performed on the exact synthetic content and rights.',
 'public_domain'::public.work_origin_type,'manual'::public.work_source_label
))->>'result','review_recorded','editor signed rights-alteration snapshot');
select is((public.review_candidate_source_capture(
 (select id from public.candidate_source_captures where candidate_id='33333333-3333-4333-8333-333333333333'),
 (select source_sha256 from public.candidate_source_captures where candidate_id='33333333-3333-4333-8333-333333333333'),
 'Independent review performed on the exact synthetic content and rights.',
 'public_domain'::public.work_origin_type,'manual'::public.work_source_label
))->>'result','review_recorded','editor signed rollback snapshot');
select is((select reviewed_by from public.candidate_source_captures where candidate_id='11111111-1111-4111-8111-111111111111'),
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,'reviewer ID comes from second actor session');

-- Reader with authenticated JWT role but no editorial profile cannot promote.
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select throws_ok($$select public.promote_candidate_to_edit_text('11111111-1111-4111-8111-111111111111')$$,
 '42501','editor_role_required','reader cannot promote approved source');

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select is((public.promote_candidate_to_edit_text(
 '11111111-1111-4111-8111-111111111111'))->>'result',
 'promoted','first promotion succeeds');
select is((public.promote_candidate_to_edit_text(
 '11111111-1111-4111-8111-111111111111'))->>'result',
 'already_promoted','repeated promotion is idempotent');
select is((select count(*)::int from public.works where slug='candidate-11111111111141118111111111111111'),1,
 'exactly one work created');
select is((select count(*)::int from public.editorial_tasks
 where source_system='artales' and source_external_id='candidate-edit:11111111-1111-4111-8111-111111111111'),1,
 'exactly one edit_text task created');
select is((select count(*)::int from public.editorial_task_events e join public.editorial_tasks t on t.id=e.task_id
 where t.source_external_id='candidate-edit:11111111-1111-4111-8111-111111111111'
 and e.event_type='created'),1,'exactly one task creation event');
select is((select count(*)::int from public.work_candidate_promotion_attempts
 where candidate_id='11111111-1111-4111-8111-111111111111' and result='promoted'),1,
 'exactly one promotion audit event');
select is((select origin_type::text from public.works
 where slug='candidate-11111111111141118111111111111111'),'public_domain','draft origin matches explicit approval');

-- Database records change after reviewer signed: promote must fail closed.
reset role;
update public.work_candidate_component_rights set reason='Changed legal basis after approval'
where candidate_id='22222222-2222-4222-8222-222222222222' and component_type='WORK_CONTENT';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select is((public.promote_candidate_to_edit_text('22222222-2222-4222-8222-222222222222'))->>'result',
 'blocked','changed source rights prevent promotion');
select is((select count(*)::int from public.works
 where slug='candidate-22222222222242228222222222222222'),0,'changed rights created no work');

-- Force a failure only on local test DB between work INSERT and task INSERT.
reset role;
create function pg_temp.ci_reject_edit_text() returns trigger language plpgsql as $fail$
begin
 if new.kind='edit_text' then raise exception 'CI_INTENTIONAL_TASK_FAILURE'; end if;
 return new;
end $fail$;
create trigger aaa_ci_reject_edit_text before insert on public.editorial_tasks
 for each row execute function pg_temp.ci_reject_edit_text();
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select throws_ok($$select public.promote_candidate_to_edit_text('33333333-3333-4333-8333-333333333333')$$,
 'P0001','CI_INTENTIONAL_TASK_FAILURE','failed task insert rolls back entire promotion');
select is((select matched_work_id from public.work_candidates where id='33333333-3333-4333-8333-333333333333'),
 null::uuid,'rollback restores candidate link');
select is((select count(*)::int from public.works where slug='candidate-33333333333343338333333333333333'),0,
 'rollback removes draft work');
select is((select count(*)::int from public.editorial_tasks
 where source_external_id='candidate-edit:33333333-3333-4333-8333-333333333333'),0,'rollback removes task');
select * from finish();
rollback;
