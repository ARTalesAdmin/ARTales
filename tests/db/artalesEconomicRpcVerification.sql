-- Run after the exact candidate/canonical SQL. All actors and data are synthetic.
-- Check actual execution under each browser role, not only metadata.
do $$
declare actor text; statement text;
begin
  foreach actor in array array['anon','authenticated'] loop
    execute format('set local role %I', actor);
    foreach statement in array array[
      'select public.activate_reader_membership_with_credits(''11111111-1111-4111-8111-111111111111'',''basic'',2,2,0,false)',
      'select public.use_at_credit_online_unlock(''11111111-1111-4111-8111-111111111111'',''22222222-2222-4222-8222-222222222222'')',
      'select public.use_member_online_unlock(''11111111-1111-4111-8111-111111111111'',''33333333-3333-4333-8333-333333333333'')'
    ] loop
      begin
        execute statement;
        raise exception 'Expected SQLSTATE 42501 for role %', actor;
      exception when insufficient_privilege then
        raise notice 'PASS: denied for %', actor;
      end;
    end loop;
    reset role;
  end loop;
end;
$$;
do $$
begin
  if (select count(*) from public.reader_credit_ledger) <> 1
     or exists(select 1 from public.reader_entitlements)
     or exists(select 1 from public.reader_member_unlock_ledger) then
    raise exception 'Denied requests changed fixture data';
  end if;
end;
$$;

set role service_role;
do $$
declare
  u uuid := '11111111-1111-4111-8111-111111111111';
  w1 uuid := '22222222-2222-4222-8222-222222222222';
  w2 uuid := '33333333-3333-4333-8333-333333333333';
  result jsonb;
begin
  result := public.activate_reader_membership_with_credits(u,'basic',2,2,0,false);
  if result->>'code' is distinct from 'activated' then raise exception 'Activation failed: %',result; end if;
  result := public.use_member_online_unlock(u,w1);
  if result->>'code' is distinct from 'member_unlock_used' then raise exception 'Member unlock failed: %',result; end if;
  result := public.use_at_credit_online_unlock(u,w2);
  if result->>'code' is distinct from 'credit_unlock_used' then raise exception 'AT unlock failed: %',result; end if;
  result := public.use_member_online_unlock(u,w1);
  if result->>'code' is distinct from 'already_unlocked' then raise exception 'Repeat member unlock failed: %',result; end if;
  result := public.use_at_credit_online_unlock(u,w2);
  if result->>'code' is distinct from 'already_unlocked' then raise exception 'Repeat AT unlock failed: %',result; end if;
  if (select sum(amount) from public.reader_credit_ledger where user_id=u) <> 0
     or (select sum(amount) from public.reader_member_unlock_ledger where user_id=u) <> 1
     or (select count(*) from public.reader_entitlements where user_id=u) <> 3
     or (select count(*) from public.reader_entitlements where user_id=u and entitlement_type='online_read' and expires_at is null) <> 2
     then raise exception 'Unexpected economic state'; end if;
  raise notice 'PASS: service-role activation, both unlocks and sequential replay';
end;
$$;
reset role;
