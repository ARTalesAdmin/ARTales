-- ARTales v0.10.13g - Membership activation with AT Credits
-- Adds a separate allowance ledger for member online unlocks and an atomic RPC
-- for activating/prolonging Basic, Plus and Library memberships from AT Credit balance.

create table if not exists public.reader_member_unlock_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  source text not null check (source in ('membership_activation', 'online_unlock_spend', 'admin_adjustment', 'promo')),
  related_work_id uuid references public.works(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reader_member_unlock_ledger_user_idx
  on public.reader_member_unlock_ledger(user_id, created_at desc);

alter table public.reader_member_unlock_ledger enable row level security;

drop policy if exists "users can read own member unlock ledger" on public.reader_member_unlock_ledger;
create policy "users can read own member unlock ledger"
  on public.reader_member_unlock_ledger for select
  using (auth.uid() = user_id);

insert into public.membership_plans (
  code,
  name,
  description,
  intro_price_eur,
  future_price_eur,
  intro_unlock_note,
  monthly_online_unlocks,
  monthly_at_credits,
  unlimited_online_reading,
  is_promotional,
  display_order,
  is_active
)
values
  ('free_reader', 'Free Reader', 'Registered reader account with profile-backed reader tools, AT Credits and one welcome online unlock.', 0, 0, 'Free reader account with one welcome online unlock.', 1, 0, false, false, 0, true),
  ('basic', 'Basic', 'Reader membership with two member online unlocks and one AT Credit bonus.', 2, 4, 'Founding price for the first wave of ARTales readers.', 2, 1, false, true, 10, true),
  ('plus', 'Plus', 'Best-value membership with five member online unlocks and one AT Credit bonus.', 4, 7, 'Founding price for the first wave of ARTales readers.', 5, 1, false, true, 20, true),
  ('library', 'Library', 'Online catalogue access while active, plus two AT Credits.', 7, 10, 'Founding price for the first wave of ARTales readers.', 0, 2, true, true, 30, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  intro_price_eur = excluded.intro_price_eur,
  future_price_eur = excluded.future_price_eur,
  intro_unlock_note = excluded.intro_unlock_note,
  monthly_online_unlocks = excluded.monthly_online_unlocks,
  monthly_at_credits = excluded.monthly_at_credits,
  unlimited_online_reading = excluded.unlimited_online_reading,
  is_promotional = excluded.is_promotional,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.activate_reader_membership_with_credits(
  p_user_id uuid,
  p_tier text,
  p_price_at integer,
  p_member_unlocks integer,
  p_bonus_at integer,
  p_library_access boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_existing_other text;
  v_base_start timestamptz;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
begin
  if p_tier not in ('basic', 'plus', 'library') then
    return jsonb_build_object('ok', false, 'code', 'invalid_tier');
  end if;

  if p_price_at <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_price');
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id;

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
      'expires_at', v_expires_at
    )
  );

  if p_bonus_at > 0 then
    insert into public.reader_credit_ledger (
      user_id,
      amount,
      source,
      note,
      metadata
    ) values (
      p_user_id,
      p_bonus_at,
      'subscription_monthly',
      'Membership AT bonus: ' || p_tier,
      jsonb_build_object(
        'kind', 'membership_bonus',
        'plan', p_tier,
        'starts_at', v_starts_at,
        'expires_at', v_expires_at
      )
    );
  end if;

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
      'bonus_at', p_bonus_at,
      'library_access', p_library_access,
      'period_days', 30
    )
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'activated',
    'plan', p_tier,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'price_at', p_price_at,
    'bonus_at', p_bonus_at,
    'member_unlocks', p_member_unlocks,
    'balance_before', v_balance,
    'balance_after', v_balance - p_price_at + greatest(p_bonus_at, 0)
  );
end;
$$;
