-- E2 PROVISIONAL ASSEMBLY. Disposable local Supabase ONLY; NOT A CANONICAL MIGRATION.
-- No production apply; no work status, published release pointer, reader or notes mutation.
-- Requires existing versioned DB-A + editorial tasks + hardened profiles.
begin;
create table artales_evidence.semantic_v2_drafts (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 source_snapshot_id uuid not null,
 text_revision_id uuid not null unique,
 parent_draft_id uuid,
 actor_id uuid not null references public.profiles(id),
 request_id uuid not null,
 revision_sha256 text not null check(revision_sha256 ~ '^[0-9a-f]{64}$'),
 semantic_blocks_sha256 text not null check(semantic_blocks_sha256 ~ '^[0-9a-f]{64}$'),
 serialized_payload text not null check(octet_length(serialized_payload) between 10 and 1500000),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 round integer not null check(round>=0),
 created_at timestamptz not null default now(),
 unique(id,work_id),
 unique(work_id,revision_sha256),
 unique(actor_id,request_id),
 constraint e2_source_work foreign key(source_snapshot_id,work_id)
   references artales_evidence.source_snapshots(id,work_id) on delete restrict,
 constraint e2_text_work foreign key(text_revision_id,work_id)
   references artales_evidence.text_revisions(id,work_id) on delete restrict,
 constraint e2_parent_work foreign key(parent_draft_id,work_id)
   references artales_evidence.semantic_v2_drafts(id,work_id) on delete restrict
);
create table artales_evidence.semantic_v2_heads (
 work_id uuid primary key references public.works(id) on delete restrict,
 source_snapshot_id uuid not null,
 head_draft_id uuid,
 constraint e2_head_snapshot_work foreign key(source_snapshot_id,work_id)
   references artales_evidence.source_snapshots(id,work_id) on delete restrict,
 constraint e2_head_revision_work foreign key(head_draft_id,work_id)
   references artales_evidence.semantic_v2_drafts(id,work_id) on delete restrict
);
create table artales_evidence.semantic_v2_review_issues (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null,
 draft_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 request_id uuid not null,
 target_atom_id text not null check(length(target_atom_id) between 3 and 180),
 source_anchor jsonb not null check(jsonb_typeof(source_anchor)='object'),
 reason text not null check(length(btrim(reason)) between 8 and 1000),
 kind text not null check(kind='typography'),
 requested_layout text not null check(requested_layout='indent_small'),
 issue_json jsonb not null check(jsonb_typeof(issue_json)='object'),
 created_at timestamptz not null default now(),
 unique(actor_id,request_id),
 unique(draft_id),
 constraint e2_issue_draft_work foreign key(draft_id,work_id)
   references artales_evidence.semantic_v2_drafts(id,work_id) on delete restrict
);
do $e2_rls$
declare t text;
begin
 foreach t in array array['semantic_v2_drafts','semantic_v2_heads','semantic_v2_review_issues'] loop
  execute format('alter table artales_evidence.%I enable row level security',t);
  execute format('revoke all on table artales_evidence.%I from public,anon,authenticated',t);
 end loop;
end $e2_rls$;
create trigger immutable_semantic_v2_drafts before update or delete
 on artales_evidence.semantic_v2_drafts for each row execute function artales_evidence.reject_mutation();
create trigger immutable_semantic_v2_review_issues before update or delete
 on artales_evidence.semantic_v2_review_issues for each row execute function artales_evidence.reject_mutation();

-- Private structural traversal; never made accessible to Data API roles.
create function artales_internal.semantic_v2_atoms(p_nodes jsonb)
 returns setof jsonb language plpgsql stable set search_path='' as $atoms$
