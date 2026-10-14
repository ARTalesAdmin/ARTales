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
create function public.approve_semantic_v2_revision(
 p_work_id uuid,p_draft_id uuid,p_revision_sha256 text,p_reason text,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); h artales_evidence.semantic_v2_heads%rowtype;
 d artales_evidence.semantic_v2_drafts%rowtype;
 a artales_evidence.semantic_v2_approvals%rowtype;
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
 insert into artales_evidence.semantic_v2_approvals(
  work_id,draft_id,actor_id,request_id,revision_sha256,reason)
 values(p_work_id,p_draft_id,v_actor,p_request_id,p_revision_sha256,btrim(p_reason))
 returning * into a;
 return jsonb_build_object('result','approved_editorial_only','approval_id',a.id,'publication_allowed',false);
end $$;
revoke all on function public.approve_semantic_v2_revision(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.approve_semantic_v2_revision(uuid,uuid,text,text,uuid) to authenticated;
commit;
