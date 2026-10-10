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
  reviewed_by uuid not null references public.profiles(id),
  reviewed_at timestamptz not null,
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
 p_provenance_note text,p_reviewer_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $rpc$
declare v_actor uuid:=auth.uid();v_digest text;v_id uuid;
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role='admin')
 then raise exception 'admin_required' using errcode='42501';end if;
 if p_reviewer_id=v_actor or not exists(select 1 from public.profiles p where p.id=p_reviewer_id and p.is_active and p.role in ('admin','editor'))
 then return jsonb_build_object('result','blocked','reason','independent_reviewer_required');end if;
 if p_text is null or length(p_text)=0 or length(p_text)>10000000
 or p_inventory is null or jsonb_typeof(p_inventory)<>'array'
 or jsonb_array_length(p_inventory)=0 or length(btrim(coalesce(p_provenance_note,'')))<40
 then return jsonb_build_object('result','blocked','reason','capture_incomplete');end if;
 if not exists(select 1 from public.work_candidate_sources s where s.id=p_source_id and s.candidate_id=p_candidate_id)
 then return jsonb_build_object('result','blocked','reason','source_mismatch');end if;
 -- Inventory is not a legal attestation. Re-verify rights and snapshot at promotion.
 v_digest:=encode(extensions.digest(convert_to(p_text,'UTF8'),'sha256'),'hex');
 insert into public.candidate_source_captures(candidate_id,source_id,source_text,source_sha256,
   included_inventory,provenance_note,captured_by,reviewed_by,reviewed_at)
 values(p_candidate_id,p_source_id,p_text,v_digest,p_inventory,p_provenance_note,v_actor,p_reviewer_id,now())
 returning id into v_id;
 return jsonb_build_object('result','recorded_for_review','capture_id',v_id,'sha256',v_digest);
exception when unique_violation then
 return jsonb_build_object('result','already_captured');
end $rpc$;
revoke all on function public.register_candidate_source_capture(uuid,uuid,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.register_candidate_source_capture(uuid,uuid,text,jsonb,text,uuid) to authenticated;

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
 select * into v_capture from public.candidate_source_captures
   where candidate_id=p_candidate_id and source_id=v_s.id for update;
 if not found or v_capture.reviewed_at<v_s.updated_at or
   v_capture.source_sha256<>encode(extensions.digest(convert_to(v_capture.source_text,'UTF8'),'sha256'),'hex')
   or v_capture.reviewed_by=v_capture.captured_by
   or not exists(select 1 from public.profiles p where p.id=v_capture.reviewed_by and p.is_active and p.role in ('admin','editor'))
 then return jsonb_build_object('result','blocked','reason','source_capture_stale_or_unverified');end if;
 -- A manually entered rights checkbox cannot create review-grade clearance.
 -- A reviewer must sign off separately; required components must exist.
 perform 1 from public.work_candidate_component_rights r
   where r.candidate_id=p_candidate_id and r.source_id=v_s.id for update;
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
   'public_domain'::public.work_origin_type,'manual'::public.work_source_label,
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
     'source_id',v_s.id,'reviewed_by',v_capture.reviewed_by,'reviewed_at',v_capture.reviewed_at),
   v_work_id);
 return jsonb_build_object('result','promoted','work_id',v_work_id,'task_id',v_task,'slug',v_slug);
end $rpc$;
revoke all on function public.promote_candidate_to_edit_text(uuid) from public,anon,authenticated;
grant execute on function public.promote_candidate_to_edit_text(uuid) to authenticated;
commit;
