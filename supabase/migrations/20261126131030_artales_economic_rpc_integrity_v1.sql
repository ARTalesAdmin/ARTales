-- The committed debit is the idempotency record, not a second ledger.
create unique index reader_credit_ledger_economic_request_idx
  on public.reader_credit_ledger(user_id,(metadata->>'economic_request_id'))
  where metadata ? 'economic_request_id';

-- A1.2 economic RPC integrity, source proposal.
-- Existing public signatures retained. Server-only functions run as their
-- service caller rather than with owner privileges. No changes to plan values,
-- historical ledger entries, entitlement duration, or allowance carry-over.
create or replace function public.activate_reader_membership_with_credits(
  p_user_id uuid,
  p_tier text,
  p_price_at integer,
  p_member_unlocks integer,
  p_bonus_at integer,
  p_library_access boolean,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_balance bigint;
  v_now timestamptz;
  v_existing_other text;
  v_plan public.membership_plans%rowtype;
  v_base_start timestamptz;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_request jsonb := jsonb_build_object('kind','membership_activation','tier',p_tier,'price_at',p_price_at,'member_unlocks',p_member_unlocks,'bonus_at',p_bonus_at,'library_access',p_library_access);
  v_previous jsonb;
  v_result jsonb;
begin
  if p_tier is null or p_tier not in ('basic', 'plus', 'library') then
    return jsonb_build_object('ok', false, 'code', 'invalid_tier');
  end if;

  if p_price_at is null or p_price_at <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_price');
  end if;

  -- All customer debits serialize on the same profile row. At READ COMMITTED,
  -- subsequent balance and entitlement reads observe the previous committed spend.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic RPC requires READ COMMITTED' using errcode = '25000';
  end if;
  perform 1 from public.profiles
  where id = p_user_id and is_active = true
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_account');
  end if;
  v_now := clock_timestamp();

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'request_id_required');
  end if;
  select metadata into v_previous
  from public.reader_credit_ledger
  where user_id = p_user_id and metadata ? 'economic_request_id'
    and metadata->>'economic_request_id' = p_request_id::text;
  if found then
    if v_previous->'economic_request' is distinct from v_request
       or v_previous->'economic_result' is null then
      return jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    return v_previous->'economic_result';
  end if;

  -- The existing wallet-cleanup migration mirrors founding AT values in the
  -- historical intro_price_eur field. Compare the server pricebook snapshot;
  -- do not convert currency or silently charge a different price.
  select * into v_plan
  from public.membership_plans
  where code = p_tier and is_active = true
  for share;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_tier');
  end if;
  if v_plan.intro_price_eur is distinct from p_price_at::numeric
     or v_plan.monthly_online_unlocks is distinct from p_member_unlocks
     or p_bonus_at is distinct from 0
     or v_plan.monthly_at_credits is distinct from 0
     or v_plan.unlimited_online_reading is distinct from p_library_access then
    return jsonb_build_object('ok', false, 'code', 'membership_terms_mismatch');
  end if;

  select coalesce(sum(amount), 0)
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id and credit_type = 'at_credit';

  if v_balance < p_price_at then
    return jsonb_build_object('ok', false, 'code', 'not_enough_credit', 'balance', v_balance);
  end if;

  select metadata->>'plan'
    into v_existing_other
  from public.reader_entitlements
  where user_id = p_user_id
    and entitlement_type = 'membership_access'
    and is_active = true
    and coalesce(expires_at, v_now) > v_now
    and coalesce(metadata->>'plan', '') <> p_tier
  order by expires_at desc nulls last
  limit 1;

  if v_existing_other is not null then
    return jsonb_build_object('ok', false, 'code', 'other_membership_active', 'active_tier', v_existing_other);
  end if;

  select max(expires_at)
    into v_base_start
  from public.reader_entitlements
  where user_id = p_user_id
    and entitlement_type = 'membership_access'
    and is_active = true
    and coalesce(metadata->>'plan', '') = p_tier
    and expires_at > v_now;

  v_starts_at := greatest(v_now, coalesce(v_base_start, v_now));
  v_expires_at := v_starts_at + interval '30 days';

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'activated',
    'plan', p_tier,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'price_at', p_price_at,
    'bonus_at', 0,
    'member_unlocks', p_member_unlocks,
    'balance_before', v_balance,
    'balance_after', v_balance - p_price_at
  );

  insert into public.reader_credit_ledger (
    user_id,
    amount,
    source,
    note,
    metadata
  ) values (
    p_user_id,
    -p_price_at,
    'credit_spend',
    'Membership activation: ' || p_tier,
    jsonb_build_object(
      'kind', 'membership_activation',
      'plan', p_tier,
      'period_days', 30,
      'starts_at', v_starts_at,
      'expires_at', v_expires_at,
      'bonus_at', 0,
      'bonus_policy', 'at_wallet_cleanup_v01013j',
      'economic_request_id', p_request_id,
      'economic_request', v_request,
      'economic_result', v_result
    )
  );

  if p_member_unlocks > 0 then
    insert into public.reader_member_unlock_ledger (
      user_id,
      amount,
      source,
      note,
      metadata
    ) values (
      p_user_id,
      p_member_unlocks,
      'membership_activation',
      'Member online unlocks: ' || p_tier,
      jsonb_build_object(
        'kind', 'membership_unlock_allowance',
        'plan', p_tier,
        'starts_at', v_starts_at,
        'expires_at', v_expires_at
      )
    );
  end if;

  insert into public.reader_entitlements (
    user_id,
    work_id,
    entitlement_type,
    source,
    is_active,
    starts_at,
    expires_at,
    note,
    metadata
  ) values (
    p_user_id,
    null,
    'membership_access',
    'subscription_monthly',
    true,
    v_starts_at,
    v_expires_at,
    'Membership access: ' || p_tier,
    jsonb_build_object(
      'plan', p_tier,
      'price_at', p_price_at,
      'member_unlocks', p_member_unlocks,
      'bonus_at', 0,
      'library_access', p_library_access,
      'period_days', 30,
      'payment_model', 'at_wallet'
    )
  );

  return v_result;
