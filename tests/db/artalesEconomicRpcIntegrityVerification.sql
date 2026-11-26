-- Run after A1.1 + A1.2 and the original positive/negative RPC test.
insert into public.profiles(id,is_active,role) values
 ('44444444-4444-4444-8444-444444444444',true,'reader'),
 ('55555555-5555-4555-8555-555555555555',false,'reader'),
 ('66666666-6666-4666-8666-666666666666',true,'reader');
insert into public.works(id,status) values
 ('77777777-7777-4777-8777-777777777777','draft'),
 ('88888888-8888-4888-8888-888888888888','published');
insert into public.reader_credit_ledger(user_id,amount,source) values
 ('44444444-4444-4444-8444-444444444444',10,'purchase'),
 ('55555555-5555-4555-8555-555555555555',10,'purchase'),
 ('66666666-6666-4666-8666-666666666666',7,'purchase');

do $$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    execute format('set local role %I',role_name);
    begin
      perform public.artales_gift_reader_credit('44444444-4444-4444-8444-444444444444',1,gen_random_uuid());
      raise exception 'Expected gift RPC denial';
    exception when insufficient_privilege then
      raise notice 'PASS: gift denied for %',role_name;
    end;
    reset role;
  end loop;
end;
$$;

set role service_role;
do $$
declare
  u uuid := '44444444-4444-4444-8444-444444444444';
  disabled uuid := '55555555-5555-4555-8555-555555555555';
  library_user uuid := '66666666-6666-4666-8666-666666666666';
  draft uuid := '77777777-7777-4777-8777-777777777777';
  work uuid := '88888888-8888-4888-8888-888888888888';
  r jsonb;
begin
  r:=public.activate_reader_membership_with_credits(u,'basic',1,2,0,false);
  if r->>'code' is distinct from 'membership_terms_mismatch' then raise exception 'Incorrect price accepted: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,'plus',4,5,0,true);
  if r->>'code' is distinct from 'membership_terms_mismatch' then raise exception 'Incorrect benefits accepted: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,'basic',2,null,0,false);
  if r->>'code' is distinct from 'membership_terms_mismatch' then raise exception 'NULL benefits accepted: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,'basic',2,2,1,false);
  if r->>'code' is distinct from 'membership_terms_mismatch' then raise exception 'Unexpected bonus accepted: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,null,2,2,0,false);
  if r->>'code' is distinct from 'invalid_tier' then raise exception 'NULL tier accepted: %',r; end if;
  r:=public.use_at_credit_online_unlock(u,draft);
  if r->>'code' is distinct from 'invalid_unlock_target' then raise exception 'Draft charged: %',r; end if;
  r:=public.use_member_online_unlock(u,draft);
  if r->>'code' is distinct from 'invalid_unlock_target' then raise exception 'Draft member unlock accepted: %',r; end if;
  r:=public.use_at_credit_online_unlock(disabled,work);
  if r->>'code' is distinct from 'invalid_account' then raise exception 'Inactive profile charged: %',r; end if;
  r:=public.activate_reader_membership_with_credits(disabled,'basic',2,2,0,false);
  if r->>'code' is distinct from 'invalid_account' then raise exception 'Inactive membership: %',r; end if;
  r:=public.artales_gift_reader_credit(disabled,1,gen_random_uuid());
  if r->>'code' is distinct from 'invalid_account' then raise exception 'Inactive gift: %',r; end if;
  r:=public.artales_gift_reader_credit(u,0,gen_random_uuid());
  if r->>'code' is distinct from 'invalid_credit_gift' then raise exception 'Invalid gift accepted: %',r; end if;
  r:=public.artales_gift_reader_credit(u,11,gen_random_uuid());
  if r->>'code' is distinct from 'not_enough_credit' then raise exception 'Oversized gift accepted: %',r; end if;
  if (select sum(amount) from public.reader_credit_ledger where user_id=u) <> 10
     or exists(select 1 from public.reader_entitlements where user_id in (u,disabled))
     or exists(select 1 from public.reader_member_unlock_ledger where user_id in (u,disabled))
     then raise exception 'Invalid requests changed economic data'; end if;
  r:=public.artales_gift_reader_credit(u,3,gen_random_uuid());
  if r->>'code' is distinct from 'credit_gifted' or (select sum(amount) from public.reader_credit_ledger where user_id=u) <> 7 then raise exception 'Valid gift failed: %',r; end if;
  r:=public.activate_reader_membership_with_credits(library_user,'library',7,0,0,true);
  if r->>'code' is distinct from 'activated' then raise exception 'Library activation failed: %',r; end if;
  r:=public.use_at_credit_online_unlock(library_user,work);
  if r->>'code' is distinct from 'already_unlocked' then raise exception 'Library user charged: %',r; end if;
  r:=public.use_member_online_unlock(library_user,work);
  if r->>'code' is distinct from 'already_unlocked' then raise exception 'Library allowance used: %',r; end if;
  if (select count(*) from public.reader_entitlements where user_id=library_user) <> 1 then raise exception 'Library access duplicated'; end if;
  raise notice 'PASS: terms, active account, published work, gift balance, library access';
end;
$$;
reset role;
do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean)'::regprocedure,
    'public.use_at_credit_online_unlock(uuid,uuid)'::regprocedure,
    'public.use_member_online_unlock(uuid,uuid)'::regprocedure,
    'public.artales_gift_reader_credit(uuid,integer,uuid)'::regprocedure
  ] loop
    if (select prosecdef from pg_proc where oid=f) then raise exception 'Unexpected owner privilege: %',f; end if;
  end loop;
end;
$$;
