-- ARTales P1-2C1 / isolated proof V2. Never apply to production.
-- Candidate migrations P1-1A and P1-2A are prerequisites.
begin;

-- Do not infer legal provenance from the provider name, work title or a URL.
-- Editors must explicitly review and record the concrete edition's draft mapping.
alter table public.work_candidate_sources
  add column if not exists draft_origin_type public.work_origin_type,
  add column if not exists draft_source_label public.work_source_label,
  add column if not exists provenance_basis text,
  add column if not exists provenance_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists provenance_reviewed_at timestamptz;

alter table public.work_candidate_sources
  drop constraint if exists work_candidate_source_provenance_basis_minimum;
alter table public.work_candidate_sources
  add constraint work_candidate_source_provenance_basis_minimum
  check (provenance_basis is null or char_length(btrim(provenance_basis)) >= 20);

create or replace function public.promote_work_candidate_p1_2c1(p_candidate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_c public.work_candidates%rowtype;
  v_s public.work_candidate_sources%rowtype;
  v_author public.authors%rowtype;
  v_work_id uuid;
  v_work_slug text;
  v_source_found boolean := false;
  v_rights_count integer := 0;
  v_bad_count integer := 0;
  v_required_count integer := 0;
  v_blockers text[] := array[]::text[];
  v_rights_snapshot jsonb := '[]'::jsonb;
  v_gate_snapshot jsonb;
begin
  -- The caller can never supply or impersonate actor identity.
  if v_actor is null or not exists (
    select 1 from public.profiles p
      where p.id = v_actor and p.is_active = true
        and p.role in ('admin', 'editor')
  ) then
    raise exception 'editor_authorization_required' using errcode = '42501';
  end if;

  -- Serialize promotion attempts for the same candidate.
  select * into v_c
  from public.work_candidates
  where id = p_candidate_id
  for update;
  if not found then
    return jsonb_build_object('result', 'blocked', 'blockers', jsonb_build_array('candidate_not_found'));
  end if;

  -- Exactly-once semantics: return an existing work, never create a second.
  if v_c.matched_work_id is not null then
    select id, slug into v_work_id, v_work_slug
    from public.works where id = v_c.matched_work_id;
    if found then
      return jsonb_build_object('result', 'already_promoted', 'work_id', v_work_id, 'slug', v_work_slug);
    end if;
    v_blockers := array_append(v_blockers, 'already_promoted');
  elsif v_c.promoted_at is not null then
    v_blockers := array_append(v_blockers, 'already_promoted');
  end if;

  if v_c.status not in ('ready', 'accepted') then
    v_blockers := array_append(v_blockers, 'candidate_not_ready');
  end if;

  -- A date restriction never expires into silent approval; an editor must
  -- explicitly remove it after re-review.
  if v_c.discovery_status <> 'complete'
     or v_c.rights_status <> 'clear'
     or v_c.identity_status <> 'matched'
     or v_c.review_required
     or v_c.not_before is not null then
    v_blockers := array_append(v_blockers, 'triage_blocked');
  end if;

  if v_c.matched_author_id is null then
    v_blockers := array_append(v_blockers, 'author_match_required');
  else
    select * into v_author from public.authors where id = v_c.matched_author_id;
    if not found or lower(btrim(v_author.name)) <> lower(btrim(coalesce(v_c.normalized_author_name, ''))) then
      v_blockers := array_append(v_blockers, 'author_identity_unverified');
    end if;
  end if;

  if v_c.preferred_source_id is null then
    v_blockers := array_append(v_blockers, 'preferred_source_missing');
  else
    select * into v_s
      from public.work_candidate_sources
      where candidate_id = p_candidate_id and id = v_c.preferred_source_id
      for update;
    v_source_found := found;

    if not v_source_found or v_s.status <> 'candidate' then
      v_blockers := array_append(v_blockers, 'preferred_source_missing');
    elsif v_s.identity_match <> 'strong' then
      v_blockers := array_append(v_blockers, 'preferred_source_identity_weak');
    end if;
  end if;

  if v_source_found then
    if v_s.language is null
       or v_s.language !~ '^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$' then
      v_blockers := array_append(v_blockers, 'source_language_required');
    end if;

    -- Publication origin, source label, legal/evidentiary basis and a named
    -- editor's review are all explicit, not defaults or heuristic guesses.
    if v_s.draft_origin_type is null or v_s.draft_source_label is null
       or v_s.provenance_basis is null
       or char_length(btrim(v_s.provenance_basis)) < 20
       or v_s.provenance_reviewed_at is null
       or v_s.provenance_reviewed_by is null
       or v_s.provenance_reviewed_at < v_s.updated_at
       or not exists (
         select 1 from public.profiles p
           where p.id = v_s.provenance_reviewed_by
             and p.is_active and p.role in ('admin','editor')
       ) then
      v_blockers := array_append(v_blockers, 'source_provenance_unverified');
    end if;

    -- Source-scoped rights are re-read and locked inside this transaction;
    -- the UI may not pass "cleared" booleans or computed gate snapshots.
    perform 1 from public.work_candidate_component_rights
      where candidate_id = p_candidate_id and source_id = v_s.id
      order by component_type for update;

    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'component', r.component_type, 'decision', r.decision,
      'effect', r.publication_effect, 'reason', r.reason,
      'jurisdiction', r.jurisdiction, 'not_before', r.not_before,
      'reviewed_by', r.reviewed_by, 'reviewed_at', r.reviewed_at
    ) order by r.component_type), '[]'::jsonb)
    into v_rights_count, v_rights_snapshot
    from public.work_candidate_component_rights r
    where r.candidate_id = p_candidate_id and r.source_id = v_s.id;

    select count(*) into v_required_count
      from public.work_candidate_component_rights r
      where r.candidate_id = p_candidate_id and r.source_id = v_s.id
        and r.component_type = 'WORK_CONTENT'
        and r.decision = 'usable' and r.publication_effect = 'allow'
        and r.reviewed_at is not null and r.reviewed_by is not null
        and r.not_before is null;
    if v_required_count <> 1 then
      v_blockers := array_append(v_blockers, 'work_rights_not_clear');
    end if;

    select count(*) into v_required_count
      from public.work_candidate_component_rights r
      where r.candidate_id = p_candidate_id and r.source_id = v_s.id
        and r.component_type = 'EDITION_CONTENT'
        and (
          (r.decision = 'usable' and r.publication_effect = 'allow')
          or (r.decision = 'exclude' and r.publication_effect = 'exclude_component')
          or (r.decision = 'not_applicable' and r.publication_effect = 'allow')
        )
        and r.reviewed_by is not null and r.reviewed_at is not null
        and (r.not_before is null or r.publication_effect = 'exclude_component');
    if v_required_count <> 1 then
      v_blockers := array_append(v_blockers, 'edition_rights_not_clear');
    end if;

    select count(*) into v_bad_count
      from public.work_candidate_component_rights r
      where r.candidate_id = p_candidate_id and r.source_id = v_s.id
        and (
          r.reviewed_by is null or r.reviewed_at is null
          or (r.decision = 'usable' and r.publication_effect <> 'allow')
          or (r.decision = 'exclude' and r.publication_effect <> 'exclude_component')
          or (r.decision = 'not_applicable' and r.publication_effect <> 'allow')
          or r.decision in ('review_required', 'alternate_edition_required', 'blocked')
          or r.publication_effect in ('review','block_source')
          or (r.not_before is not null and r.publication_effect <> 'exclude_component')
          or (r.component_type = 'UNKNOWN')
          or (r.component_type = 'TRANSLATION' and r.decision = 'usable'
               and v_s.draft_origin_type <> 'translation'::public.work_origin_type)
        );

    if v_rights_count = 0 or v_bad_count > 0 then
      v_blockers := array_append(v_blockers, 'component_rights_review');
    end if;

    if v_s.draft_origin_type = 'translation'::public.work_origin_type then
      select count(*) into v_required_count
      from public.work_candidate_component_rights r
      where r.candidate_id = p_candidate_id and r.source_id = v_s.id
        and r.component_type = 'TRANSLATION'
        and r.decision = 'usable' and r.publication_effect = 'allow'
        and r.reviewed_by is not null and r.reviewed_at is not null
        and r.not_before is null;
      if v_required_count <> 1 then
        v_blockers := array_append(v_blockers, 'translation_rights_not_clear');
      end if;
    end if;
  end if;

  v_gate_snapshot := jsonb_build_object(
    'version', 'P1-2C1-proof-v2',
    'candidate_id', p_candidate_id,
    'candidate_status', v_c.status,
    'discovery_status', v_c.discovery_status,
    'rights_status', v_c.rights_status,
    'matched_author_id', v_c.matched_author_id,
    'preferred_source_id', case when v_source_found then v_s.id else null end,
    'draft_origin_type', case when v_source_found then v_s.draft_origin_type::text else null end,
    'draft_source_label', case when v_source_found then v_s.draft_source_label::text else null end,
    'provenance_basis', case when v_source_found then v_s.provenance_basis else null end,
    'provenance_reviewed_by', case when v_source_found then v_s.provenance_reviewed_by else null end,
    'provenance_reviewed_at', case when v_source_found then v_s.provenance_reviewed_at else null end,
    'component_rights', v_rights_snapshot
  );

  if cardinality(v_blockers) > 0 then
    insert into public.work_candidate_promotion_attempts(
      candidate_id, actor_user_id, preferred_source_id, result,
      blockers, gate_snapshot
    ) values(
      p_candidate_id, v_actor,
      case when v_source_found then v_s.id else null end,
      'blocked', to_jsonb(v_blockers), v_gate_snapshot
    );
    return jsonb_build_object('result', 'blocked', 'blockers', to_jsonb(v_blockers));
  end if;

  -- Deterministic collision-resistant slug, without erasing older works.
  v_work_slug := regexp_replace(
      lower(coalesce(v_c.normalized_title, v_c.proposed_title)),
      '[^a-z0-9]+', '-', 'g'
    );
  v_work_slug := trim(both '-' from left(v_work_slug, 42));
  if v_work_slug = '' then v_work_slug := 'draft'; end if;
  v_work_slug := v_work_slug || '-' || replace(p_candidate_id::text, '-', '');

  insert into public.works(
    title, slug, summary, content, content_blocks,
    canonical_language, origin_type, source_label, source_reference,
    edition_source_url, status, primary_author_id, created_by, updated_by
  ) values(
    v_c.proposed_title, v_work_slug, '', '', '[]'::jsonb,
    v_s.language, v_s.draft_origin_type, v_s.draft_source_label,
    v_s.source_reference, v_s.source_url, 'draft'::public.work_status,
    v_c.matched_author_id, v_actor, v_actor
  ) returning id into v_work_id;

  update public.work_candidates
    set matched_work_id = v_work_id, promoted_at = now(), promoted_by = v_actor,
        updated_by = v_actor, updated_at = now()
    where id = p_candidate_id;

  insert into public.work_candidate_promotion_attempts(
    candidate_id, actor_user_id, preferred_source_id, result, blockers,
    gate_snapshot, created_work_id
  ) values (
    p_candidate_id, v_actor, v_s.id, 'promoted', '[]'::jsonb,
    v_gate_snapshot, v_work_id
  );

  return jsonb_build_object(
    'result', 'promoted', 'work_id', v_work_id, 'slug', v_work_slug
  );
end;
$function$;

revoke all on function public.promote_work_candidate_p1_2c1(uuid) from public, anon;
grant execute on function public.promote_work_candidate_p1_2c1(uuid) to authenticated;
commit;
