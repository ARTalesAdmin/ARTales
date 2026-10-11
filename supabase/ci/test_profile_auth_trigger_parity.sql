-- TEST-ONLY parity fixture, no production migration:
-- remote_schema defines artales_sync_profile_from_auth_user_v081() but omits
-- its auth.users trigger; production has zz_artales_profile_sync_v081 enabled.
-- This connects the function in disposable local CI before signed GoTrue tests.
do $fixture$
begin
 if exists (
   select 1 from pg_trigger
   where tgrelid='auth.users'::regclass
     and tgname='zz_artales_profile_sync_v081'
     and not tgisinternal
 ) then
   raise exception 'test expected no existing local auth sync trigger: review drift';
 end if;
end
$fixture$;
create trigger zz_artales_profile_sync_v081
  after insert on auth.users
  for each row execute function public.artales_sync_profile_from_auth_user_v081();
