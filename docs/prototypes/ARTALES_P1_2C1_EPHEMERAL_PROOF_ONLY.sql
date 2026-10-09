-- P1-2C1 experimental SQL. Execute only on ephemeral Supabase branch.
-- Deliberately not a production migration. After proof, generate canonical migration with Supabase CLI.
create or replace function public.promote_work_candidate_p1_2c1(p_candidate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_c public.work_candidates%rowtype;
  v_s public.work_candidate_sources%rowtype;
  v_a public.authors%rowtype;
  v_blockers text[] := array[]::text[];
  v_work_id uuid;
  v_slug text;
  v_bad int;
  v_count int;
begin
  if v_actor is null or not exists(
    select 1 from public.profiles p where p.id=v_actor and p.is_active and p.role in ('editor','admin')
  ) then
    raise exception 'editor_authorization_required' using errcode='42501';
  end if;

  select * into v_c from public.work_candidates where id=p_candidate_id for update;
  if not found then
    return jsonb_build_object('result','blocked','blockers',jsonb_build_array('candidate_not_found'));
  end if;

  if v_c.matched_work_id is not null then
    select id into v_work_id from public.works where id=v_c.matched_work_id and status='draft';
    if found then
      return jsonb_build_object('result','already_promoted','work_id',v_work_id);
    end if;
    v_blockers:=array_append(v_blockers,'already_promoted');
  elsif v_c.promoted_at is not null then
    v_blockers:=array_append(v_blockers,'already_promoted');
  end if;

  if v_c.status not in ('ready','accepted') then
    v_blockers:=array_append(v_blockers,'candidate_not_ready');
  end if;
  if v_c.discovery_status <> 'complete' or v_c.identity_status <> 'matched'
     or v_c.rights_status <> 'clear' or v_c.review_required
     or (v_c.not_before is not null and v_c.not_before>current_date) then
    v_blockers:=array_append(v_blockers,'triage_blocked');
  end if;

  if v_c.matched_author_id is null then
    v_blockers:=array_append(v_blockers,'author_match_required');
  else
    select * into v_a from public.authors where id=v_c.matched_author_id;
    if not found or lower(btrim(v_a.name)) <> lower(btrim(coalesce(v_c.normalized_author_name,''))) then
      v_blockers:=array_append(v_blockers,'author_identity_unverified');
    end if;
  end if;

  if v_c.preferred_source_id is null then
    v_blockers:=array_append(v_blockers,'preferred_source_missing');
  else
    select * into v_s from public.work_candidate_sources
    where candidate_id=p_candidate_id and id=v_c.preferred_source_id for update;
    if not found or v_s.status <> 'candidate' then
      v_blockers:=array_append(v_blockers,'preferred_source_missing');
    elsif v_s.identity_match <> 'strong' then
      v_blockers:=array_append(v_blockers,'preferred_source_identity_weak');
    end if;
  end if;

  if v_s.id is not null then
    if v_s.language is null or v_s.language !~ '^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$' then
      v_blockers:=array_append(v_blockers,'source_language_required');
    end if;

    -- The shareable preview rules are re-evaluated from canonical DB rows, not passed from UI.
    perform 1 from public.work_candidate_component_rights
      where candidate_id=p_candidate_id and source_id=v_s.id for update;

    select count(*) into v_count from public.work_candidate_component_rights
      where candidate_id=p_candidate_id and source_id=v_s.id
        and component_type='WORK_CONTENT' and decision='usable' and publication_effect='allow'
        and (not_before is null or not_before<=current_date);
    if v_count<>1 then v_blockers:=array_append(v_blockers,'work_rights_not_clear'); end if;

    select count(*) into v_count from public.work_candidate_component_rights
      where candidate_id=p_candidate_id and source_id=v_s.id
        and component_type='EDITION_CONTENT'
        and ((decision='usable' and publication_effect='allow')
           or (decision='exclude' and publication_effect='exclude_component')
           or (decision='not_applicable' and publication_effect='allow'))
        and (not_before is null or not_before<=current_date or publication_effect='exclude_component');
    if v_count<>1 then v_blockers:=array_append(v_blockers,'edition_rights_not_clear'); end if;

    select count(*) into v_bad from public.work_candidate_component_rights
      where candidate_id=p_candidate_id and source_id=v_s.id
        and (
          (decision='usable' and publication_effect<>'allow')
          or (decision='exclude' and publication_effect<>'exclude_component')
          or (decision='not_applicable' and publication_effect<>'allow')
          or decision in ('review_required','alternate_edition_required','blocked')
          or publication_effect in ('review','block_source')
          or (not_before>current_date and publication_effect<>'exclude_component')
          -- Translated editions need a separate origin/edition rights contract.
          or (component_type='TRANSLATION' and decision='usable')
        );
    if v_bad>0 then v_blockers:=array_append(v_blockers,'component_rights_review'); end if;
  end if;

  if cardinality(v_blockers)>0 then
    insert into public.work_candidate_promotion_attempts
      (candidate_id,actor_user_id,preferred_source_id,result,blockers,gate_snapshot)
    values (p_candidate_id,v_actor,v_s.id,'blocked',to_jsonb(v_blockers),
      jsonb_build_object('version','p1-2c1-experimental','status',v_c.status));
    return jsonb_build_object('result','blocked','blockers',to_jsonb(v_blockers));
  end if;

  -- Trial-only mapping: final promotion requires independently reviewed explicit\n  -- origin/provenance and full component snapshot mapping. Not production-ready.
  v_slug:=left(regexp_replace(lower(btrim(coalesce(v_c.normalized_title,v_c.proposed_title))),
    '[^a-z0-9]+','-','g'),48);
  v_slug:=trim(both '-' from v_slug);
  if v_slug='' then v_slug:='draft'; end if;
  v_slug:=v_slug||'-'||left(replace(p_candidate_id::text,'-',''),12);

  insert into public.works(
    title,slug,summary,content,content_blocks,canonical_language,
    origin_type,source_label,source_reference,edition_source_url,
    status,primary_author_id,created_by,updated_by
  ) values (
    v_c.proposed_title,v_slug,'','', '[]'::jsonb,v_s.language,
    'public_domain'::public.work_origin_type,
    case when v_s.provider ilike '%gutenberg%' then 'gutenberg'::public.work_source_label
      else 'web'::public.work_source_label end,
    v_s.source_reference,v_s.source_url,'draft'::public.work_status,
    v_c.matched_author_id,v_actor,v_actor
  ) returning id into v_work_id;

  update public.work_candidates
    set matched_work_id=v_work_id,promoted_at=now(),promoted_by=v_actor,
        updated_by=v_actor,updated_at=now()
    where id=p_candidate_id;

  insert into public.work_candidate_promotion_attempts
    (candidate_id,actor_user_id,preferred_source_id,result,blockers,gate_snapshot,created_work_id)
  values (p_candidate_id,v_actor,v_s.id,'promoted','[]'::jsonb,
    jsonb_build_object('version','p1-2c1-experimental','source_id',v_s.id,'rights_checked',true),v_work_id);

  return jsonb_build_object('result','promoted','work_id',v_work_id,'slug',v_slug);
end;
$$;
revoke all on function public.promote_work_candidate_p1_2c1(uuid) from public, anon;
grant execute on function public.promote_work_candidate_p1_2c1(uuid) to authenticated;
