-- Local-only candidate DB-A authenticated source intake assembly.
-- Requires DB-A foundation; not a production migration.
-- Source capture only, never legal clearance or approval.
begin;
create table if not exists artales_evidence.source_intake_events (
 id uuid primary key default gen_random_uuid(),
 snapshot_id uuid not null references artales_evidence.source_snapshots(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null default 'captured_pending' check(action='captured_pending'),
 captured_at timestamptz not null default now(),
 unique(snapshot_id)
);
alter table artales_evidence.source_intake_events enable row level security;
revoke all on artales_evidence.source_intake_events from public, anon, authenticated;
create trigger immutable_source_intake_events before update or delete on artales_evidence.source_intake_events
for each row execute function artales_evidence.reject_mutation();

create or replace function public.capture_work_source_pending(
 p_work_id uuid, p_source_uri text, p_source_bytes bytea, p_provenance jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_snapshot uuid; v_digest text; v_role public.app_role;
begin
 v_actor:=auth.uid();
 if v_actor is null or auth.role() is distinct from 'authenticated' then
  return pg_catalog.jsonb_build_object('result','blocked','reason','authentication_required');
 end if;
 select p.role into v_role from public.profiles p
 where p.id=v_actor and p.is_active=true;
 if v_role not in ('admin'::public.app_role,'editor'::public.app_role) or v_role is null then
  return pg_catalog.jsonb_build_object('result','blocked','reason','editor_role_required');
 end if;
 if p_work_id is null or not exists (select 1 from public.works w where w.id=p_work_id) then
  return pg_catalog.jsonb_build_object('result','blocked','reason','work_not_found');
 end if;
 if p_source_uri is null or pg_catalog.length(pg_catalog.btrim(p_source_uri))<8 or
    p_source_bytes is null or pg_catalog.octet_length(p_source_bytes)=0 or
    pg_catalog.octet_length(p_source_bytes)>10485760 or
    p_provenance is null or pg_catalog.jsonb_typeof(p_provenance)<>'object' then
  return pg_catalog.jsonb_build_object('result','blocked','reason','invalid_source_input');
 end if;
 insert into artales_evidence.source_snapshots(
  work_id,kind,source_uri,source_bytes,provenance)
 values (p_work_id,'external_raw',p_source_uri,p_source_bytes,p_provenance)
 returning id,sha256 into v_snapshot,v_digest;
 insert into artales_evidence.source_intake_events(snapshot_id,actor_id)
 values(v_snapshot,v_actor);
 return pg_catalog.jsonb_build_object('result','pending_review','snapshot_id',v_snapshot,'sha256',v_digest);
end $$;
revoke all on function public.capture_work_source_pending(uuid,text,bytea,jsonb) from public,anon;
grant execute on function public.capture_work_source_pending(uuid,text,bytea,jsonb) to authenticated;
commit;
