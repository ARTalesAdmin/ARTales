-- E2 approval contract, disposable local database only. Not a migration.
begin;
create table artales_evidence.semantic_v2_approvals (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null unique references public.works(id),
 draft_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 request_id uuid not null,
 revision_sha256 text not null check (revision_sha256 ~ '^[0-9a-f]{64}$'),
 reason text not null check (length(btrim(reason)) between 8 and 1000),
 created_at timestamptz not null default now(),
 unique(actor_id,request_id),
 foreign key(draft_id,work_id) references artales_evidence.semantic_v2_drafts(id,work_id)
);
alter table artales_evidence.semantic_v2_approvals enable row level security;
revoke all on artales_evidence.semantic_v2_approvals from public,anon,authenticated;
create trigger immutable_e2_approvals before update or delete on artales_evidence.semantic_v2_approvals
 for each row execute function artales_evidence.reject_mutation();
-- Exact task completion is a signed-only transition; immutable columns unchanged.
alter table artales_evidence.semantic_v2_approvals
 add column task_id uuid references public.editorial_tasks(id) on delete restrict,
 add column author_id uuid references public.profiles(id) on delete restrict,
 add column review_event_id uuid references artales_evidence.review_events(id) on delete restrict;
alter table artales_evidence.semantic_v2_approvals
 alter column task_id set not null,
 alter column author_id set not null,
 alter column review_event_id set not null;
alter table public.editorial_task_events drop constraint editorial_task_events_event_type_check;
alter table public.editorial_task_events add constraint editorial_task_events_event_type_check
 check(event_type in ('created','claimed','returned','approved'));
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
     new.source_external_id,new.created_by,new.created_at)
     is distinct from row(old.id,old.candidate_id,old.work_id,old.kind,old.title,old.source_system,
       old.source_external_id,old.created_by,old.created_at)
     or (new.completed_at is distinct from old.completed_at and not
       (old.status='claimed' and new.status='completed'
         and old.completed_at is null and new.completed_at is not null))
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
   elsif old.status='claimed' and new.status='completed'
     and new.assignee_user_id=old.assignee_user_id
     and new.claimed_at=old.claimed_at
     and old.completed_at is null and new.completed_at is not null
     and exists(select 1 from artales_evidence.semantic_v2_approvals a
       where a.task_id=new.id and a.work_id=new.work_id and a.actor_id=v_actor
         and a.author_id=old.assignee_user_id)
   then v_event:='approved';
   else raise exception 'editorial_invalid_transition' using errcode='23514';end if;
   new.updated_at:=now();
   insert into public.editorial_task_events(task_id,event_type,actor_id)values(new.id,v_event,v_actor);
   return new;
 end if;
end $trigger$;

-- The same head lock is used by all editor operations. A final approval
-- therefore serializes against any in-flight Save or Return.
create function artales_internal.prevent_semantic_v2_postapproval()
returns trigger language plpgsql set search_path='' as $freeze$
begin
 if exists(select 1 from artales_evidence.semantic_v2_approvals a
   where a.work_id=new.work_id) then
  raise exception 'semantic_v2_approved_revision_immutable' using errcode='23514';
 end if;
 return new;
end $freeze$;
revoke all on function artales_internal.prevent_semantic_v2_postapproval()
 from public,anon,authenticated;
create trigger e2_draft_after_approval before insert
 on artales_evidence.semantic_v2_drafts for each row
 execute function artales_internal.prevent_semantic_v2_postapproval();
create trigger e2_issue_after_approval before insert
 on artales_evidence.semantic_v2_review_issues for each row
 execute function artales_internal.prevent_semantic_v2_postapproval();

