-- Generated filename by Supabase CLI 2.120.0 on 2026-10-10.
-- High risk. Source+rights+editorial DB gate. NOT AUTHORIZED FOR PRODUCTION APPLY.
begin;
create table public.candidate_source_captures (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.work_candidates(id) on delete restrict,
  source_id uuid not null,
  source_text text not null check(length(source_text) between 1 and 10000000),
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  included_inventory jsonb not null check(jsonb_typeof(included_inventory)='array'),
  provenance_note text not null check(length(btrim(provenance_note))>=40),
  captured_by uuid not null references public.profiles(id),
  reviewed_by uuid null references public.profiles(id),
  reviewed_at timestamptz null,
  review_note text null,
  draft_origin_type public.work_origin_type null,
  draft_source_label public.work_source_label null,
  candidate_fingerprint text null,
  source_fingerprint text null,
  rights_fingerprint text null,
  created_at timestamptz not null default now(),
  constraint captured_source_fk foreign key(source_id,candidate_id)
    references public.work_candidate_sources(id,candidate_id) on delete restrict,
  constraint captured_source_distinct_actors check(captured_by<>reviewed_by),
  constraint captured_source_unique unique(candidate_id,source_id)
);
create index candidate_source_captures_source_idx on public.candidate_source_captures(source_id);
alter table public.candidate_source_captures enable row level security;
revoke all on public.candidate_source_captures from public,anon,authenticated;
grant select on public.candidate_source_captures to authenticated;
create policy "Editorial staff read candidate source captures" on public.candidate_source_captures
 for select to authenticated
 using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in ('editor','admin')));
-- Capture insert is deliberate, server-owned and admin-authorized; SQL tools may seed
-- synthetic captures on a disposable branch only, not real-world rights clearance.
create function public.register_candidate_source_capture(
 p_candidate_id uuid,p_source_id uuid,p_text text,p_inventory jsonb,
 p_provenance_note text)
returns jsonb language plpgsql security definer set search_path=''
as $rpc$
declare v_actor uuid:=auth.uid();v_digest text;v_id uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin')
 then raise exception 'admin_required' using errcode='42501';end if;
 if p_text is null or length(p_text)=0 or length(p_text)>10000000
 or p_inventory is null or jsonb_typeof(p_inventory)<>'array'
 or jsonb_array_length(p_inventory)=0 or length(btrim(coalesce(p_provenance_note,'')))<40
 then return jsonb_build_object('result','blocked','reason','capture_incomplete');end if;
 if not exists(select 1 from public.work_candidate_sources s where s.id=p_source_id and s.candidate_id=p_candidate_id)
 then return jsonb_build_object('result','blocked','reason','source_mismatch');end if;
 -- Inventory is not a legal attestation. Re-verify rights and snapshot at promotion.
 v_digest:=encode(extensions.digest(convert_to(p_text,'UTF8'),'sha256'),'hex');
 insert into public.candidate_source_captures(candidate_id,source_id,source_text,source_sha256,
   included_inventory,provenance_note,captured_by)
 values(p_candidate_id,p_source_id,p_text,v_digest,p_inventory,p_provenance_note,v_actor)
 returning id into v_id;
 return jsonb_build_object('result','pending_independent_review','capture_id',v_id,'sha256',v_digest);
exception when unique_violation then
 return jsonb_build_object('result','already_captured');