declare n jsonb; stanza jsonb; line jsonb;
begin
 if pg_catalog.jsonb_typeof(p_nodes)<>'array' then
  raise exception 'invalid_semantic_nodes' using errcode='23514';
 end if;
 for n in select value from pg_catalog.jsonb_array_elements(p_nodes) loop
  if n->>'kind' in ('chapter','section') then
   return next n->'heading';
   return query select x from artales_internal.semantic_v2_atoms(n->'children') x;
  elsif n->>'kind'='poem' then
   if pg_catalog.jsonb_typeof(n->'stanzas')<>'array' then
    raise exception 'invalid_semantic_stanzas' using errcode='23514';
   end if;
   for stanza in select value from pg_catalog.jsonb_array_elements(n->'stanzas') loop
    if pg_catalog.jsonb_typeof(stanza->'lines')<>'array' then
     raise exception 'invalid_semantic_verse' using errcode='23514';
    end if;
    for line in select value from pg_catalog.jsonb_array_elements(stanza->'lines') loop
     return next line->'atom';
    end loop;
   end loop;
  elsif n->>'kind' in ('paragraph','quote','epigraph','footnote') then
   return next n->'atom';
  else
   raise exception 'invalid_semantic_kind' using errcode='23514';
  end if;
 end loop;
end $atoms$;
revoke all on function artales_internal.semantic_v2_atoms(jsonb) from public,anon,authenticated;

-- Minimal independent SQL attestation of pinned source coverage, bytes and atom hashes.
-- Exact Composer v2 UI/recipe validation also runs in the signed server adapter.
create function artales_internal.check_semantic_v2_source(p_payload jsonb,p_snapshot_id uuid,p_component_id uuid)
 returns boolean language plpgsql stable set search_path='' as $check$
declare s artales_evidence.source_snapshots%rowtype;
 c artales_evidence.source_components%rowtype;
 a jsonb; gap jsonb; raw_part bytea; text_part text;
 byte_cursor integer; norm_cursor integer := 0; total integer := 0;
 combined text := ''; ids text[] := array[]::text[];
 start_at integer; end_at integer;
begin
 select * into s from artales_evidence.source_snapshots where id=p_snapshot_id;
 select * into c from artales_evidence.source_components where id=p_component_id;
 if s.id is null or c.id is null or c.snapshot_id<>s.id or
    c.kind<>'WORK_CONTENT' or c.disposition<>'qa_text_only' or
    p_payload->'source'->>'source_snapshot_ref'<>'sha256:'||s.sha256 or
    p_payload->'source'->>'source_bytes_sha256'<>s.sha256 or
    p_payload->'source'->>'component_id'<>p_component_id::text or
    (p_payload->'source'->>'original_byte_start')::integer<>c.byte_start or
    (p_payload->'source'->>'original_byte_end')::integer<>c.byte_end then return false;
 end if;
 if pg_catalog.jsonb_typeof(p_payload->'gaps')<>'array' then return false; end if;
 byte_cursor:=c.byte_start;
 for a in
  select atom from (
   select atom from artales_internal.semantic_v2_atoms(p_payload->'blocks') as atom
   union all
   select g->'atom' from pg_catalog.jsonb_array_elements(p_payload->'gaps') g
  ) all_atoms
  order by (atom->'anchor'->>'original_byte_start')::integer
 loop
  if pg_catalog.jsonb_typeof(a)<>'object' or
     (a->>'id') is null or (a->>'id')=any(ids) or
     (a->'anchor'->>'snapshot_ref')<>'sha256:'||s.sha256 or
     (a->'anchor'->>'component_id')<>p_component_id::text then return false; end if;
  ids:=pg_catalog.array_append(ids,a->>'id');
  start_at:=(a->'anchor'->>'original_byte_start')::integer;
  end_at:=(a->'anchor'->>'original_byte_end')::integer;
  if start_at<>byte_cursor or end_at<=start_at or end_at>c.byte_end or
    (a->'anchor'->>'normalized_start')::integer<>norm_cursor or
    (a->'anchor'->>'normalized_end')::integer<=norm_cursor then return false; end if;
  raw_part:=pg_catalog.substr(s.source_bytes,start_at+1,end_at-start_at);
  if a->>'source_sha256'<>pg_catalog.encode(extensions.digest(raw_part,'sha256'),'hex') then return false; end if;
  text_part:=pg_catalog.replace(pg_catalog.convert_from(raw_part,'UTF8'),E'\r\n',E'\n');
  if a->>'raw'<>text_part then return false; end if;
  combined:=combined||text_part;
  norm_cursor:=(a->'anchor'->>'normalized_end')::integer;
  byte_cursor:=end_at;
  total:=total+1;
 end loop;
 if total=0 or byte_cursor<>c.byte_end then return false; end if;
 text_part:=pg_catalog.replace(
   pg_catalog.convert_from(pg_catalog.substr(s.source_bytes,c.byte_start+1,c.byte_end-c.byte_start),'UTF8'),
   E'\r\n',E'\n');
 return combined=text_part and
   p_payload->'source'->>'normalized_text'=text_part and
   p_payload->'source'->>'normalized_text_sha256'=
     pg_catalog.encode(extensions.digest(pg_catalog.convert_to(text_part,'UTF8'),'sha256'),'hex');
