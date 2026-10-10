-- ARTales editorial inbox v1. Never apply to production without explicit approval.
-- Generated via Supabase CLI (2.120.0): 20261010111107_artales_editorial_tasks_pilot.sql
begin;

create table public.editorial_tasks (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid null references public.work_candidates(id) on delete restrict,
  work_id uuid null references public.works(id) on delete restrict,
  kind text not null check (kind in ('edit_text', 'visuals', 'proofread', 'legal_review')),
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
  constraint editorial_task_one_target check(num_nonnulls(candidate_id,work_id)=1),
  constraint editorial_task_state_consistency check(
    (status='open' and assignee_user_id is null and claimed_at is null and completed_at is null)
    or (status='claimed' and assignee_user_id is not null and claimed_at is not null and completed_at is null)
    or (status in ('completed','cancelled'))
  )
);
create unique index editorial_task_source_dedupe_idx
  on public.editorial_tasks(source_system,source_external_id)
  where source_external_id is not null;
create index editorial_tasks_queue_idx on public.editorial_tasks(status,created_at);
create index editorial_tasks_assignee_idx on public.editorial_tasks(assignee_user_id,status);

create table public.editorial_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.editorial_tasks(id) on delete restrict,
  event_type text not null check(event_type in ('created','claimed','returned')),
  actor_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now()
);
create index editorial_task_events_timeline_idx on public.editorial_task_events(task_id,occurred_at,id);

alter table public.editorial_tasks enable row level security;
alter table public.editorial_task_events enable row level security;
revoke all on table public.editorial_tasks,public.editorial_task_events from public,anon,authenticated;
grant select on public.editorial_tasks, public.editorial_task_events to authenticated;

-- Limited column grants; immutable business fields cannot be rewritten by clients.
grant insert(candidate_id,kind,title,source_system,source_external_id,created_by)
  on public.editorial_tasks to authenticated;
grant update(status,assignee_user_id,claimed_at,updated_at)
  on public.editorial_tasks to authenticated;
-- Events never have direct client write grants.

create policy "Active editorial staff read tasks" on public.editorial_tasks
  for select to authenticated
  using (exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin')));

create policy "Only admin enqueues candidate review" on public.editorial_tasks
  for insert to authenticated
  with check (
    created_by=(select auth.uid()) and
    candidate_id is not null and work_id is null and kind='legal_review' and
    source_system='artales' and
    source_external_id='candidate-review:'||candidate_id::text and
    status='open' and assignee_user_id is null and claimed_at is null and
    exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.is_active and p.role='admin') and
    exists(select 1 from public.work_candidates c
      where c.id=candidate_id and c.status in ('ready','accepted') and
      c.rights_status='clear' and c.discovery_status='complete' and
      c.identity_status='matched' and not c.review_required and
      c.preferred_source_id is not null and c.matched_work_id is null)
  );

create policy "Editorial staff may claim or return" on public.editorial_tasks
  for update to authenticated
  using (
    exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin'))
    and (status='open' or (
      status='claimed' and (assignee_user_id=(select auth.uid()) or exists(
        select 1 from public.profiles a where a.id=(select auth.uid())
        and a.is_active and a.role='admin'
      ))
    ))
  )
  with check (
    (
      status='claimed' and assignee_user_id=(select auth.uid())
      and claimed_at is not null and completed_at is null
    )
    or (status='open' and assignee_user_id is null and claimed_at is null)
  );

