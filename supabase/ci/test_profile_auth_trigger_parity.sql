-- Local test assertion: canonical migration must install production-equivalent
-- auth.users trigger. Never create it from test-only SQL.
do $fixture$
begin
 if not exists (
   select 1 from pg_catalog.pg_trigger
   where tgrelid='auth.users'::pg_catalog.regclass
     and tgname='zz_artales_profile_sync_v081'
     and tgenabled='O'
     and not tgisinternal
 ) then
   raise exception 'missing enabled production-equivalent auth sync trigger';
 end if;
end
$fixture$;