end $check$;
revoke all on function artales_internal.check_semantic_v2_source(jsonb,uuid,uuid) from public,anon,authenticated;


-- LOCAL QA ONLY: an administrator edits under their existing SAME identity.
-- No second "editor account"; assignment is a canonical editorial_tasks item,
-- private to that administrator in the inbox until the pilot is released.
create table artales_evidence.semantic_v2_self_assignments (
 task_id uuid primary key,
 work_id uuid not null unique references public.works(id) on delete restrict,
 source_snapshot_id uuid not null,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(actor_id,request_id),
 constraint e2_self_assignment_source_work foreign key(source_snapshot_id,work_id)
   references artales_evidence.source_snapshots(id,work_id) on delete restrict,
 constraint e2_self_assignment_task foreign key(task_id)
   references public.editorial_tasks(id) on delete restrict deferrable initially deferred
);
alter table artales_evidence.semantic_v2_self_assignments enable row level security;
revoke all on table artales_evidence.semantic_v2_self_assignments from public,anon,authenticated;
create trigger immutable_e2_self_assignments before update or delete
 on artales_evidence.semantic_v2_self_assignments
 for each row execute function artales_evidence.reject_mutation();

-- Preserve the original candidate/legal permissions; only introduce one new
-- private audit-bound insertion and a strict same-account pilot claim.
create or replace function artales_internal.editorial_task_history()
returns trigger language plpgsql security definer set search_path=''
as $trigger$
declare v_actor uuid:=auth.uid();v_event text;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role in ('admin','editor'))
 then raise exception 'editorial_actor_required' using errcode='42501';end if;
 if tg_op='INSERT' then
   if new.created_by<>v_actor or new.status<>'open'
     or not ((new.kind='legal_review' and new.candidate_id is not null and new.work_id is null)
       or (new.kind='edit_text' and new.work_id is not null and new.candidate_id is null
         and new.source_system='artales' and
         exists(select 1 from public.work_candidates c where c.matched_work_id=new.work_id and c.promoted_by=v_actor
           and exists(select 1 from public.candidate_source_captures sc where sc.candidate_id=c.id and sc.source_id=c.preferred_source_id)))
       or (new.kind='edit_text' and new.work_id is not null and new.candidate_id is null
         and new.source_system='artales'
         and new.source_external_id='semantic-v2-selfpilot:'||new.work_id::text
         and exists(select 1 from artales_evidence.semantic_v2_self_assignments a
           where a.task_id=new.id and a.work_id=new.work_id and a.actor_id=v_actor)))
   then raise exception 'editorial_invalid_create' using errcode='23514';end if;
   return new;
 else
   if row(new.id,new.candidate_id,new.work_id,new.kind,new.title,new.source_system,
     new.source_external_id,new.created_by,new.created_at,new.completed_at)
     is distinct from row(old.id,old.candidate_id,old.work_id,old.kind,old.title,old.source_system,
       old.source_external_id,old.created_by,old.created_at,old.completed_at)
   then raise exception 'editorial_immutable_field_changed' using errcode='23514';end if;
   if old.status='open' and new.status='claimed' and new.assignee_user_id=v_actor
       and (not exists(select 1 from artales_evidence.semantic_v2_self_assignments a where a.task_id=new.id)
         or exists(select 1 from artales_evidence.semantic_v2_self_assignments a
           where a.task_id=new.id and a.actor_id=v_actor))
   then new.claimed_at:=now();v_event:='claimed';
   elsif old.status='claimed' and new.status='open' and new.assignee_user_id is null and
     new.claimed_at is null and (old.assignee_user_id=v_actor or exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin'))
     and (not exists(select 1 from artales_evidence.semantic_v2_self_assignments a where a.task_id=new.id)
       or exists(select 1 from artales_evidence.semantic_v2_self_assignments a
         where a.task_id=new.id and a.actor_id=v_actor))
   then v_event:='returned';
   else raise exception 'editorial_invalid_transition' using errcode='23514';end if;
   new.updated_at:=now();
   insert into public.editorial_task_events(task_id,event_type,actor_id)values(new.id,v_event,v_actor);
   return new;
 end if;
end $trigger$;

-- Pilot tasks must not appear in colleagues' general work inbox.
drop policy "Active editorial staff read tasks" on public.editorial_tasks;
create policy "Active editorial staff read tasks" on public.editorial_tasks
 for select to authenticated using (
  exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin'))
  and (coalesce(source_external_id,'') not like 'semantic-v2-selfpilot:%'
    or created_by=(select auth.uid()))
 );
drop policy "Active editorial staff read task events" on public.editorial_task_events;
create policy "Active editorial staff read task events" on public.editorial_task_events
 for select to authenticated using (
  exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin'))
  and exists(select 1 from public.editorial_tasks t where t.id=task_id)
 );

-- Pilot sidecar is never permitted to publish or change existing public content.
-- A published legacy work can be safely QA-composed against a separately
-- archived source without mutating its current Reader, URL or annotations.
create function public.enqueue_semantic_v2_self_pilot(
 p_work_id uuid,p_source_snapshot_id uuid,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $enqueue$
declare v_actor uuid:=auth.uid();
 v_work public.works%rowtype; v_source artales_evidence.source_snapshots%rowtype;
 v_existing artales_evidence.semantic_v2_self_assignments%rowtype; v_task uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p
   where p.id=v_actor and p.role='admin' and p.is_active)
 then return pg_catalog.jsonb_build_object('result','blocked','reason','admin_required');end if;
 if p_request_id is null or p_source_snapshot_id is null
 then return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_request');end if;
 select * into v_work from public.works where id=p_work_id for update;
 if v_work.id is null or v_work.status not in ('draft'::public.work_status,'published'::public.work_status)
 then return pg_catalog.jsonb_build_object('result','blocked','reason','work_not_eligible_for_pilot');end if;
 select * into v_source from artales_evidence.source_snapshots
   where id=p_source_snapshot_id and work_id=p_work_id;
 if v_source.id is null or v_source.kind<>'external_raw'
   or not exists(select 1 from artales_evidence.source_components c
     where c.snapshot_id=v_source.id and c.kind='WORK_CONTENT' and c.disposition='qa_text_only')
 then return pg_catalog.jsonb_build_object('result','blocked','reason','archived_qa_source_required');end if;
 select * into v_existing from artales_evidence.semantic_v2_self_assignments
  where actor_id=v_actor and request_id=p_request_id;
 if v_existing.task_id is not null then
  if v_existing.work_id=p_work_id and v_existing.source_snapshot_id=p_source_snapshot_id
  then return pg_catalog.jsonb_build_object('result','already_queued','task_id',v_existing.task_id,
    'publication_allowed',false);end if;
  return pg_catalog.jsonb_build_object('result','blocked','reason','idempotency_key_reuse');
 end if;
 select * into v_existing from artales_evidence.semantic_v2_self_assignments where work_id=p_work_id;
 if v_existing.task_id is not null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','work_already_queued');end if;
 v_task:=pg_catalog.gen_random_uuid();
 insert into artales_evidence.semantic_v2_self_assignments(
   task_id,work_id,source_snapshot_id,actor_id,request_id)
 values(v_task,p_work_id,p_source_snapshot_id,v_actor,p_request_id);
 insert into public.editorial_tasks(
   id,work_id,kind,title,created_by,source_system,source_external_id)
 values(v_task,p_work_id,'edit_text',
   pg_catalog.left('Vlastní kontrola převodu: '||v_work.title,240),
   v_actor,'artales','semantic-v2-selfpilot:'||p_work_id::text);
 return pg_catalog.jsonb_build_object('result','queued_for_review','task_id',v_task,
   'assignee_user_id',v_actor,'publication_allowed',false);
end $enqueue$;
revoke all on function public.enqueue_semantic_v2_self_pilot(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.enqueue_semantic_v2_self_pilot(uuid,uuid,uuid) to authenticated;

-- All changes are atomic under a private draft-head row lock, scoped to one work.
create function public.stage_semantic_v2_draft(
 p_work_id uuid, p_source_snapshot_id uuid, p_component_id uuid,
 p_serialized_payload text, p_expected_sha256 text,
 p_parent_draft_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $save$
declare actor uuid := auth.uid(); v_role public.app_role; w_slug text;
 s artales_evidence.source_snapshots%rowtype;
 v_payload jsonb; v_head artales_evidence.semantic_v2_heads%rowtype;
 parent_record artales_evidence.semantic_v2_drafts%rowtype;
 returned_issue artales_evidence.semantic_v2_review_issues%rowtype;
 prior artales_evidence.semantic_v2_drafts%rowtype;
 new_text_id uuid; new_text_sha text; new_draft_id uuid; v_digest text;
 v_round integer;
begin
 if actor is null then return pg_catalog.jsonb_build_object('result','blocked','reason','authentication_required'); end if;
 select role into v_role from public.profiles where id=actor and is_active=true;
 if v_role not in ('admin'::public.app_role,'editor'::public.app_role) or v_role is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','editor_role_required'); end if;
 if exists(select 1 from artales_evidence.semantic_v2_self_assignments a where a.work_id=p_work_id) then
  if not exists(select 1 from artales_evidence.semantic_v2_self_assignments a
    join public.editorial_tasks t on t.id=a.task_id
    where a.work_id=p_work_id and a.actor_id=actor
      and t.status='claimed' and t.kind='edit_text' and t.assignee_user_id=actor)
  then return pg_catalog.jsonb_build_object('result','blocked','reason','claimed_work_task_required');end if;
 elsif v_role='editor'::public.app_role and not exists(
  select 1 from public.editorial_tasks t where t.work_id=p_work_id and t.kind='edit_text'
    and t.status='claimed' and t.assignee_user_id=actor)
 then return pg_catalog.jsonb_build_object('result','blocked','reason','claimed_work_task_required');end if;
 select slug into w_slug from public.works where id=p_work_id;
 if w_slug is null then return pg_catalog.jsonb_build_object('result','blocked','reason','work_not_found'); end if;
 select * into s from artales_evidence.source_snapshots where id=p_source_snapshot_id and work_id=p_work_id;
 if s.id is null or s.kind<>'external_raw' then
  return pg_catalog.jsonb_build_object('result','blocked','reason','archived_external_source_required'); end if;
 if p_request_id is null or p_expected_sha256 !~ '^[0-9a-f]{64}$' or
    p_serialized_payload is null or pg_catalog.octet_length(p_serialized_payload) not between 10 and 1500000 then
  return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_payload'); end if;
 v_digest:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_serialized_payload,'UTF8'),'sha256'),'hex');
 if v_digest<>p_expected_sha256 then
  return pg_catalog.jsonb_build_object('result','blocked','reason','revision_digest_mismatch'); end if;
 v_payload:=p_serialized_payload::jsonb;
 if pg_catalog.jsonb_typeof(v_payload)<>'object' or
    v_payload ? 'revision_ref' or v_payload ? 'revision_sha256' or
    v_payload->>'schema'<>'artales.semantic-text.v2' or
    v_payload->>'work_id'<>p_work_id::text or v_payload->>'work_slug'<>w_slug or
    v_payload->>'composer_recipe'<>'semantic-deterministic-v2.0' or
    v_payload->>'state'<>'draft_qa_only' or
    v_payload->'release_allowed'<>'false'::jsonb or
    pg_catalog.jsonb_typeof(v_payload->'blocks')<>'array' or
    pg_catalog.jsonb_array_length(v_payload->'blocks')=0 or
    pg_catalog.jsonb_typeof(v_payload->'review_issues')<>'array' then
  return pg_catalog.jsonb_build_object('result','blocked','reason','untrusted_semantic_revision'); end if;
 if not artales_internal.check_semantic_v2_source(v_payload,p_source_snapshot_id,p_component_id) then
  return pg_catalog.jsonb_build_object('result','blocked','reason','source_integrity_failed'); end if;
 v_round:=(v_payload->>'round')::integer;
 insert into artales_evidence.semantic_v2_heads(work_id,source_snapshot_id)
  values(p_work_id,p_source_snapshot_id) on conflict(work_id) do nothing;
 select * into v_head from artales_evidence.semantic_v2_heads
  where work_id=p_work_id for update;
 select * into prior from artales_evidence.semantic_v2_drafts
  where actor_id=actor and request_id=p_request_id;
 if prior.id is not null then
  if prior.work_id=p_work_id and prior.source_snapshot_id=p_source_snapshot_id and
    prior.revision_sha256=p_expected_sha256 and prior.parent_draft_id is not distinct from p_parent_draft_id then
   return pg_catalog.jsonb_build_object('result','already_saved','draft_id',prior.id,'revision_sha256',prior.revision_sha256,'semantic_blocks_sha256',prior.semantic_blocks_sha256);
  end if;
  return pg_catalog.jsonb_build_object('result','blocked','reason','idempotency_key_reuse');
 end if;
 if v_head.source_snapshot_id<>p_source_snapshot_id then
  return pg_catalog.jsonb_build_object('result','blocked','reason','source_changed'); end if;
 if v_head.head_draft_id is distinct from p_parent_draft_id then
  return pg_catalog.jsonb_build_object('result','blocked','reason','stale_parent'); end if;
 if p_parent_draft_id is null then
  if v_round<>0 or v_payload->'parent_revision_ref'<>'null'::jsonb or
     pg_catalog.jsonb_array_length(v_payload->'review_issues')<>0 then
   return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_initial_revision'); end if;
 else
  select * into parent_record from artales_evidence.semantic_v2_drafts
    where id=p_parent_draft_id and work_id=p_work_id;
  if parent_record.id is null or parent_record.source_snapshot_id<>p_source_snapshot_id or
    v_round<>parent_record.round+1 or
    v_payload->>'parent_revision_ref'<>'sha256:'||parent_record.revision_sha256 then
   return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_parent_ancestry'); end if;
  select * into returned_issue from artales_evidence.semantic_v2_review_issues
   where draft_id=parent_record.id;
  if returned_issue.id is null then
   return pg_catalog.jsonb_build_object('result','blocked','reason','returned_issue_required'); end if;
  if v_payload->'review_issues' <>
    (parent_record.payload->'review_issues'||pg_catalog.jsonb_build_array(returned_issue.issue_json)) then
   return pg_catalog.jsonb_build_object('result','blocked','reason','returned_issue_not_applied'); end if;
  if v_payload->'blocks' = parent_record.payload->'blocks' then
   return pg_catalog.jsonb_build_object('result','blocked','reason','no_semantic_layout_change'); end if;
 end if;
 insert into artales_evidence.text_revisions(
   work_id,source_snapshot_id,parent_revision_id,semantic_blocks,semantic_sha256,recipe_version)
 values(p_work_id,p_source_snapshot_id,parent_record.text_revision_id,v_payload->'blocks',
   pg_catalog.repeat('0',64),'semantic-deterministic-v2.0')
 returning id,semantic_sha256 into new_text_id,new_text_sha;
 insert into artales_evidence.semantic_v2_drafts(
  work_id,source_snapshot_id,text_revision_id,parent_draft_id,actor_id,request_id,
  revision_sha256,semantic_blocks_sha256,serialized_payload,payload,round)
 values(p_work_id,p_source_snapshot_id,new_text_id,p_parent_draft_id,actor,p_request_id,
   p_expected_sha256,new_text_sha,p_serialized_payload,v_payload,v_round)
 returning id into new_draft_id;
 update artales_evidence.semantic_v2_heads
  set head_draft_id=new_draft_id where work_id=p_work_id;
 return pg_catalog.jsonb_build_object('result','saved_draft','draft_id',new_draft_id,
    'revision_sha256',p_expected_sha256,'semantic_blocks_sha256',new_text_sha,
    'publication_allowed',false);
