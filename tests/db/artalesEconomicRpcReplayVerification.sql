-- Isolated tests of durable idempotency and welcome guard.
insert into public.profiles(id) values
 ('10101010-1010-4010-8010-101010101010'),
 ('20202020-2020-4020-8020-202020202020'),
 ('30303030-3030-4030-8030-303030303030');
insert into public.reader_credit_ledger(user_id,amount,source) values
 ('10101010-1010-4010-8010-101010101010',10,'purchase'),
 ('20202020-2020-4020-8020-202020202020',10,'purchase');
do $$
declare actor text; stmt text;
begin
  foreach actor in array array['anon','authenticated'] loop
    execute format('set local role %I',actor);
    foreach stmt in array array[
      'select public.activate_reader_membership_with_credits(''10101010-1010-4010-8010-101010101010'',''basic'',2,2,0,false,''00000000-0000-4000-8000-000000000001'')',
      'select public.artales_claim_welcome_unlock(''30303030-3030-4030-8030-303030303030'',''22222222-2222-4222-8222-222222222222'')',
      'update public.profiles set welcome_unlock_claimed_at=null where id=''99999999-9999-4999-8999-999999999999'''
    ] loop
      begin
        execute stmt;
        raise exception 'Expected permission denial: %',actor;
      exception when insufficient_privilege then raise notice 'PASS: protected request/claim operation denied for %',actor;
      end;
    end loop;
    reset role;
  end loop;
end;
$$;
set role service_role;
do $$
declare
  u uuid:='10101010-1010-4010-8010-101010101010';
  g uuid:='20202020-2020-4020-8020-202020202020';
  w uuid:='30303030-3030-4030-8030-303030303030';
  old_u uuid:='99999999-9999-4999-8999-999999999999';
  w1 uuid:='22222222-2222-4222-8222-222222222222';
  w2 uuid:='33333333-3333-4333-8333-333333333333';
  draft uuid:='77777777-7777-4777-8777-777777777777';
  k uuid:='00000000-0000-4000-8000-000000000001';
  k2 uuid:='00000000-0000-4000-8000-000000000002';
  first jsonb; r jsonb;
begin
  first:=public.activate_reader_membership_with_credits(u,'basic',2,2,0,false,k);
  if first->>'code' is distinct from 'activated' then raise exception 'Activation: %',first; end if;
  r:=public.activate_reader_membership_with_credits(u,'basic',2,2,0,false,k);
  if r is distinct from first then raise exception 'Activation replay differs: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,'plus',4,5,0,false,k);
  if r->>'code' is distinct from 'request_conflict' then raise exception 'Request reuse allowed: %',r; end if;
  r:=public.artales_gift_reader_credit(u,2,k);
  if r->>'code' is distinct from 'request_conflict' then raise exception 'Cross-kind reuse allowed: %',r; end if;
  r:=public.activate_reader_membership_with_credits(u,'basic',2,2,0,false,k2);
  if r->>'code' is distinct from 'activated' or (r->>'starts_at')::timestamptz is distinct from (first->>'expires_at')::timestamptz then
    raise exception 'Intentional renewal failed: %',r;
  end if;
  if (select sum(amount) from public.reader_credit_ledger where user_id=u)<>6
    or (select count(*) from public.reader_entitlements where user_id=u)<>2
    or (select sum(amount) from public.reader_member_unlock_ledger where user_id=u)<>4 then raise exception 'Renewal/replay accounting wrong'; end if;
  first:=public.artales_gift_reader_credit(g,2,k);
  if first->>'code' is distinct from 'credit_gifted' then raise exception 'Gift failed: %',first; end if;
  r:=public.artales_gift_reader_credit(g,2,k);
  if r is distinct from first then raise exception 'Gift replay differs'; end if;
  r:=public.artales_gift_reader_credit(g,3,k);
  if r->>'code' is distinct from 'request_conflict' then raise exception 'Gift amount mutation allowed'; end if;
  r:=public.artales_gift_reader_credit(g,2,null);
  if r->>'code' is distinct from 'request_id_required' then raise exception 'Missing gift request accepted'; end if;
  if (select sum(amount) from public.reader_credit_ledger where user_id=g)<>8 then raise exception 'Gift replay double debited'; end if;
  r:=public.artales_claim_welcome_unlock(old_u,w2);
  if r->>'code' is distinct from 'welcome_already_used' then raise exception 'Historic inactive claim not protected'; end if;
  r:=public.artales_claim_welcome_unlock(w,draft);
  if r->>'code' is distinct from 'invalid_unlock_target' then raise exception 'Draft welcome accepted'; end if;
  first:=public.artales_claim_welcome_unlock(w,w1);
  if first->>'code' is distinct from 'welcome_claimed' then raise exception 'Welcome failed: %',first; end if;
  r:=public.artales_claim_welcome_unlock(w,w1);
  if r->>'code' is distinct from 'already_unlocked' or r->>'entitlement_id' is distinct from first->>'entitlement_id' then raise exception 'Welcome replay failed'; end if;
  update public.reader_entitlements set source='manual_grant',is_active=false where user_id=w;
  r:=public.artales_claim_welcome_unlock(w,w2);
  if r->>'code' is distinct from 'welcome_already_used' then raise exception 'Reclassified welcome replay accepted'; end if;
  begin
    insert into public.reader_entitlements(user_id,work_id,entitlement_type,source) values(w,w2,'online_read','welcome_unlock');
    raise exception 'Legacy direct grant bypassed guard';
  exception when check_violation then raise notice 'PASS: legacy direct grant denied after prior claim';
  end;
  if (select welcome_unlock_claimed_at from public.profiles where id=w) is null then raise exception 'Claim marker absent'; end if;
  raise notice 'PASS: replay, conflict, intentional renewal, distinct account scope and historical welcome guard';
end;
$$;
reset role;
