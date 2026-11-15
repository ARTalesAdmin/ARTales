-- ARTales: one atomic editor-approved mixed AI QA revision.
-- Maintains immutable source and the existing manual exclusion/layout RPCs.
-- This is the single reviewed-AI commit route; it is not a second reader or QA model.
-- Deployment: apply ONLY after independent database authorization.
create or replace function public.artales_commit_editorial_review_batch(
 p_candidate_id uuid,p_parent_sha text,p_job_id uuid,p_editor_id uuid,
 p_revision jsonb,p_decisions jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
 v_old public.candidate_semantic_revisions%rowtype;
 v_job public.artales_semantic_ai_qa_jobs%rowtype;
 v_new_sha text;
 v_item jsonb; v_flag public.artales_semantic_qa_flags%rowtype;
 v_suggestion jsonb; v_issue jsonb;
 v_old_count integer; v_n integer; v_changed integer; v_expected integer;
 v_exclusions integer:=0;v_layout integer:=0;v_rules integer:=0;
 v_confirm integer:=0;v_reject integer:=0;
 v_old_index jsonb;v_new_index jsonb;v_path text;v_node jsonb;
 v_matched integer;
 v_old_exclusions jsonb;v_new_exclusions jsonb;
 v_delta jsonb;v_expected_delta jsonb;
 v_resolved integer:=0;v_carried integer:=0;v_rule text;
begin
 if current_setting('request.jwt.claim.role',true)<>'service_role'
 then raise exception 'service_only_editorial_review_batch' using errcode='42501';end if;
 if p_parent_sha !~ '^[a-f0-9]{64}$' or p_candidate_id is null
   or p_editor_id is null or p_job_id is null
   or p_decisions is null or pg_catalog.jsonb_typeof(p_decisions)<>'array'
   or pg_catalog.jsonb_array_length(p_decisions) not between 1 and 25
 then return pg_catalog.jsonb_build_object('result','invalid_input');end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_candidate_id::text)::bigint);
 select * into v_old from public.candidate_semantic_revisions
 where candidate_id=p_candidate_id order by created_at desc,id desc limit 1 for update;
 if not found or v_old.revision_sha256<>p_parent_sha
 then return pg_catalog.jsonb_build_object('result','stale_revision');end if;
 if not exists(select 1 from public.profiles p
   where p.id=p_editor_id and p.is_active and p.role::text in ('admin','editor'))
   or not exists(select 1 from public.artales_editorial_tasks t
     where t.candidate_id=p_candidate_id and t.revision_sha256=p_parent_sha
       and t.kind='text_review' and t.status='claimed' and t.assigned_to=p_editor_id)
 then return pg_catalog.jsonb_build_object('result','not_current_editor');end if;

 select * into v_job from public.artales_semantic_ai_qa_jobs
 where id=p_job_id for update;
 if not found or v_job.status<>'completed' or v_job.created_by<>p_editor_id
    or v_job.candidate_id<>p_candidate_id or v_job.revision_sha256<>p_parent_sha
    or v_job.applied_revision_sha256 is not null
    or pg_catalog.jsonb_typeof(v_job.suggestions)<>'array'
    or pg_catalog.cardinality(v_job.flag_ids)<>pg_catalog.jsonb_array_length(p_decisions)
    or pg_catalog.jsonb_array_length(v_job.suggestions)<>pg_catalog.cardinality(v_job.flag_ids)
 then return pg_catalog.jsonb_build_object('result','invalid_ai_job');end if;

 -- Every queued finding must receive exactly one decision. A missing,
 -- duplicated, cross-candidate or changed flag fails the WHOLE transaction.
 select count(distinct x.value->>'flagId') into v_n
 from pg_catalog.jsonb_array_elements(p_decisions) x(value);
 if v_n<>pg_catalog.jsonb_array_length(p_decisions)
 then return pg_catalog.jsonb_build_object('result','duplicate_decision');end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(p_decisions) x(value)
   where (x.value->>'flagId') is null
     or (x.value->>'flagId') not in
       (select ident::text from pg_catalog.unnest(v_job.flag_ids) ident)
     or x.value->>'action' not in
       ('exclude_note','compact','airy','center','protect_term','confirm_no_change','reject')
     or pg_catalog.jsonb_typeof(x.value)<>'object')
 then return pg_catalog.jsonb_build_object('result','invalid_decision');end if;

 select count(*) into v_n from public.artales_semantic_qa_flags f
 where f.id=any(v_job.flag_ids) and f.candidate_id=p_candidate_id
   and f.revision_sha256=p_parent_sha and f.status='open';
 if v_n<>pg_catalog.cardinality(v_job.flag_ids)
 then return pg_catalog.jsonb_build_object('result','flags_changed');end if;
 -- Do not bury open flags from an earlier already-superseded QA session.
 if exists(select 1 from public.artales_semantic_qa_flags f
   where f.candidate_id=p_candidate_id and f.status='open'
     and f.revision_sha256<>p_parent_sha)
 then return pg_catalog.jsonb_build_object('result','older_unresolved_flags');end if;
 select count(*) into v_n from public.artales_semantic_qa_flags f
 where f.candidate_id=p_candidate_id and f.revision_sha256=p_parent_sha
  and f.status='open';
 if v_n<>pg_catalog.cardinality(v_job.flag_ids)
 then return pg_catalog.jsonb_build_object('result','new_flags_after_job');end if;

 for v_item in select value from pg_catalog.jsonb_array_elements(p_decisions) loop
  select * into v_flag from public.artales_semantic_qa_flags f
  where f.id=(v_item->>'flagId')::uuid and f.candidate_id=p_candidate_id
    and f.revision_sha256=p_parent_sha and f.status='open';
  if not found then return pg_catalog.jsonb_build_object('result','invalid_flag');end if;
  select value into v_suggestion
  from pg_catalog.jsonb_array_elements(v_job.suggestions) x(value)
  where x.value->>'flagId'=v_flag.id::text;
  if v_suggestion is null then
   return pg_catalog.jsonb_build_object('result','missing_suggestion');end if;
  if v_item->>'action'='reject' then
   v_reject:=v_reject+1;
  elsif v_item->>'action'='exclude_note' then
   if v_suggestion->>'action'<>'manual_review'
     or v_suggestion->>'editorialIntent'<>'exclude_from_edition'
     or v_flag.kind not in ('text','typography','structure','other')
     or not exists(select 1 from pg_catalog.jsonb_path_query(v_old.revision,'$.blocks.**') n
       where n->>'kind' in ('paragraph','quote','epigraph','footnote')
         and n->'atom'->>'id'=v_flag.target_atom_id)
   then return pg_catalog.jsonb_build_object('result','unauthorized_exclusion');end if;
   v_exclusions:=v_exclusions+1;
  elsif v_item->>'action' in ('compact','airy','center') then
   if v_suggestion->>'action'<>v_item->>'action'
     or v_flag.kind not in ('typography','structure')
   then return pg_catalog.jsonb_build_object('result','unauthorized_layout');end if;
   v_layout:=v_layout+1;
  elsif v_item->>'action'='protect_term' then
   v_rule:=btrim(v_item->>'term');
   if v_suggestion->>'action'<>'protect_term'
      or v_suggestion->>'term'<>v_rule or v_rule is null
      or length(v_rule) not between 2 and 80
      or v_rule !~ '^[[:alpha:]][[:alpha:] ''’-]{1,79}$'
      or pg_catalog.strpos(v_old.source_text,v_rule)=0
   then return pg_catalog.jsonb_build_object('result','invalid_protected_term');end if;
   v_rules:=v_rules+1;
  elsif v_item->>'action'='confirm_no_change' then
   if v_suggestion->>'action' not in ('manual_review','protect_term')
     or v_suggestion->>'editorialIntent'='exclude_from_edition'
   then return pg_catalog.jsonb_build_object('result','unsafe_no_change');end if;
   v_confirm:=v_confirm+1;
  end if;
 end loop;
 if v_exclusions+v_layout+v_rules+v_confirm+v_reject
      <>pg_catalog.jsonb_array_length(p_decisions)
 then return pg_catalog.jsonb_build_object('result','incomplete_plan');end if;

 if v_exclusions+v_layout>0 then
  if p_revision is null or pg_catalog.jsonb_typeof(p_revision)<>'object'
  then return pg_catalog.jsonb_build_object('result','missing_revision');end if;
  v_new_sha:=p_revision->>'revision_sha256';
  if v_new_sha is null or v_new_sha !~ '^[a-f0-9]{64}$'
    or v_new_sha=p_parent_sha
    or p_revision->>'revision_ref'<>'sha256:'||v_new_sha
    or p_revision->>'parent_revision_ref'<>'sha256:'||p_parent_sha
    or (p_revision->>'round')::int<>(v_old.revision->>'round')::int+1
    or p_revision->>'schema'<>'artales.semantic-text.v2'
    or p_revision->>'state'<>'draft_qa_only'
    or p_revision->'release_allowed'<>'false'::jsonb
    or p_revision->'source' is distinct from v_old.revision->'source'
    or p_revision->'gaps' is distinct from v_old.revision->'gaps'
    or p_revision->'title_page' is distinct from v_old.revision->'title_page'
    or public.artales_strip_semantic_presentation(p_revision->'blocks')
      is distinct from public.artales_strip_semantic_presentation(v_old.revision->'blocks')
    or (p_revision-array['revision_sha256','revision_ref','parent_revision_ref',
              'round','blocks','review_issues','editorial_exclusions'])
      is distinct from
       (v_old.revision-array['revision_sha256','revision_ref','parent_revision_ref',
              'round','blocks','review_issues','editorial_exclusions'])
  then return pg_catalog.jsonb_build_object('result','changed_source_or_structure');end if;

  -- No two changes can silently compete over the same exact source atom.
  select count(distinct f.target_atom_id) into v_n
  from pg_catalog.jsonb_array_elements(p_decisions) d(value)
  join public.artales_semantic_qa_flags f on f.id=(d.value->>'flagId')::uuid
  where d.value->>'action' in ('exclude_note','compact','airy','center');
  if v_n<>v_exclusions+v_layout
  then return pg_catalog.jsonb_build_object('result','duplicate_change_target');end if;

  v_old_exclusions:=coalesce(v_old.revision->'editorial_exclusions','[]'::jsonb);
  v_new_exclusions:=coalesce(p_revision->'editorial_exclusions','[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_old_exclusions)<>'array'
    or pg_catalog.jsonb_typeof(v_new_exclusions)<>'array'
    or pg_catalog.jsonb_array_length(v_new_exclusions)
       <>pg_catalog.jsonb_array_length(v_old_exclusions)+v_exclusions
    or (select count(distinct item.value)
       from pg_catalog.jsonb_array_elements_text(v_new_exclusions) item(value))
       <>pg_catalog.jsonb_array_length(v_new_exclusions)
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(v_old_exclusions) x(value)
       where not v_new_exclusions ? x.value)
  then return pg_catalog.jsonb_build_object('result','invalid_exclusion_delta');end if;
  select coalesce(pg_catalog.jsonb_agg(f.target_atom_id order by f.target_atom_id),'[]'::jsonb)
    into v_expected_delta
  from pg_catalog.jsonb_array_elements(p_decisions) d(value)
  join public.artales_semantic_qa_flags f on f.id=(d.value->>'flagId')::uuid
  where d.value->>'action'='exclude_note';
  select coalesce(pg_catalog.jsonb_agg(e.value order by e.value),'[]'::jsonb)
   into v_delta from pg_catalog.jsonb_array_elements_text(v_new_exclusions) e(value)
   where not v_old_exclusions ? e.value;
  if v_delta is distinct from v_expected_delta
  then return pg_catalog.jsonb_build_object('result','unattributed_exclusion');end if;

  v_old_index:=public.artales_semantic_presentation_index(v_old.revision->'blocks');
  v_new_index:=public.artales_semantic_presentation_index(p_revision->'blocks');
  if (select pg_catalog.array_agg(key order by key) from pg_catalog.jsonb_each(v_old_index))
     is distinct from
     (select pg_catalog.array_agg(key order by key) from pg_catalog.jsonb_each(v_new_index))
  then return pg_catalog.jsonb_build_object('result','changed_node_structure');end if;
  v_changed:=0;
  for v_path,v_node in select key,value from pg_catalog.jsonb_each(v_old_index) loop
   if v_node->'targets' is distinct from (v_new_index->v_path)->'targets'
   then return pg_catalog.jsonb_build_object('result','changed_text_targets');end if;
   if v_node->'presentation' is distinct from (v_new_index->v_path)->'presentation' then
    v_changed:=v_changed+1;
    select count(*) into v_matched
    from pg_catalog.jsonb_array_elements(p_decisions) d(value)
    join public.artales_semantic_qa_flags f on f.id=(d.value->>'flagId')::uuid
    join lateral pg_catalog.jsonb_array_elements(p_revision->'review_issues') i(value)
      on i.value->>'id'=f.id::text
    where d.value->>'action' in ('compact','airy','center')
      and (v_new_index->v_path->'targets') ? f.target_atom_id
      and i.value->>'requested_layout'='block_presentation'
      and i.value->'requested_presentation'
        is not distinct from (v_new_index->v_path)->'presentation';
    if v_matched<>1
    then return pg_catalog.jsonb_build_object('result','unattributed_layout');end if;
   end if;
  end loop;
  if v_changed<>v_layout
  then return pg_catalog.jsonb_build_object('result','layout_delta_mismatch');end if;

  v_old_count:=pg_catalog.jsonb_array_length(v_old.revision->'review_issues');
  if pg_catalog.jsonb_array_length(p_revision->'review_issues')
      <>v_old_count+v_layout+v_exclusions
    or coalesce((select pg_catalog.jsonb_agg(value order by ordinality)
      from pg_catalog.jsonb_array_elements(p_revision->'review_issues')
      with ordinality i(value,ordinality) where ordinality<=v_old_count),'[]'::jsonb)
      is distinct from v_old.revision->'review_issues'
  then return pg_catalog.jsonb_build_object('result','issue_history_changed');end if;
  for v_issue in select value from pg_catalog.jsonb_array_elements(p_revision->'review_issues')
    with ordinality i(value,ordinality) where ordinality>v_old_count loop
   select value into v_item from pg_catalog.jsonb_array_elements(p_decisions) d(value)
    where d.value->>'flagId'=v_issue->>'id';
   if v_item is null
    or (v_issue->>'round')::int<>(p_revision->>'round')::int
    or v_issue->>'parent_revision_ref'<>'sha256:'||p_parent_sha
    or not exists(select 1 from public.artales_semantic_qa_flags f
      where f.id::text=v_issue->>'id' and f.candidate_id=p_candidate_id
        and f.revision_sha256=p_parent_sha and f.status='open'
        and f.target_atom_id=v_issue->>'target_atom_id'
        and f.comment=v_issue->>'reason')
    or (v_item->>'action'='exclude_note' and
         (v_issue->>'requested_layout'<>'exclude_from_edition'
           or v_issue ? 'requested_presentation'))
    or (v_item->>'action' in ('compact','airy','center') and
         (v_issue->>'requested_layout'<>'block_presentation'
           or v_issue->'requested_presentation' is null))
    or v_item->>'action' not in ('exclude_note','compact','airy','center')
   then return pg_catalog.jsonb_build_object('result','unverified_issue');end if;
  end loop;
 else
  if p_revision is not null
  then return pg_catalog.jsonb_build_object('result','unexpected_revision');end if;
 end if;

 -- All checks complete. Every following mutation is ONE Postgres transaction.
 if v_new_sha is not null then
  insert into public.candidate_semantic_revisions(candidate_id,snapshot_sha256,
    revision_sha256,revision,source_text,component_id,source_manifest,
    image_selection,status,authored_by)
  values(p_candidate_id,v_old.snapshot_sha256,v_new_sha,p_revision,v_old.source_text,
   v_old.component_id,v_old.source_manifest,v_old.image_selection,'draft',p_editor_id);
  if not exists(select 1 from public.artales_editorial_tasks t
    where t.candidate_id=p_candidate_id and t.revision_sha256=v_new_sha
      and t.kind='text_review' and t.assigned_to=p_editor_id and t.status='open')
  then raise exception 'followup_qa_missing';end if;
 end if;

 for v_item in select value from pg_catalog.jsonb_array_elements(p_decisions) loop
  select * into v_flag from public.artales_semantic_qa_flags f
   where f.id=(v_item->>'flagId')::uuid and f.status='open' for update;
  if not found then raise exception 'qa_flag_race';end if;
  if v_item->>'action'='reject' then
   if v_new_sha is not null then
    -- Old revision is superseded; keep rejected work OPEN on the new revision.
    update public.artales_semantic_qa_flags set status='resolved',
      resolved_by=p_editor_id,resolved_at=now(),
      resolution_note='Nález přenesen do nové QA revize '||v_new_sha||
       '; stále čeká na opravu, nejde o vyřešený problém.'
     where id=v_flag.id and status='open';
    insert into public.artales_semantic_qa_flags(candidate_id,revision_sha256,
      target_atom_id,source_start,source_end,kind,comment,created_by)
    values(p_candidate_id,v_new_sha,v_flag.target_atom_id,v_flag.source_start,
      v_flag.source_end,v_flag.kind,v_flag.comment,v_flag.created_by);
    v_carried:=v_carried+1;
   end if;
  else
   if v_item->>'action'='protect_term' then
    insert into public.artales_work_typography_rules(candidate_id,term,created_by)
    values(p_candidate_id,btrim(v_item->>'term'),p_editor_id)
    on conflict(candidate_id,term) do nothing;
   end if;
   update public.artales_semantic_qa_flags set status='resolved',
     resolved_by=p_editor_id,resolved_at=now(),
     resolution_note=case v_item->>'action'
       when 'exclude_note' then 'Schválené vyřazení z edice v revizi '||v_new_sha
       when 'protect_term' then 'Editor schválil celoknižní ochranu výrazu '||btrim(v_item->>'term')||'. Archiv zachován.'
       when 'confirm_no_change' then 'Editor zkontroloval nález a schválil beze změny. Výslovné lidské rozhodnutí.'
       else 'Schválená sazební oprava v revizi '||v_new_sha||'; čeká na kontrolu změny.'
     end
   where id=v_flag.id and status='open';
   get diagnostics v_changed=row_count;
   if v_changed<>1 then raise exception 'qa_resolution_race';end if;
   v_resolved:=v_resolved+1;
  end if;
 end loop;
 if v_new_sha is not null then
  update public.artales_editorial_tasks set status='superseded'
  where candidate_id=p_candidate_id and revision_sha256=p_parent_sha
    and kind='text_review' and assigned_to=p_editor_id and status='claimed';
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'supersede_failed';end if;
  update public.artales_editorial_tasks set status='claimed'
  where candidate_id=p_candidate_id and revision_sha256=v_new_sha
    and kind='text_review' and assigned_to=p_editor_id and status='open';
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'qa_session_continuation_failed';end if;
  insert into public.artales_semantic_change_reviews(candidate_id,revision_sha256,
    issue_id,target_atom_id,decision,note,reviewed_by)
  select p_candidate_id,v_new_sha,i.value->>'id',i.value->>'target_atom_id',
    'accepted',null,p_editor_id
  from pg_catalog.jsonb_array_elements(p_revision->'review_issues') i(value)
  where (i.value->>'round')::integer=(p_revision->>'round')::integer
    and i.value->>'requested_layout'='exclude_from_edition'
    and exists(select 1 from pg_catalog.jsonb_array_elements(p_decisions) d(value)
      where d.value->>'flagId'=i.value->>'id' and d.value->>'action'='exclude_note');
  get diagnostics v_changed=row_count;
  if v_changed<>v_exclusions then raise exception 'exclusion_receipt_failed';end if;
  update public.artales_semantic_ai_qa_jobs set applied_revision_sha256=v_new_sha,
     updated_at=now() where id=p_job_id and status='completed'
       and applied_revision_sha256 is null;
  get diagnostics v_changed=row_count;
  if v_changed<>1 then raise exception 'job_receipt_race';end if;
 end if;
 return pg_catalog.jsonb_build_object('result',
   case when v_new_sha is not null then 'created' else 'resolved_only' end,
   'revision_sha256',v_new_sha,'resolved',v_resolved,
   'remaining',v_carried+case when v_new_sha is null then v_reject else 0 end,
   'excluded',v_exclusions,'layout',v_layout,'protected',v_rules);
end $function$;

-- This privileged mutation must never be exposed to public/anon/editor SQL.
revoke all on function public.artales_commit_editorial_review_batch(
 uuid,text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.artales_commit_editorial_review_batch(
 uuid,text,uuid,uuid,jsonb,jsonb) to service_role;
