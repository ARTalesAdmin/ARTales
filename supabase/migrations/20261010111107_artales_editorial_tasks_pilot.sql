-- ARTales: editorial task inbox, append-only history and atomic claim.
-- Production apply is NOT authorized; test on ephemeral Supabase only.
begin;
create table public.editorial_tasks (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid null references public.work_candidates(id) on delete restrict,
  work_id uuid null references public.works(id) on delete restrict,
  kind text not null default 'edit_text' check (kind in ('edit_text','visuals','proofread','legal_review')),
  title text not null check (length(btrim(title)) between 3 and 240),
  status text not null default 'open' check (status in ('open','claimed','completed','cancelled')),
  source_system text not null default 'artales' check (source_system in ('artales','nexus','manual')),
  source_external_id text null,
  assignee_user_id uuid null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  claimed_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_task_target_check check (num_nonnulls(candidate_id,work_id)=1),
  constraint editorial_task_claim_status_check check (
    (status='open' and assignee_user_id is null and claimed_at is null)
    or (status='claimed' and assignee_user_id is not null and claimed_at is not null)
    or status in ('completed','cancelled')
  )
);
create unique index editorial_tasks_origin_external_unique on public.editorial_tasks(source_system,source_external_id) where source_external_id is not null;
create index editorial_tasks_open_idx on public.editorial_tasks(status,created_at);
create index editorial_tasks_assignee_idx on public.editorial_tasks(assignee_user_id,status);
create table public.editorial_task_events(
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.editorial_tasks(id) on delete restrict,
  event_type text not null check(event_type in ('created','claimed','returned','completed')),
  actor_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now()
);
create index editorial_task_events_timeline_idx on public.editorial_task_events(task_id,occurred_at);
alter table public.editorial_tasks enable row level security;
alter table public.editorial_task_events enable row level security;
revoke all on public.editorial_tasks,public.editorial_task_events from public,anon,authenticated;
grant select on public.editorial_tasks,public.editorial_task_events to authenticated;
create policy "Editorial can read tasks" on public.editorial_tasks for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.role in ('editor','admin')));
create policy "Editorial can read task events" on public.editorial_task_events for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.role in ('editor','admin')));
-- No direct writes to either table; only role-bound RPCs execute validated transitions.
create function public.create_editorial_task_for_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $
declare v_actor uuid:=auth.uid(); v_candidate public.work_candidates%rowtype; v_task uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin') then
   raise exception 'admin_role_required' using errcode='42501';
 end if;
 select * into v_candidate from public.work_candidates where id=p_candidate_id for update;
 if not found or v_candidate.status not in ('ready','accepted') or v_candidate.rights_status<>'clear'
    or v_candidate.review_required or v_candidate.discovery_status<>'complete'
    or v_candidate.identity_status<>'matched' or v_candidate.preferred_source_id is null then
    return jsonb_build_object('result','blocked');
 end if;
 -- This is only a candidate review task. It is NOT a clearance for publication or ingestion.
 select id into v_task from public.editorial_tasks where candidate_id=p_candidate_id and kind='edit_text' and status in ('open','claimed') limit 1;
 if v_task is not null then return jsonb_build_object('result','already_queued','task_id',v_task); end if;
 insert into public.editorial_tasks(candidate_id,kind,title,created_by,source_system,source_external_id)
 values(p_candidate_id,'edit_text','Prověřit kandidáta: '||left(v_candidate.proposed_title,200),v_actor,'artales','candidate-review:'||p_candidate_id::text)
 returning id into v_task;
 insert into public.editorial_task_events(task_id,event_type,actor_id) values(v_task,'created',v_actor);
 return jsonb_build_object('result','queued_for_review','task_id',v_task);
end $;
revoke all on function public.create_editorial_task_for_candidate(uuid) from public,anon,authenticated;
grant execute on function public.create_editorial_task_for_candidate(uuid) to authenticated;
create function public.claim_editorial_task(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_task public.editorial_tasks%rowtype;
begin
  if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role in ('editor','admin')) then
    raise exception 'editor_role_required' using errcode='42501';
  end if;
  update public.editorial_tasks set status='claimed',assignee_user_id=v_actor,claimed_at=now(),updated_at=now()
    where id=p_task_id and status='open' returning * into v_task;
  if not found then return jsonb_build_object('result','unavailable'); end if;
  insert into public.editorial_task_events(task_id,event_type,actor_id) values(p_task_id,'claimed',v_actor);
  return jsonb_build_object('result','claimed','task_id',p_task_id,'assignee_user_id',v_actor);
end $$;
-- Privileged function is required because direct table mutations are revoked.
-- Use strict role checks, immutable search_path and explicit EXECUTE grants.
revoke all on function public.claim_editorial_task(uuid) from public,anon,authenticated;
grant execute on function public.claim_editorial_task(uuid) to authenticated;
create function public.return_editorial_task(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_task public.editorial_tasks%rowtype;
begin
  if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role in ('editor','admin')) then
    raise exception 'editor_role_required' using errcode='42501';
  end if;
  update public.editorial_tasks set status='open',assignee_user_id=null,claimed_at=null,updated_at=now()
    where id=p_task_id and status='claimed' and
      (assignee_user_id=v_actor or exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin'))
    returning * into v_task;
  if not found then return jsonb_build_object('result','unavailable'); end if;
  insert into public.editorial_task_events(task_id,event_type,actor_id) values(p_task_id,'returned',v_actor);
  return jsonb_build_object('result','returned','task_id',p_task_id);
end $$;
revoke all on function public.return_editorial_task(uuid) from public,anon,authenticated;
grant execute on function public.return_editorial_task(uuid) to authenticated;
commit;
