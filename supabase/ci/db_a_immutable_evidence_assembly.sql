-- ARTales DB-A experimental assembly. Applied only by local disposable CI, not a production migration.
begin;
create schema if not exists artales_evidence;
revoke all on schema artales_evidence from public, anon, authenticated;
create table artales_evidence.source_snapshots (
 id uuid primary key default gen_random_uuid(),
 work_id uuid references public.works(id) on delete restrict,
 candidate_id uuid references public.work_candidates(id) on delete restrict,
 kind text not null check (kind in ('legacy_observed','external_raw')),
 source_uri text,
 source_bytes bytea not null,
 sha256 text generated always as (encode(extensions.digest(source_bytes,'sha256'),'hex')) stored,
 provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
 captured_at timestamptz not null default now(),
 check (num_nonnulls(work_id,candidate_id)>=1),
 check (octet_length(source_bytes)>0 and octet_length(source_bytes)<=10485760),
 unique(id,work_id)
);
create index on artales_evidence.source_snapshots(work_id,captured_at);
create table artales_evidence.source_components (
 id uuid primary key default gen_random_uuid(),
 snapshot_id uuid not null references artales_evidence.source_snapshots(id) on delete restrict,
 kind text not null check (kind in ('WORK_CONTENT','EDITION_CONTENT','TRANSLATION','ASSET','SOURCE_WRAPPER','EDITORIAL_ADDITION')),
 byte_start integer not null check(byte_start>=0),
 byte_end integer not null check(byte_end>byte_start),
 disposition text not null check(disposition in ('qa_text_only','exclude','manual_review')),
 explanation text not null check(length(btrim(explanation))>0),
 unique(snapshot_id,kind,byte_start,byte_end)
);
create table artales_evidence.rights_dossiers (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 snapshot_id uuid not null,
 constraint rights_dossier_snapshot_same_work foreign key (snapshot_id,work_id)
 references artales_evidence.source_snapshots(id,work_id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','independently_reviewed','challenged','rejected')),
 policy_version text not null,
 reviewer_id uuid references public.profiles(id),
 reviewed_at timestamptz,
 expires_at timestamptz,
 claims jsonb not null default '{}'::jsonb check(jsonb_typeof(claims)='object'),
 created_at timestamptz not null default now(),
 check(status<>'independently_reviewed' or (reviewer_id is not null and reviewed_at is not null and expires_at>reviewed_at))
);
create table artales_evidence.rights_evidence (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references artales_evidence.rights_dossiers(id) on delete restrict,
 component_id uuid references artales_evidence.source_components(id) on delete restrict,
 asset_sha256 text,
 jurisdiction text not null check(length(btrim(jurisdiction))>0),
 decision text not null check(decision in ('cleared','excluded','blocked','review_required')),
 evidence_bytes bytea not null check(octet_length(evidence_bytes)>0),
 evidence_sha256 text generated always as (encode(extensions.digest(evidence_bytes,'sha256'),'hex')) stored,
 check(component_id is not null or asset_sha256 is not null),
 check(asset_sha256 is null or asset_sha256 ~ '^[0-9a-f]{64}$')
);
create table artales_evidence.text_revisions (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 source_snapshot_id uuid not null,
 parent_revision_id uuid,
 constraint text_revision_snapshot_same_work foreign key (source_snapshot_id,work_id)
 references artales_evidence.source_snapshots(id,work_id) on delete restrict,
 constraint text_revision_parent_same_work foreign key (parent_revision_id,work_id)
 references artales_evidence.text_revisions(id,work_id) on delete restrict,
 semantic_blocks jsonb not null check(jsonb_typeof(semantic_blocks)='array' and jsonb_array_length(semantic_blocks)>0),
 semantic_sha256 text not null check(semantic_sha256 ~ '^[0-9a-f]{64}$'),
 recipe_version text not null check(length(btrim(recipe_version))>0),
 created_at timestamptz not null default now(),
 unique(id,work_id)
);
create table artales_evidence.metadata_revisions (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 parent_revision_id uuid,
 constraint metadata_revision_parent_same_work foreign key (parent_revision_id,work_id)
 references artales_evidence.metadata_revisions(id,work_id) on delete restrict,
 facts jsonb not null check(jsonb_typeof(facts)='object'),
 citations jsonb not null check(jsonb_typeof(citations)='array'),
 public_copy jsonb not null check(jsonb_typeof(public_copy)='object'),
 recipe_version text not null,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique(id,work_id)
);
create table artales_evidence.visual_revisions (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 asset_bytes bytea not null check(octet_length(asset_bytes)>0 and octet_length(asset_bytes)<=10485760),
 asset_sha256 text generated always as (encode(extensions.digest(asset_bytes,'sha256'),'hex')) stored,
 style_version text not null,
 provenance jsonb not null default '{}'::jsonb check(jsonb_typeof(provenance)='object'),
 created_at timestamptz not null default now()
);
create table artales_evidence.review_events (
 id uuid primary key default gen_random_uuid(),
 work_id uuid not null references public.works(id) on delete restrict,
 artifact_kind text not null check(artifact_kind in ('text','metadata','visual','rights')),
 artifact_id uuid not null,
 artifact_sha256 text not null check(artifact_sha256 ~ '^[0-9a-f]{64}$'),
 reviewer_id uuid not null references public.profiles(id),
 result text not null check(result in ('approved','returned','rejected')),
 reason text not null check(length(btrim(reason))>0),
 created_at timestamptz not null default now()
);
-- PostgreSQL considers JSONB->text conversion STABLE, not IMMUTABLE.
-- Derive hash on INSERT, then forbid row mutations.
create function artales_evidence.hash_revision_on_insert() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='text_revisions' then
  new.semantic_sha256:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(new.semantic_blocks::text,'UTF8'),'sha256'),'hex');
 elsif tg_table_name='metadata_revisions' then
  new.content_sha256:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('facts',new.facts,'citations',new.citations,'copy',new.public_copy,'recipe',new.recipe_version)::text,'UTF8'),'sha256'),'hex');
 else raise exception 'unsupported revision hash table' using errcode='23514';
 end if;
 return new;
