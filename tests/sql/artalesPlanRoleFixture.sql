\set ON_ERROR_STOP on
-- DISPOSABLE PostgreSQL fixture only: no ARTales credentials/data.
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text);
insert into supabase_migrations.schema_migrations
 values ('20261023063248','prescreen_shadow_library_v1');
create schema plan_private_fixture;
create table plan_private_fixture.canary(value integer not null);
insert into plan_private_fixture.canary values(0);

create role artales_migration_plan_reader
 login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema supabase_migrations to artales_migration_plan_reader;
grant select on table supabase_migrations.schema_migrations
 to artales_migration_plan_reader;
-- By default, PUBLIC can EXECUTE newly created functions.
-- This intentionally demonstrates the inherited PUBLIC security hole.
create function public.artales_plan_ci_canary()
returns void language plpgsql security definer
set search_path=pg_catalog as $canary$
begin
 update plan_private_fixture.canary set value=value+1;
end;
$canary$;