end $save$;

create function public.return_semantic_v2_revision(
 p_work_id uuid,p_draft_id uuid,p_expected_sha256 text,
 p_target_atom_id text,p_reason text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $ret$
declare actor uuid:=auth.uid(); v_role public.app_role;
 h artales_evidence.semantic_v2_heads%rowtype;
 d artales_evidence.semantic_v2_drafts%rowtype;
 prior artales_evidence.semantic_v2_review_issues%rowtype;
 a jsonb; v_issue_id uuid; v_issue_json jsonb;
begin
 if actor is null then return pg_catalog.jsonb_build_object('result','blocked','reason','authentication_required'); end if;
 select role into v_role from public.profiles where id=actor and is_active=true;
 if v_role not in ('admin'::public.app_role,'editor'::public.app_role) or v_role is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','editor_role_required'); end if;
 if v_role='editor'::public.app_role and not exists(
   select 1 from public.editorial_tasks t where t.work_id=p_work_id and t.kind='edit_text'
    and t.status='claimed' and t.assignee_user_id=actor
 ) then return pg_catalog.jsonb_build_object('result','blocked','reason','claimed_work_task_required'); end if;
 if p_request_id is null or pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 1000 or
    p_target_atom_id is null or pg_catalog.length(p_target_atom_id) not between 3 and 180 then
  return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_issue'); end if;
 select * into h from artales_evidence.semantic_v2_heads where work_id=p_work_id for update;
 select * into prior from artales_evidence.semantic_v2_review_issues
   where actor_id=actor and request_id=p_request_id;
 if prior.id is not null then
  if prior.work_id=p_work_id and prior.draft_id=p_draft_id and
     prior.target_atom_id=p_target_atom_id and prior.reason=pg_catalog.btrim(p_reason) then
   return pg_catalog.jsonb_build_object('result','already_returned','issue_id',prior.id);
  end if;
  return pg_catalog.jsonb_build_object('result','blocked','reason','idempotency_key_reuse'); end if;
 if h.head_draft_id is distinct from p_draft_id then
  return pg_catalog.jsonb_build_object('result','blocked','reason','stale_revision'); end if;
 select * into d from artales_evidence.semantic_v2_drafts
  where id=p_draft_id and work_id=p_work_id;
 if d.id is null or d.revision_sha256<>p_expected_sha256 then
  return pg_catalog.jsonb_build_object('result','blocked','reason','revision_mismatch'); end if;
 if d.actor_id=actor then
  return pg_catalog.jsonb_build_object('result','blocked','reason','self_review_forbidden'); end if;
 if exists(select 1 from artales_evidence.semantic_v2_review_issues where draft_id=d.id) then
  return pg_catalog.jsonb_build_object('result','blocked','reason','already_returned'); end if;
 select atom into a from artales_internal.semantic_v2_atoms(d.payload->'blocks') atom
  where atom->>'id'=p_target_atom_id limit 1;
 if a is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','unanchored_issue'); end if;
 v_issue_id:=pg_catalog.gen_random_uuid();
 v_issue_json:=pg_catalog.jsonb_build_object(
  'id',v_issue_id::text,'parent_revision_ref','sha256:'||d.revision_sha256,
  'round',d.round+1,'target_atom_id',p_target_atom_id,'kind','typography',
  'reason',pg_catalog.btrim(p_reason),'requested_layout','indent_small',
  'disposition','returned_for_changes','source_anchor',a->'anchor');
 insert into artales_evidence.semantic_v2_review_issues(
   id,work_id,draft_id,actor_id,request_id,target_atom_id,source_anchor,reason,kind,requested_layout,issue_json)
 values(v_issue_id,p_work_id,p_draft_id,actor,p_request_id,p_target_atom_id,a->'anchor',
   pg_catalog.btrim(p_reason),'typography','indent_small',v_issue_json);
 return pg_catalog.jsonb_build_object('result','returned_for_changes','issue_id',v_issue_id,'issue',v_issue_json,
   'draft_id',p_draft_id,'revision_sha256',d.revision_sha256,'publication_allowed',false);
end $ret$;

-- Exact, active signed work read; original serialized bytes retain the Composer digest.
-- This is NOT an approval, publication or source-capture endpoint.
create function public.get_semantic_v2_editor_state(p_work_id uuid)
 returns jsonb language plpgsql stable security definer set search_path='' as $read$
declare v_actor uuid:=auth.uid(); v_role public.app_role;
 v_slug text; v_head artales_evidence.semantic_v2_heads%rowtype;
 v_draft artales_evidence.semantic_v2_drafts%rowtype;
 v_sha text; v_pending jsonb; v_previous jsonb;
begin
 if v_actor is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','authentication_required');
 end if;
 select role into v_role from public.profiles where id=v_actor and is_active=true;
 if v_role is null or v_role not in ('admin'::public.app_role,'editor'::public.app_role) then
  return pg_catalog.jsonb_build_object('result','blocked','reason','editor_role_required');
 end if;
 if v_role='editor'::public.app_role and not exists(
   select 1 from public.editorial_tasks t
   where t.work_id=p_work_id and t.kind='edit_text' and t.status='claimed'
     and t.assignee_user_id=v_actor
 ) then
  return pg_catalog.jsonb_build_object('result','blocked','reason','claimed_work_task_required');
 end if;
 select slug into v_slug from public.works where id=p_work_id;
 if v_slug is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','work_not_found');
 end if;
 select * into v_head from artales_evidence.semantic_v2_heads where work_id=p_work_id;
 if v_head.work_id is null or v_head.head_draft_id is null then
  return pg_catalog.jsonb_build_object('result','not_started','work_id',p_work_id,
    'work_slug',v_slug,'publication_allowed',false);
 end if;
 select * into v_draft from artales_evidence.semantic_v2_drafts
  where id=v_head.head_draft_id and work_id=p_work_id;
 if v_draft.id is null or v_draft.source_snapshot_id<>v_head.source_snapshot_id then
  return pg_catalog.jsonb_build_object('result','blocked','reason','untrusted_head');
 end if;
 select sha256 into v_sha from artales_evidence.source_snapshots
  where id=v_draft.source_snapshot_id and work_id=p_work_id;
 if v_sha is null or v_draft.payload->>'work_id'<>p_work_id::text or
  v_draft.payload->>'work_slug'<>v_slug or
  v_draft.payload->'release_allowed'<>'false'::jsonb then
  return pg_catalog.jsonb_build_object('result','blocked','reason','untrusted_revision');
 end if;
 select issue_json into v_pending from artales_evidence.semantic_v2_review_issues
  where draft_id=v_draft.id;
 if v_draft.parent_draft_id is not null then
  select issue_json into v_previous from artales_evidence.semantic_v2_review_issues
   where draft_id=v_draft.parent_draft_id;
 end if;
 return pg_catalog.jsonb_build_object(
  'result','ready','work_id',p_work_id,'work_slug',v_slug,
  'draft_id',v_draft.id,'revision_sha256',v_draft.revision_sha256,
  'serialized_payload',v_draft.serialized_payload,
  'source_snapshot_id',v_draft.source_snapshot_id,'source_sha256',v_sha,
  'parent_draft_id',v_draft.parent_draft_id,'round',v_draft.round,
  'pending_issue',v_pending,'previous_return',v_previous,
  'publication_allowed',false);
end $read$;

revoke all on function public.stage_semantic_v2_draft(uuid,uuid,uuid,text,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.return_semantic_v2_revision(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.stage_semantic_v2_draft(uuid,uuid,uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.return_semantic_v2_revision(uuid,uuid,text,text,text,uuid) to authenticated;
revoke all on function public.get_semantic_v2_editor_state(uuid) from public,anon,authenticated;
grant execute on function public.get_semantic_v2_editor_state(uuid) to authenticated;
commit;