end
$$;
create trigger text_revision_hash before insert on artales_evidence.text_revisions
 for each row execute function artales_evidence.hash_revision_on_insert();
create trigger metadata_revision_hash before insert on artales_evidence.metadata_revisions
 for each row execute function artales_evidence.hash_revision_on_insert();

create function artales_evidence.validate_component_span() returns trigger language plpgsql set search_path='' as $$
declare n integer;
begin
 select pg_catalog.octet_length(s.source_bytes) into n from artales_evidence.source_snapshots s where s.id=new.snapshot_id;
 if n is null or new.byte_start < 0 or new.byte_end > n or new.byte_end <= new.byte_start then
  raise exception 'component outside source bytes' using errcode='23514';
 end if;
 return new;
end
$$;
create trigger component_source_range before insert on artales_evidence.source_components
 for each row execute function artales_evidence.validate_component_span();

create function artales_evidence.validate_component_evidence() returns trigger language plpgsql set search_path='' as $$
declare dossier_snapshot uuid; component_snapshot uuid;
begin
 if new.component_id is not null then
  select d.snapshot_id into dossier_snapshot from artales_evidence.rights_dossiers d where d.id=new.dossier_id;
  select c.snapshot_id into component_snapshot from artales_evidence.source_components c where c.id=new.component_id;
  if dossier_snapshot is null or component_snapshot is distinct from dossier_snapshot then
   raise exception 'component outside dossier source snapshot' using errcode='23514';
  end if;
 end if;
 return new;
end
$$;
create trigger evidence_source_match before insert on artales_evidence.rights_evidence
 for each row execute function artales_evidence.validate_component_evidence();

-- Write-once rows. Also blocks privileged ordinary updates/deletes at DB trigger level.
create function artales_evidence.reject_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'artales_evidence rows are immutable' using errcode='23000'; end
$$;
do $$
declare t text;
begin
 foreach t in array array['source_snapshots','source_components','rights_dossiers','rights_evidence','text_revisions','metadata_revisions','visual_revisions','review_events'] loop
  execute format('create trigger immutable_%I before update or delete on artales_evidence.%I for each row execute function artales_evidence.reject_mutation()',t,t);
  execute format('alter table artales_evidence.%I enable row level security',t);
  execute format('revoke all on table artales_evidence.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on function artales_evidence.reject_mutation() from public,anon,authenticated;
revoke all on function artales_evidence.hash_revision_on_insert() from public,anon,authenticated;
revoke all on function artales_evidence.validate_component_span() from public,anon,authenticated;
revoke all on function artales_evidence.validate_component_evidence() from public,anon,authenticated;
commit;