create function public.approve_semantic_v2_revision(
 p_work_id uuid,p_draft_id uuid,p_revision_sha256 text,p_reason text,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); h artales_evidence.semantic_v2_heads%rowtype;
 d artales_evidence.semantic_v2_drafts%rowtype;
 a artales_evidence.semantic_v2_approvals%rowtype;
 v_review_event_id uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p
  where p.id=v_actor and p.role='admin' and p.is_active) then
  return jsonb_build_object('result','blocked','reason','admin_required');end if;
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then
  return jsonb_build_object('result','blocked','reason','invalid_approval');end if;
 select * into h from artales_evidence.semantic_v2_heads where work_id=p_work_id for update;
 select * into a from artales_evidence.semantic_v2_approvals where actor_id=v_actor and request_id=p_request_id;
 if a.id is not null then
  if a.work_id=p_work_id and a.draft_id=p_draft_id and a.revision_sha256=p_revision_sha256
    and a.reason=btrim(p_reason) then
   return jsonb_build_object('result','already_approved','approval_id',a.id,'publication_allowed',false);end if;
  return jsonb_build_object('result','blocked','reason','idempotency_key_reuse');end if;
 if exists(select 1 from artales_evidence.semantic_v2_approvals where work_id=p_work_id) then
  return jsonb_build_object('result','blocked','reason','already_approved');end if;
 if h.head_draft_id is distinct from p_draft_id then
  return jsonb_build_object('result','blocked','reason','stale_revision');end if;
 select * into d from artales_evidence.semantic_v2_drafts where id=p_draft_id and work_id=p_work_id;
 if d.id is null or d.revision_sha256<>p_revision_sha256 or d.source_snapshot_id<>h.source_snapshot_id then
  return jsonb_build_object('result','blocked','reason','untrusted_revision');end if;
 if d.actor_id=v_actor then
  return jsonb_build_object('result','blocked','reason','self_review_forbidden');end if;
 if exists(select 1 from artales_evidence.semantic_v2_review_issues where draft_id=d.id) then
  return jsonb_build_object('result','blocked','reason','pending_return');end if;
 if not exists(select 1 from artales_evidence.semantic_v2_self_assignments sa
  join public.editorial_tasks t on t.id=sa.task_id where sa.work_id=p_work_id
   and sa.source_snapshot_id=d.source_snapshot_id and sa.actor_id=d.actor_id
   and t.status='claimed' and t.assignee_user_id=sa.actor_id) then
  return jsonb_build_object('result','blocked','reason','claimed_owner_required');end if;
 insert into artales_evidence.review_events(
  work_id,artifact_kind,artifact_id,artifact_sha256,reviewer_id,result,reason)
 values(p_work_id,'text',d.text_revision_id,d.semantic_blocks_sha256,v_actor,
   'approved',btrim(p_reason))
 returning id into v_review_event_id;
 insert into artales_evidence.semantic_v2_approvals(
  work_id,draft_id,actor_id,request_id,revision_sha256,reason,
  task_id,author_id,review_event_id)
 select p_work_id,p_draft_id,v_actor,p_request_id,p_revision_sha256,btrim(p_reason),
  sa.task_id,sa.actor_id,v_review_event_id
 from artales_evidence.semantic_v2_self_assignments sa where sa.work_id=p_work_id
 returning * into a;
 update public.editorial_tasks set status='completed',completed_at=now(),updated_at=now()
  where id=a.task_id and status='claimed' and assignee_user_id=a.author_id;
 if not found then raise exception 'approval_task_transition_failed' using errcode='23514';end if;
 return jsonb_build_object('result','approved_editorial_only','approval_id',a.id,
   'task_id',a.task_id,'publication_allowed',false);
end $$;
revoke all on function public.approve_semantic_v2_revision(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.approve_semantic_v2_revision(uuid,uuid,text,text,uuid) to authenticated;
-- Signed readback of exact immutable editorial approval. This is not a release.
-- The author or the approving reviewer may inspect it; other identities may not.
create function public.get_semantic_v2_editor_approval(p_work_id uuid)
 returns jsonb language plpgsql stable security definer set search_path='' as $approval_read$
declare v_actor uuid:=auth.uid();
 v_approval artales_evidence.semantic_v2_approvals%rowtype;
begin
 if v_actor is null or not exists(
   select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin'
 ) then return pg_catalog.jsonb_build_object('result','blocked','reason','admin_required');end if;
 select * into v_approval from artales_evidence.semantic_v2_approvals a
  where a.work_id=p_work_id;
 if v_approval.id is null then
  if not exists(select 1 from artales_evidence.semantic_v2_self_assignments a
    where a.work_id=p_work_id and a.actor_id=v_actor) then
   return pg_catalog.jsonb_build_object('result','blocked','reason','approval_scope_required');end if;
  return pg_catalog.jsonb_build_object('result','not_approved','publication_allowed',false);
 end if;
 if v_approval.actor_id<>v_actor and v_approval.author_id<>v_actor then
  return pg_catalog.jsonb_build_object('result','blocked','reason','approval_scope_required');end if;
 return pg_catalog.jsonb_build_object(
   'result','approved_editorial_only','approval_id',v_approval.id,
   'work_id',v_approval.work_id,'draft_id',v_approval.draft_id,
   'revision_sha256',v_approval.revision_sha256,
   'reviewer_id',v_approval.actor_id,'author_id',v_approval.author_id,
   'task_id',v_approval.task_id,'review_event_id',v_approval.review_event_id,
   'approved_at',v_approval.created_at,'publication_allowed',false
 );
end $approval_read$;
revoke all on function public.get_semantic_v2_editor_approval(uuid) from public,anon,authenticated;
grant execute on function public.get_semantic_v2_editor_approval(uuid) to authenticated;
commit;