end;
$$;

-- Compatibility for the currently deployed six-argument server caller.
-- It remains service-only and delegates to the canonical implementation.
-- Retire its service grant after the request-ID application is deployed and verified.
create or replace function public.activate_reader_membership_with_credits(
  p_user_id uuid,p_tier text,p_price_at integer,p_member_unlocks integer,
  p_bonus_at integer,p_library_access boolean
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select public.activate_reader_membership_with_credits(
    p_user_id,p_tier,p_price_at,p_member_unlocks,p_bonus_at,p_library_access,gen_random_uuid()
  );
$$;

create or replace function public.use_member_online_unlock(
  p_user_id uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_balance bigint;
  v_now timestamptz;
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  -- All customer debits serialize on the same profile row. At READ COMMITTED,
  -- subsequent balance and entitlement reads observe the previous committed spend.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic RPC requires READ COMMITTED' using errcode = '25000';
  end if;
  perform 1 from public.profiles
  where id = p_user_id and is_active = true and role::text = 'reader'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_account');
  end if;
  v_now := clock_timestamp();

  perform 1 from public.works
  where id = p_work_id and status::text = 'published'
  for share;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  -- Recheck all-library access under the same lock, before taking payment.
  if exists (
    select 1 from public.reader_entitlements
    where user_id = p_user_id and entitlement_type = 'membership_access'
      and is_active = true and starts_at <= v_now
      and (expires_at is null or expires_at > v_now)
      and metadata->>'plan' = 'library'
  ) then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
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

  select coalesce(sum(amount), 0)
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
security invoker
set search_path = pg_catalog
as $$
declare
  v_balance bigint;
  v_now timestamptz;
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  -- All customer debits serialize on the same profile row. At READ COMMITTED,
  -- subsequent balance and entitlement reads observe the previous committed spend.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic RPC requires READ COMMITTED' using errcode = '25000';
  end if;
  perform 1 from public.profiles
  where id = p_user_id and is_active = true and role::text = 'reader'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_account');
  end if;
  v_now := clock_timestamp();

  perform 1 from public.works
  where id = p_work_id and status::text = 'published'
  for share;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  -- Recheck all-library access under the same lock, before taking payment.
  if exists (
    select 1 from public.reader_entitlements
    where user_id = p_user_id and entitlement_type = 'membership_access'
      and is_active = true and starts_at <= v_now
      and (expires_at is null or expires_at > v_now)
      and metadata->>'plan' = 'library'
  ) then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
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

  select coalesce(sum(amount), 0)
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id and credit_type = 'at_credit';

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

create or replace function public.artales_gift_reader_credit(p_user_id uuid, p_amount integer, p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_balance bigint;
  v_now timestamptz;
  v_request jsonb := jsonb_build_object('kind','credit_gift','amount',p_amount);
  v_previous jsonb;
  v_result jsonb;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_credit_gift');
  end if;
  -- All customer debits serialize on the same profile row. At READ COMMITTED,
  -- subsequent balance and entitlement reads observe the previous committed spend.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic RPC requires READ COMMITTED' using errcode = '25000';
  end if;
  perform 1 from public.profiles
  where id = p_user_id and is_active = true
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_account');
  end if;
  v_now := clock_timestamp();

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'request_id_required');
  end if;
  select metadata into v_previous
  from public.reader_credit_ledger
  where user_id = p_user_id and metadata ? 'economic_request_id'
    and metadata->>'economic_request_id' = p_request_id::text;
  if found then
    if v_previous->'economic_request' is distinct from v_request
       or v_previous->'economic_result' is null then
      return jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    return v_previous->'economic_result';
  end if;

  select coalesce(sum(amount),0) into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id and credit_type = 'at_credit';
  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'code', 'not_enough_credit');
  end if;
  v_result := jsonb_build_object('ok',true,'code','credit_gifted','balance_after',v_balance-p_amount);
  insert into public.reader_credit_ledger (user_id,credit_type,amount,source,note,metadata)
  values (p_user_id,'at_credit',-p_amount,'contribution','Dar kreditu projektu ARTales',
    jsonb_build_object('contribution_kind','artales_project_support','amount',p_amount,
      'economic_request_id',p_request_id,'economic_request',v_request,'economic_result',v_result));
  return v_result;
end;
$$;

-- Persistence boundary for customer AT debits, including the old application's
-- direct contribution INSERT during rollout. The RPCs still own business logic.
-- Administrative reversals are intentionally excluded (C1/C2).
create function public.artales_guard_customer_credit_debit()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
declare
  v_balance bigint;
begin
  if new.source not in ('credit_spend','contribution') then return new; end if;
  if new.credit_type <> 'at_credit' or new.amount >= 0 then
    raise exception 'Invalid customer credit debit' using errcode='23514';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic debit requires READ COMMITTED' using errcode='25000';
  end if;
  perform 1 from public.profiles where id=new.user_id and is_active for update;
  if not found then
    raise exception 'Inactive account for credit debit' using errcode='23514';
  end if;
  select coalesce(sum(amount),0) into v_balance
    from public.reader_credit_ledger where user_id=new.user_id and credit_type='at_credit';
  if v_balance < -(new.amount::bigint) then
    raise exception 'Insufficient balance for customer debit' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.artales_guard_customer_credit_debit() from public, anon, authenticated, service_role;
create trigger artales_customer_credit_debit_guard
before insert on public.reader_credit_ledger
for each row execute function public.artales_guard_customer_credit_debit();

-- Preserve the existing one-time welcome benefit even if the entitlement
-- is later deactivated, reclassified or removed with a work. Backfill only
-- evidence still present in historical entitlement rows.
alter table public.profiles add column welcome_unlock_claimed_at timestamptz;
revoke insert(welcome_unlock_claimed_at), update(welcome_unlock_claimed_at)
  on public.profiles from public, anon, authenticated;

-- Protect both new and still-deployed legacy grant paths during rollout.
-- This is an invoker trigger; no owner privilege elevation.
create function public.artales_record_welcome_claim()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $$
begin
  if new.source <> 'welcome_unlock' then return new; end if;
  if new.entitlement_type <> 'online_read' then
    raise exception 'Invalid welcome entitlement type' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if old.source='welcome_unlock' then
      if old.user_id is distinct from new.user_id or old.work_id is distinct from new.work_id then
        raise exception 'Welcome entitlement cannot be moved' using errcode='23514';
      end if;
      return new;
    end if;
    if old.entitlement_type='online_read' and old.is_active and old.starts_at<=clock_timestamp()
      and (old.expires_at is null or old.expires_at>clock_timestamp()) then
      raise exception 'Existing access must not consume welcome unlock' using errcode='23514';
    end if;
  end if;
  update public.profiles
    set welcome_unlock_claimed_at=clock_timestamp()
    where id=new.user_id and welcome_unlock_claimed_at is null
      and is_active and role::text='reader';
  if not found then
    raise exception 'Welcome unlock unavailable' using errcode='23514';
  end if;
  perform 1 from public.works where id=new.work_id and status::text='published' for share;
  if not found then
    raise exception 'Welcome target is not published' using errcode='23514';
  end if;
  if exists(select 1 from public.reader_entitlements where user_id=new.user_id
    and entitlement_type='membership_access' and is_active and starts_at<=clock_timestamp()
    and (expires_at is null or expires_at>clock_timestamp()) and metadata->>'plan'='library') then
    raise exception 'Existing library access must not consume welcome unlock' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.artales_record_welcome_claim() from public, anon, authenticated, service_role;
create trigger artales_welcome_claim_guard
before insert or update of source,user_id,work_id,entitlement_type on public.reader_entitlements
for each row execute function public.artales_record_welcome_claim();

-- Backfill after installing the trigger and taking its table lock, inside the same migration transaction.
update public.profiles p
set welcome_unlock_claimed_at = e.first_claim
from (
  select user_id,min(created_at) as first_claim
  from public.reader_entitlements
  where source='welcome_unlock' group by user_id
) e
where p.id=e.user_id and p.welcome_unlock_claimed_at is null;

create function public.artales_claim_welcome_unlock(p_user_id uuid,p_work_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog
as $$
declare
  v_claimed timestamptz;
  v_now timestamptz;
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok',false,'code','invalid_unlock_target');
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Economic RPC requires READ COMMITTED' using errcode='25000';
  end if;
  select welcome_unlock_claimed_at into v_claimed from public.profiles
    where id=p_user_id and is_active and role::text='reader' for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid_account'); end if;
  v_now := clock_timestamp();
  perform 1 from public.works where id=p_work_id and status::text='published' for share;
  if not found then return jsonb_build_object('ok',false,'code','invalid_unlock_target'); end if;
  select id into v_entitlement_id from public.reader_entitlements
    where user_id=p_user_id and work_id=p_work_id and entitlement_type='online_read'
      and is_active and starts_at<=v_now and (expires_at is null or expires_at>v_now)
    limit 1;
  if found then
    return jsonb_build_object('ok',true,'code','already_unlocked','entitlement_id',v_entitlement_id);
  end if;
  if exists(select 1 from public.reader_entitlements where user_id=p_user_id
    and entitlement_type='membership_access' and is_active and starts_at<=v_now
    and (expires_at is null or expires_at>v_now) and metadata->>'plan'='library') then
    return jsonb_build_object('ok',true,'code','already_unlocked');
  end if;
  if v_claimed is not null then
    return jsonb_build_object('ok',false,'code','welcome_already_used');
  end if;
  select id into v_entitlement_id from public.reader_entitlements
    where user_id=p_user_id and work_id=p_work_id and entitlement_type='online_read'
    order by is_active desc,created_at desc limit 1;
  if found then
    update public.reader_entitlements
      set source='welcome_unlock',granted_by_user_id=null,note='Free Reader welcome unlock.',
        is_active=true,starts_at=v_now,expires_at=null,updated_at=v_now
      where id=v_entitlement_id;
  else
    insert into public.reader_entitlements(user_id,work_id,entitlement_type,source,note,starts_at)
      values(p_user_id,p_work_id,'online_read','welcome_unlock','Free Reader welcome unlock.',v_now)
      returning id into v_entitlement_id;
  end if;
  -- Trigger owns the durable claim marker. It is part of this transaction.
  return jsonb_build_object('ok',true,'code','welcome_claimed','entitlement_id',v_entitlement_id);
end;
$$;

revoke execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean) from public, anon, authenticated;
revoke execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean,uuid) from public, anon, authenticated;
revoke execute on function public.artales_claim_welcome_unlock(uuid,uuid) from public, anon, authenticated;
grant execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean,uuid) to service_role;
grant execute on function public.artales_claim_welcome_unlock(uuid,uuid) to service_role;
revoke execute on function public.use_at_credit_online_unlock(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.use_member_online_unlock(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.artales_gift_reader_credit(uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.artales_gift_reader_credit(uuid,integer,uuid) to service_role;
grant execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean) to service_role;
grant execute on function public.use_at_credit_online_unlock(uuid,uuid) to service_role;
grant execute on function public.use_member_online_unlock(uuid,uuid) to service_role;

-- Fail the migration rather than silently accepting inherited browser grants.
do $$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean)'::regprocedure,
    'public.use_at_credit_online_unlock(uuid,uuid)'::regprocedure,
    'public.use_member_online_unlock(uuid,uuid)'::regprocedure,
    'public.artales_gift_reader_credit(uuid,integer,uuid)'::regprocedure,
    'public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean,uuid)'::regprocedure,
    'public.artales_claim_welcome_unlock(uuid,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon',f,'EXECUTE')
       or has_function_privilege('authenticated',f,'EXECUTE')
       or not has_function_privilege('service_role',f,'EXECUTE') then
      raise exception 'Unexpected effective RPC permissions: %', f;
    end if;
  end loop;
end;
$$;
do $$
begin
  if has_column_privilege('anon','public.profiles','welcome_unlock_claimed_at','UPDATE')
    or has_column_privilege('authenticated','public.profiles','welcome_unlock_claimed_at','UPDATE')
    or has_column_privilege('anon','public.profiles','welcome_unlock_claimed_at','INSERT')
    or has_column_privilege('authenticated','public.profiles','welcome_unlock_claimed_at','INSERT')
    or not has_column_privilege('service_role','public.profiles','welcome_unlock_claimed_at','UPDATE') then
    raise exception 'Unexpected welcome claim marker permissions';
  end if;
end;
$$;
