-- A1 rollback/compatibility proof on disposable PostgreSQL only.
insert into public.profiles(id) values
 ('14141414-1414-4414-8414-141414141414'),
 ('15151515-1515-4515-8515-151515151515'),
 ('16161616-1616-4616-8616-161616161616'),
 ('17171717-1717-4717-8717-171717171717');
insert into public.reader_credit_ledger(user_id,amount,source) values
 ('14141414-1414-4414-8414-141414141414',5,'purchase'),
 ('15151515-1515-4515-8515-151515151515',1,'purchase'),
 ('17171717-1717-4717-8717-171717171717',1,'purchase');

-- Test-only trigger simulates a write failure after membership ledger inserts.
create function public.ci_reject_membership_insert()
returns trigger language plpgsql as $$
begin
  if new.user_id='14141414-1414-4414-8414-141414141414' and new.entitlement_type='membership_access' then
    raise exception 'CI forced entitlement failure' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger ci_reject_membership_insert before insert on public.reader_entitlements
for each row execute function public.ci_reject_membership_insert();

set role service_role;
do $$
declare
  u uuid:='14141414-1414-4414-8414-141414141414';
  legacy uuid:='15151515-1515-4515-8515-151515151515';
  welcome uuid:='16161616-1616-4616-8616-161616161616';
  existing uuid:='17171717-1717-4717-8717-171717171717';
  published uuid:='22222222-2222-4222-8222-222222222222';
  draft uuid:='77777777-7777-4777-8777-777777777777';
  k uuid:='12121212-1212-4212-8212-121212121212';
begin
  begin
    perform public.activate_reader_membership_with_credits(u,'basic',2,2,0,false,k);
    raise exception 'Expected injected entitlement failure';
  exception when check_violation then
    if sqlerrm <> 'CI forced entitlement failure' then raise; end if;
  end;
  if (select sum(amount) from public.reader_credit_ledger where user_id=u)<>5
    or exists(select 1 from public.reader_credit_ledger where user_id=u and metadata ? 'economic_request_id')
    or exists(select 1 from public.reader_member_unlock_ledger where user_id=u)
    or exists(select 1 from public.reader_entitlements where user_id=u) then
    raise exception 'Partial economic write survived rollback';
  end if;
  insert into public.reader_credit_ledger(user_id,amount,source) values(legacy,-1,'contribution');
  begin
    insert into public.reader_credit_ledger(user_id,amount,source) values(legacy,-1,'contribution');
    raise exception 'Legacy overdraw accepted';
  exception when check_violation then
    if sqlerrm <> 'Insufficient balance for customer debit' then raise; end if;
  end;
  if (select sum(amount) from public.reader_credit_ledger where user_id=legacy)<>0 then
    raise exception 'Legacy debit guard incorrect';
  end if;
  -- Do not accidentally change the separately governed refund policy.
  insert into public.reader_credit_ledger(user_id,amount,source) values(legacy,-1,'admin_adjustment');
  begin
    insert into public.reader_entitlements(user_id,work_id,entitlement_type,source)
      values(welcome,draft,'online_read','welcome_unlock');
    raise exception 'Legacy draft claim accepted';
  exception when check_violation then
    if sqlerrm <> 'Welcome target is not published' then raise; end if;
  end;
  if (select welcome_unlock_claimed_at from public.profiles where id=welcome) is not null then
    raise exception 'Failed legacy grant consumed welcome claim';
  end if;
  insert into public.reader_entitlements(user_id,work_id,entitlement_type,source)
    values(existing,published,'online_read','manual_grant');
  begin
    update public.reader_entitlements set source='welcome_unlock' where user_id=existing and work_id=published;
    raise exception 'Legacy grant reclassified active access';
  exception when check_violation then
    if sqlerrm <> 'Existing access must not consume welcome unlock' then raise; end if;
  end;
  if (select welcome_unlock_claimed_at from public.profiles where id=existing) is not null then
    raise exception 'Existing access consumed welcome claim';
  end if;
  raise notice 'PASS: injected rollback, legacy debit guard, legacy welcome guard and refund behavior';
end;
$$;
reset role;
drop trigger ci_reject_membership_insert on public.reader_entitlements;
set role service_role;
do $$
declare r jsonb;
begin
  r:=public.activate_reader_membership_with_credits('14141414-1414-4414-8414-141414141414','basic',2,2,0,false,'12121212-1212-4212-8212-121212121212');
  if r->>'code' is distinct from 'activated' then raise exception 'Retry after rollback failed: %',r; end if;
  if (select sum(amount) from public.reader_credit_ledger where user_id='14141414-1414-4414-8414-141414141414')<>3 then raise exception 'Retry debited incorrectly'; end if;
  raise notice 'PASS: same request succeeds once after full rollback';
end;
$$;
reset role;
