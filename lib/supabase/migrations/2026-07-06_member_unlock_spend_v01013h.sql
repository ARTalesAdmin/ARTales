-- ARTales v0.10.13h - Member unlock spending for online reading
-- Lets readers spend separate member online unlock allowances on permanent
-- online_read entitlements, and keeps the existing 1 AT unlock flow atomic.

create or replace function public.use_member_online_unlock(
  p_user_id uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
    and is_active = true
    and starts_at <= v_now
    and (expires_at is null or expires_at > v_now)
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_member_unlock_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'code', 'not_enough_member_unlocks', 'balance', v_balance);
  end if;

  insert into public.reader_member_unlock_ledger (
    user_id,
    amount,
    source,
    related_work_id,
    note,
    metadata
  ) values (
    p_user_id,
    -1,
    'online_unlock_spend',
    p_work_id,
    'Member online unlock used.',
    jsonb_build_object(
      'kind', 'member_online_unlock_spend',
      'work_id', p_work_id
    )
  );

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    update public.reader_entitlements
      set source = 'subscription_monthly',
          granted_by_user_id = null,
          note = 'Permanent online reading unlocked with a member unlock.',
          is_active = true,
          starts_at = v_now,
          expires_at = null,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'kind', 'member_online_unlock_spend',
            'unlocked_at', v_now
          ),
          updated_at = v_now
    where id = v_entitlement_id;
  else
    insert into public.reader_entitlements (
      user_id,
      work_id,
      entitlement_type,
      source,
      granted_by_user_id,
      is_active,
      starts_at,
      expires_at,
      note,
      metadata
    ) values (
      p_user_id,
      p_work_id,
      'online_read',
      'subscription_monthly',
      null,
      true,
      v_now,
      null,
      'Permanent online reading unlocked with a member unlock.',
      jsonb_build_object(
        'kind', 'member_online_unlock_spend',
        'unlocked_at', v_now
      )
    )
    returning id into v_entitlement_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'member_unlock_used',
    'work_id', p_work_id,
    'entitlement_id', v_entitlement_id,
    'balance_before', v_balance,
    'balance_after', v_balance - 1
  );
end;
$$;

create or replace function public.use_at_credit_online_unlock(
  p_user_id uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
    and is_active = true
    and starts_at <= v_now
    and (expires_at is null or expires_at > v_now)
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'code', 'not_enough_credit', 'balance', v_balance);
  end if;

  insert into public.reader_credit_ledger (
    user_id,
    amount,
    source,
    note,
    metadata
  ) values (
    p_user_id,
    -1,
    'credit_spend',
    'Online reading unlock.',
    jsonb_build_object(
      'kind', 'online_unlock_spend',
      'work_id', p_work_id
    )
  );

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    update public.reader_entitlements
      set source = 'credit_spend',
          granted_by_user_id = null,
          note = 'Permanent online reading unlocked with 1 AT Credit.',
          is_active = true,
          starts_at = v_now,
          expires_at = null,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'kind', 'online_unlock_spend',
            'price_at', 1,
            'unlocked_at', v_now
          ),
          updated_at = v_now
    where id = v_entitlement_id;
  else
    insert into public.reader_entitlements (
      user_id,
      work_id,
      entitlement_type,
      source,
      granted_by_user_id,
      is_active,
      starts_at,
      expires_at,
      note,
      metadata
    ) values (
      p_user_id,
      p_work_id,
      'online_read',
      'credit_spend',
      null,
      true,
      v_now,
      null,
      'Permanent online reading unlocked with 1 AT Credit.',
      jsonb_build_object(
        'kind', 'online_unlock_spend',
        'price_at', 1,
        'unlocked_at', v_now
      )
    )
    returning id into v_entitlement_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'credit_unlock_used',
    'work_id', p_work_id,
    'entitlement_id', v_entitlement_id,
    'balance_before', v_balance,
    'balance_after', v_balance - 1
  );
end;
$$;