create policy "Active editorial staff read task events" on public.editorial_task_events
  for select to authenticated
  using (exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin')));

-- Audit trigger lives in an unexposed schema, not as an externally callable API.
-- It cannot elevate the caller's ability to change tasks; RLS/column grants apply
-- first. It enforces transitions and writes append-only events atomically.
create schema if not exists artales_internal;
revoke all on schema artales_internal from public,anon,authenticated;

create function artales_internal.editorial_task_history()
returns trigger language plpgsql security definer set search_path=''
as $trigger$
declare
  v_actor uuid:=auth.uid();
  v_event text;
begin
  if v_actor is null or not exists(select 1 from public.profiles p
    where p.id=v_actor and p.is_active and p.role in ('admin','editor')) then
    raise exception 'editorial_actor_required' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if new.created_by<>v_actor or new.status<>'open' or new.kind<>'legal_review' then
      raise exception 'editorial_invalid_create' using errcode='23514';
    end if;
    v_event:='created';
  else
    if row(new.id,new.candidate_id,new.work_id,new.kind,new.title,new.source_system,
      new.source_external_id,new.created_by,new.created_at,new.completed_at)
      is distinct from
      row(old.id,old.candidate_id,old.work_id,old.kind,old.title,old.source_system,
      old.source_external_id,old.created_by,old.created_at,old.completed_at) then
      raise exception 'editorial_immutable_field_changed' using errcode='23514';
    end if;
    if old.status='open' and new.status='claimed' and
       new.assignee_user_id=v_actor then
       new.claimed_at:=now();
       v_event:='claimed';
    elsif old.status='claimed' and new.status='open' and
      new.assignee_user_id is null and new.claimed_at is null and
      (old.assignee_user_id=v_actor or exists(select 1 from public.profiles p
        where p.id=v_actor and p.is_active and p.role='admin')) then
       v_event:='returned';
    else
       raise exception 'editorial_invalid_transition' using errcode='23514';
    end if;
    new.updated_at:=now();
  end if;
  if tg_op='INSERT' then
    -- Before insert cannot reference a generated row ID in an event FK until
    -- the row itself exists. AFTER INSERT will record this event.
    return new;
  end if;
  insert into public.editorial_task_events(task_id,event_type,actor_id)
  values(new.id,v_event,v_actor);
  return new;
end
$trigger$;

create function artales_internal.editorial_task_created_event()
returns trigger language plpgsql security definer set search_path=''
as $trigger$
begin
  insert into public.editorial_task_events(task_id,event_type,actor_id)
  values(new.id,'created',new.created_by);
  return new;
end
$trigger$;

revoke all on function artales_internal.editorial_task_history() from public,anon,authenticated;
revoke all on function artales_internal.editorial_task_created_event() from public,anon,authenticated;

create trigger editorial_task_validate_before_write
  before insert or update on public.editorial_tasks
  for each row execute function artales_internal.editorial_task_history();
create trigger editorial_task_created_after_insert
  after insert on public.editorial_tasks
  for each row execute function artales_internal.editorial_task_created_event();

-- Three bounded RPCs use normal invoker privileges and therefore DO NOT bypass
-- RLS or column grants. The database enforces write provenance and audit.
create function public.create_editorial_task_for_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $rpc$
declare
  v_actor uuid:=auth.uid();
  v_candidate public.work_candidates%rowtype;
  v_task uuid;
begin
  if v_actor is null or not exists(select 1 from public.profiles p
    where p.id=v_actor and p.is_active and p.role='admin') then
    raise exception 'admin_role_required' using errcode='42501';
  end if;
  select * into v_candidate from public.work_candidates
    where id=p_candidate_id for update;
  if not found or v_candidate.status not in ('ready','accepted') or
    v_candidate.rights_status<>'clear' or v_candidate.review_required or
    v_candidate.discovery_status<>'complete' or
    v_candidate.identity_status<>'matched' or
    v_candidate.preferred_source_id is null or v_candidate.matched_work_id is not null then
    return jsonb_build_object('result','blocked');
  end if;

  -- A unique origin key means concurrent enqueues never create duplicates.
  insert into public.editorial_tasks(candidate_id,kind,title,created_by,
    source_system,source_external_id)
  values(p_candidate_id,'legal_review',
    left('Doprověřit kandidáta: '||v_candidate.proposed_title,240),
    v_actor,'artales','candidate-review:'||p_candidate_id::text)
  on conflict (source_system,source_external_id)
    where source_external_id is not null do nothing
  returning id into v_task;

  if v_task is not null then
    return jsonb_build_object('result','queued_for_review','task_id',v_task);
  end if;
  select id into v_task from public.editorial_tasks where
    source_system='artales' and source_external_id='candidate-review:'||p_candidate_id::text;
  return jsonb_build_object('result','already_queued','task_id',v_task);
end
$rpc$;

create function public.claim_editorial_task(p_task_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $rpc$
declare v_actor uuid:=auth.uid(); v_task uuid;
begin
  if v_actor is null or not exists(select 1 from public.profiles p
    where p.id=v_actor and p.is_active and p.role in ('editor','admin')) then
    raise exception 'editor_role_required' using errcode='42501';
  end if;
  update public.editorial_tasks set status='claimed',assignee_user_id=v_actor,
    claimed_at=now(),updated_at=now()
    where id=p_task_id and status='open' returning id into v_task;
  if v_task is null then return jsonb_build_object('result','unavailable'); end if;
  return jsonb_build_object('result','claimed','task_id',v_task,
    'assignee_user_id',v_actor);
end
$rpc$;

create function public.return_editorial_task(p_task_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $rpc$
declare v_actor uuid:=auth.uid(); v_task uuid;
begin
  if v_actor is null or not exists(select 1 from public.profiles p
    where p.id=v_actor and p.is_active and p.role in ('editor','admin')) then
    raise exception 'editor_role_required' using errcode='42501';
  end if;
  update public.editorial_tasks set status='open',assignee_user_id=null,
    claimed_at=null,updated_at=now()
    where id=p_task_id and status='claimed'
    and (assignee_user_id=v_actor or exists(select 1 from public.profiles p
      where p.id=v_actor and p.is_active and p.role='admin'))
    returning id into v_task;
  if v_task is null then return jsonb_build_object('result','unavailable'); end if;
  return jsonb_build_object('result','returned','task_id',v_task);
end
$rpc$;

revoke all on function public.create_editorial_task_for_candidate(uuid) from public,anon,authenticated;
revoke all on function public.claim_editorial_task(uuid) from public,anon,authenticated;
revoke all on function public.return_editorial_task(uuid) from public,anon,authenticated;
grant execute on function public.create_editorial_task_for_candidate(uuid),
  public.claim_editorial_task(uuid),
  public.return_editorial_task(uuid) to authenticated;

commit;
