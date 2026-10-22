-- Disposable local Supabase Auth E2E seed. Never execute on a linked/cloud project.
-- IDs come from actual GoTrue-created, password-authenticated synthetic sessions.
-- This setup intentionally uses postgres only to construct preconditions; RPC and RLS
-- must subsequently be exercised over signed HTTP/PostgREST user sessions.
begin;
insert into public.profiles(id,email,display_name,role,is_active) values
 (:'admin_id'::uuid,:'admin_email','CI Auth Admin','admin',true),
 (:'editor_id'::uuid,:'editor_email','CI Auth Editor','editor',true),
 (:'reader_id'::uuid,:'reader_email','CI Auth Reader','reader',true)
on conflict(id) do update set role=excluded.role,is_active=true,display_name=excluded.display_name;

insert into public.authors(id,name,slug,created_by,updated_by)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','CI Source Author','ci-source-author',
 :'admin_id'::uuid,:'admin_id'::uuid);

insert into public.work_candidates
 (id,proposed_title,proposed_author_name,status,discovery_status,rights_status,
  identity_status,normalized_author_name,matched_author_id,created_by,updated_by)
select id,title,'CI Source Author','ready','complete','clear','matched','CI Source Author',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 :'admin_id'::uuid,:'admin_id'::uuid
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
 'en','strong','candidate',:'admin_id'::uuid,
 :'admin_id'::uuid
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
 :'editor_id'::uuid,now(),
 :'admin_id'::uuid,
 :'admin_id'::uuid
from public.work_candidate_sources s
cross join (values ('WORK_CONTENT'),('EDITION_CONTENT')) as component(kind)
where s.candidate_id in ('11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333');


commit;