end $rpc$;
revoke all on function public.register_candidate_source_capture(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.register_candidate_source_capture(uuid,uuid,text,jsonb,text) to authenticated;

-- A separate actor explicitly approves the exact persisted snapshot.
create function public.review_candidate_source_capture(
 p_capture_id uuid,p_expected_sha256 text,p_review_note text,
 p_origin_type public.work_origin_type,p_source_label public.work_source_label)
returns jsonb language plpgsql security definer set search_path=''
as $rpc$
declare
 v_actor uuid:=auth.uid();
 v_capture public.candidate_source_captures%rowtype;
 v_candidate public.work_candidates%rowtype;
 v_source public.work_candidate_sources%rowtype;
 v_rights jsonb;
 v_digest text;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor
   and p.is_active and p.role in ('admin','editor'))
 then raise exception 'editor_required' using errcode='42501';end if;
 if length(btrim(coalesce(p_review_note,'')))<40
 then return jsonb_build_object('result','blocked','reason','review_note_required');end if;
 if p_origin_type is null or p_source_label is null
 then return jsonb_build_object('result','blocked','reason','explicit_source_classification_required');end if;
 -- Discover immutable binding without locking capture first.
 select * into v_capture from public.candidate_source_captures where id=p_capture_id;
 if not found then return jsonb_build_object('result','blocked','reason','capture_missing');end if;
 -- Canonical lock order shared with promotion:
 -- candidate -> source -> rights rows -> capture.
 select * into v_candidate from public.work_candidates where id=v_capture.candidate_id for update;
 select * into v_source from public.work_candidate_sources where id=v_capture.source_id
   and candidate_id=v_capture.candidate_id for update;
 if v_candidate.id is null or v_source.id is null
   or v_candidate.preferred_source_id is distinct from v_capture.source_id
 then return jsonb_build_object('result','blocked','reason','source_mismatch');end if;
 perform 1 from public.work_candidate_component_rights where candidate_id=v_capture.candidate_id
   and source_id=v_capture.source_id order by component_type for update;
 select * into v_capture from public.candidate_source_captures where id=p_capture_id for update;
 if not found or v_capture.candidate_id is distinct from v_candidate.id
   or v_capture.source_id is distinct from v_source.id
 then return jsonb_build_object('result','blocked','reason','capture_binding_changed');end if;
 if v_actor=v_capture.captured_by then
   return jsonb_build_object('result','blocked','reason','self_review_forbidden');end if;
 if v_capture.reviewed_by is not null then
   return jsonb_build_object('result','already_reviewed');end if;
 v_digest:=encode(extensions.digest(convert_to(v_capture.source_text,'UTF8'),'sha256'),'hex');
 if p_expected_sha256 is distinct from v_digest or v_capture.source_sha256<>v_digest
 then return jsonb_build_object('result','blocked','reason','digest_mismatch');end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.component_type,r.id),'[]'::jsonb)
 into v_rights from public.work_candidate_component_rights r
 where r.candidate_id=v_capture.candidate_id and r.source_id=v_capture.source_id;
 if jsonb_array_length(v_rights)<2
 then return jsonb_build_object('result','blocked','reason','rights_missing');end if;
 update public.candidate_source_captures set reviewed_by=v_actor,
   reviewed_at=clock_timestamp(),review_note=p_review_note,
   draft_origin_type=p_origin_type,draft_source_label=p_source_label,
   candidate_fingerprint=encode(extensions.digest(convert_to(to_jsonb(v_candidate)::text,'UTF8'),'sha256'),'hex'),
   source_fingerprint=encode(extensions.digest(convert_to(to_jsonb(v_source)::text,'UTF8'),'sha256'),'hex'),
   rights_fingerprint=encode(extensions.digest(convert_to(v_rights::text,'UTF8'),'sha256'),'hex')
 where id=p_capture_id and reviewed_by is null;
 return jsonb_build_object('result','review_recorded','capture_id',p_capture_id);
end $rpc$;
revoke all on function public.review_candidate_source_capture(uuid,text,text,public.work_origin_type,public.work_source_label) from public,anon,authenticated;
grant execute on function public.review_candidate_source_capture(uuid,text,text,public.work_origin_type,public.work_source_label) to authenticated;

