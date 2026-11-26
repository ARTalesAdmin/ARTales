-- A1.1: narrow the execution boundary of existing server-side economic RPCs.
-- No function body, data, RLS, pricing or client contract changes.
revoke execute on function public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean) from public, anon, authenticated;
revoke execute on function public.use_at_credit_online_unlock(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.use_member_online_unlock(uuid,uuid) from public, anon, authenticated;
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
    'public.use_member_online_unlock(uuid,uuid)'::regprocedure
  ] loop
    if has_function_privilege('anon',f,'EXECUTE')
       or has_function_privilege('authenticated',f,'EXECUTE')
       or not has_function_privilege('service_role',f,'EXECUTE') then
      raise exception 'Unexpected effective RPC permissions: %', f;
    end if;
  end loop;
end;
$$;
