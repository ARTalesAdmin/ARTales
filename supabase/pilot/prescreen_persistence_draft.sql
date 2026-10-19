-- ARTales prescreen persistent pilot: REVIEW SOURCE, not a production migration.
-- Generate final timestamped migration via supabase migration new after isolated replay.
-- Requires canonical work_candidates foundation and normalized candidate columns.
begin;

create table public.prescreen_runs(
 id uuid primary key default gen_random_uuid(),
 requested smallint not null check(requested between 1 and 12),
 status text not null default 'collecting' check(status in ('collecting','review','complete','incomplete')),
 weights jsonb not null check(jsonb_typeof(weights)='object'),
 portfolio_snapshot jsonb not null check(jsonb_typeof(portfolio_snapshot)='object'),
 progress jsonb not null default '{}'::jsonb check(jsonb_typeof(progress)='object'),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.prescreen_decisions(
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.prescreen_runs(id),
 source_work_key text not null check(length(source_work_key) between 5 and 200),
 title text not null check(length(title) between 1 and 300),
 author text not null check(length(author) between 1 and 200),
 identity_key text not null check(length(identity_key) between 3 and 700),
 genre text not null check(genre in ('prose','poetry','drama','fairy_tale','essay','other')),
 chronology jsonb not null default '{}'::jsonb,
 source_url text,
 outcome text not null check(outcome in ('candidate','duplicate','review','deferred')),
 reason text not null,
 portfolio_score numeric not null default 0,
 evidence jsonb not null default '{}'::jsonb,
 accepted_candidate_id uuid references public.work_candidates(id),
 created_at timestamptz not null default now(),
 unique(run_id, source_work_key)
);
create index prescreen_decisions_identity_idx on public.prescreen_decisions(identity_key);
create index prescreen_decisions_run_idx on public.prescreen_decisions(run_id,created_at);

alter table public.prescreen_runs enable row level security;
alter table public.prescreen_decisions enable row level security;
revoke all on public.prescreen_runs, public.prescreen_decisions from public, anon;
grant select,insert,update on public.prescreen_runs to authenticated;
grant select,insert on public.prescreen_decisions to authenticated;
-- Decision updates are reserved to the explicitly authorized RPC.
grant select on public.prescreen_decisions to service_role;
grant select,insert,update on public.prescreen_runs to service_role;
create policy prescreen_runs_admin_select on public.prescreen_runs for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_runs_admin_insert on public.prescreen_runs for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'));
create policy prescreen_runs_admin_update on public.prescreen_runs for update to authenticated
 using(created_by=(select auth.uid()) and status in ('collecting','review') and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='admin'))
 with check(created_by=(select auth.uid()));
create policy prescreen_decisions_admin_select on public.prescreen_decisions for select to authenticated
 using(exists(select 1 from public.prescreen_runs r where r.id=run_id and r.created_by=(select auth.uid())));
create policy prescreen_decisions_admin_insert on public.prescreen_decisions for insert to authenticated
 with check(accepted_candidate_id is null and exists(select 1 from public.prescreen_runs r where r.id=run_id and r.created_by=(select auth.uid()) and r.status='collecting'));

-- Absolute safety boundary: a duplicate cannot be admitted through two concurrent
-- prescreen approvals; the same guard must also be adopted by manual candidate intake.
create unique index if not exists work_candidates_title_author_identity_unique
on public.work_candidates(lower(btrim(proposed_title)),lower(btrim(proposed_author_name)));

create or replace function public.accept_prescreen_decision(p_decision_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $
declare
 v_dec public.prescreen_decisions%rowtype;
 v_actor uuid := auth.uid();
 v_existing uuid;
 v_candidate uuid;
begin
 if v_actor is null then return jsonb_build_object('result','blocked','reason','unauthenticated'); end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin' and p.is_active) then
  return jsonb_build_object('result','blocked','reason','admin_required');
 end if;
 select d.* into v_dec from public.prescreen_decisions d
  join public.prescreen_runs r on r.id=d.run_id
  where d.id=p_decision_id and r.created_by=v_actor and r.status in ('review','complete')
  for update of d;
 if not found or v_dec.outcome<>'candidate' then
  return jsonb_build_object('result','blocked','reason','not_eligible');
 end if;
 if v_dec.accepted_candidate_id is not null then
  return jsonb_build_object('result','existing','candidateId',v_dec.accepted_candidate_id);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_dec.identity_key,0));
 if exists(select 1 from public.works w join public.authors a on a.id=w.primary_author_id
           where lower(btrim(w.title))=lower(btrim(v_dec.title)) and lower(btrim(a.name))=lower(btrim(v_dec.author))) then
  return jsonb_build_object('result','blocked','reason','already_in_library');
 end if;
 select c.id into v_existing from public.work_candidates c
 where lower(btrim(c.proposed_title))=lower(btrim(v_dec.title))
 and lower(btrim(c.proposed_author_name))=lower(btrim(v_dec.author))
 limit 1;
 if v_existing is not null then
   return jsonb_build_object('result','existing','candidateId',v_existing);
 end if;
 insert into public.work_candidates(proposed_title,proposed_author_name,normalized_title,
 normalized_author_name,origin,origin_reference,status,priority,rights_status,
 discovery_status,identity_status,created_by,updated_by)
 values(v_dec.title,v_dec.author,v_dec.title,v_dec.author,'internal_list',
 v_dec.source_work_key,'checking',50,'unknown','pending','matched',v_actor,v_actor)
 returning id into v_candidate;
 update public.prescreen_decisions set accepted_candidate_id=v_candidate where id=v_dec.id;
 return jsonb_build_object('result','created','candidateId',v_candidate);
exception when unique_violation then
 return jsonb_build_object('result','blocked','reason','candidate_identity_conflict');
end
$$;
revoke all on function public.accept_prescreen_decision(uuid) from public,anon;
grant execute on function public.accept_prescreen_decision(uuid) to authenticated;
commit;