-- Existing triggers reject every edit_text insert. Permit one narrow RPC-controlled
-- work-task insertion after complete lock/gate checking.
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
           and exists(select 1 from public.candidate_source_captures sc where sc.candidate_id=c.id and sc.source_id=c.preferred_source_id))))
   then raise exception 'editorial_invalid_create' using errcode='23514';end if;
   return new;
 else
   if row(new.id,new.candidate_id,new.work_id,new.kind,new.title,new.source_system,
     new.source_external_id,new.created_by,new.created_at,new.completed_at)
     is distinct from row(old.id,old.candidate_id,old.work_id,old.kind,old.title,old.source_system,
       old.source_external_id,old.created_by,old.created_at,old.completed_at)
   then raise exception 'editorial_immutable_field_changed' using errcode='23514';end if;
   if old.status='open' and new.status='claimed' and new.assignee_user_id=v_actor
   then new.claimed_at:=now();v_event:='claimed';
   elsif old.status='claimed' and new.status='open' and new.assignee_user_id is null and
     new.claimed_at is null and (old.assignee_user_id=v_actor or exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin'))
   then v_event:='returned';
   else raise exception 'editorial_invalid_transition' using errcode='23514';end if;
   new.updated_at:=now();
   insert into public.editorial_task_events(task_id,event_type,actor_id)values(new.id,v_event,v_actor);
   return new;
 end if;
end $trigger$;

create function public.promote_candidate_to_edit_text(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $rpc$
declare
 v_actor uuid:=auth.uid();
 v_c public.work_candidates%rowtype;
 v_s public.work_candidate_sources%rowtype;
 v_capture public.candidate_source_captures%rowtype;
 v_rights integer;
 v_bad integer;
 v_work_id uuid;
 v_slug text;
 v_task uuid;
 v_reason text;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role in ('admin','editor'))
 then raise exception 'editor_role_required' using errcode='42501';end if;
 select * into v_c from public.work_candidates where id=p_candidate_id for update;
 if not found then return jsonb_build_object('result','blocked','reason','candidate_missing');end if;
 if v_c.matched_work_id is not null then
   select id into v_task from public.editorial_tasks
     where source_system='artales' and source_external_id='candidate-edit:'||p_candidate_id::text;
   if v_task is null then return jsonb_build_object('result','blocked','reason','orphan_work_missing_task');end if;
   return jsonb_build_object('result','already_promoted','work_id',v_c.matched_work_id,'task_id',v_task);
 end if;
 if v_c.status not in('ready','accepted') or v_c.discovery_status<>'complete'
   or v_c.rights_status<>'clear' or v_c.identity_status<>'matched'
   or v_c.review_required or v_c.not_before is not null or v_c.matched_author_id is null
   or v_c.preferred_source_id is null or
   not exists(select 1 from public.authors a where a.id=v_c.matched_author_id and lower(btrim(a.name))=lower(btrim(coalesce(v_c.normalized_author_name,''))))
 then return jsonb_build_object('result','blocked','reason','triage_identity_rights');end if;
 select * into v_s from public.work_candidate_sources
   where id=v_c.preferred_source_id and candidate_id=p_candidate_id for update;
 if not found or v_s.status<>'candidate' or v_s.identity_match<>'strong'
   or v_s.language is null or v_s.language !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
 then return jsonb_build_object('result','blocked','reason','source_unverified');end if;
 -- Both RPCs lock in the same order to avoid review/promotion deadlocks.
 -- candidate and source are already locked; next rights, finally capture.
 perform 1 from public.work_candidate_component_rights r
   where r.candidate_id=p_candidate_id and r.source_id=v_s.id
   order by r.component_type for update;
 select * into v_capture from public.candidate_source_captures
   where candidate_id=p_candidate_id and source_id=v_s.id for update;
 if not found or v_capture.reviewed_by is null or v_capture.reviewed_at is null or
   v_capture.draft_origin_type is null or v_capture.draft_source_label is null or
   v_capture.reviewed_at<v_s.updated_at or
   v_capture.source_sha256<>encode(extensions.digest(convert_to(v_capture.source_text,'UTF8'),'sha256'),'hex')
   or v_capture.reviewed_by=v_capture.captured_by
   or not exists(select 1 from public.profiles p where p.id=v_capture.reviewed_by and p.is_active and p.role in ('admin','editor'))
 then return jsonb_build_object('result','blocked','reason','source_capture_stale_or_unverified');end if;
 -- A manually entered rights checkbox cannot create review-grade clearance.
 -- A reviewer must sign off separately; required components must exist.
 select count(*) filter(where component_type in('WORK_CONTENT','EDITION_CONTENT')
   and ((component_type='WORK_CONTENT' and decision='usable' and publication_effect='allow')
     or (component_type='EDITION_CONTENT' and ((decision='usable' and publication_effect='allow') or
       (decision='exclude' and publication_effect='exclude_component') or (decision='not_applicable' and publication_effect='allow'))))
   and reviewed_at is not null and reviewed_by is not null and not_before is null),
   count(*) filter(where reviewed_by is null or reviewed_at is null or
     reviewed_at<v_s.updated_at or
     publication_effect in('review','block_source') or
     decision in('blocked','review_required','alternate_edition_required') or
     component_type='UNKNOWN' or
     (not_before is not null and publication_effect<>'exclude_component'))
 into v_rights,v_bad from public.work_candidate_component_rights
 where candidate_id=p_candidate_id and source_id=v_s.id;
 if v_rights<>2 or v_bad<>0 or
   not exists(select 1 from public.work_candidate_component_rights r where r.candidate_id=p_candidate_id and r.source_id=v_s.id
     and r.component_type='WORK_CONTENT' and r.decision='usable' and r.publication_effect='allow') or
   not exists(select 1 from public.work_candidate_component_rights r where r.candidate_id=p_candidate_id and r.source_id=v_s.id and r.component_type='EDITION_CONTENT')
 then return jsonb_build_object('result','blocked','reason','component_rights_unverified');end if;
 -- Approval is invalid if candidate, edition or rights changed.
 if v_capture.candidate_fingerprint is distinct from
   encode(extensions.digest(convert_to(to_jsonb(v_c)::text,'UTF8'),'sha256'),'hex')
 or v_capture.source_fingerprint is distinct from
   encode(extensions.digest(convert_to(to_jsonb(v_s)::text,'UTF8'),'sha256'),'hex')
 or v_capture.rights_fingerprint is distinct from
   (select encode(extensions.digest(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by r.component_type,r.id),'[]'::jsonb)::text,
      'UTF8'),'sha256'),'hex')
    from public.work_candidate_component_rights r
    where r.candidate_id=p_candidate_id and r.source_id=v_s.id)
 then return jsonb_build_object('result','blocked','reason','review_invalidated');end if;
 -- The reviewer's explicit provenance classification must match translation rights.
 if v_capture.draft_origin_type<>'translation'::public.work_origin_type
    and exists(select 1 from public.work_candidate_component_rights r
     where r.candidate_id=p_candidate_id and r.source_id=v_s.id
       and r.component_type='TRANSLATION'
       and r.decision='usable' and r.publication_effect='allow')
 then return jsonb_build_object('result','blocked','reason','translation_origin_mismatch');end if;
 -- Inventory must be explicit, including excluded wrapper / assets decisions.
 if jsonb_array_length(v_capture.included_inventory)=0 or not exists(
   select 1 from jsonb_array_elements(v_capture.included_inventory) el
   where el->>'component_type'='WORK_CONTENT' and el->>'included'='true') or exists(
   select 1 from jsonb_array_elements(v_capture.included_inventory) el
   where el->>'included'='true' and not exists (
     select 1 from public.work_candidate_component_rights r
     where r.source_id=v_s.id and r.candidate_id=p_candidate_id
       and r.component_type=el->>'component_type' and r.decision='usable' and r.publication_effect='allow'))
 then return jsonb_build_object('result','blocked','reason','component_inventory_unverified');end if;
 v_slug:='candidate-'||replace(p_candidate_id::text,'-','');
 insert into public.works(title,slug,summary,content,content_blocks,canonical_language,
   origin_type,source_label,source_reference,edition_source_url,status,primary_author_id,created_by,updated_by)
 values(v_c.proposed_title,v_slug,'','', '[]'::jsonb,v_s.language,
   v_capture.draft_origin_type,v_capture.draft_source_label,
   v_s.source_reference,v_s.source_url,'draft'::public.work_status,
   v_c.matched_author_id,v_actor,v_actor)
 returning id into v_work_id;
 update public.work_candidates set matched_work_id=v_work_id,promoted_at=now(),promoted_by=v_actor,
   updated_by=v_actor,updated_at=now() where id=p_candidate_id;
 -- Atomicity: a failed edit_text insert automatically rolls back work and link.
 insert into public.editorial_tasks(work_id,kind,title,created_by,source_system,source_external_id)
 values(v_work_id,'edit_text',left('Redakční úprava: '||v_c.proposed_title,240),
   v_actor,'artales','candidate-edit:'||p_candidate_id::text)
 returning id into v_task;
 insert into public.work_candidate_promotion_attempts(candidate_id,actor_user_id,preferred_source_id,
   result,blockers,gate_snapshot,created_work_id)
 values(p_candidate_id,v_actor,v_s.id,'promoted','[]'::jsonb,
   jsonb_build_object('version','P1-2C1B','capture_id',v_capture.id,'sha256',v_capture.source_sha256,
     'source_id',v_s.id,'reviewed_by',v_capture.reviewed_by,'reviewed_at',v_capture.reviewed_at,
     'origin_type',v_capture.draft_origin_type::text,'source_label',v_capture.draft_source_label::text),
   v_work_id);
 return jsonb_build_object('result','promoted','work_id',v_work_id,'task_id',v_task,'slug',v_slug);
end $rpc$;
revoke all on function public.promote_candidate_to_edit_text(uuid) from public,anon,authenticated;
grant execute on function public.promote_candidate_to_edit_text(uuid) to authenticated;
commit;
