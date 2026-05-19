-- ARTales v0.8.1 – Invite/register/onboarding hotfix
-- Fixes invite acceptance when e-mail confirmation prevents the server action
-- from writing authenticated profile rows immediately.
-- Also normalizes role assignment from invite metadata and prepares handle checks.

-- Ensure the app_role enum contains the v0.8 roles.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'member'
  ) then
    alter type public.app_role add value 'member';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role'
      and e.enumlabel = 'reader'
  ) then
    alter type public.app_role add value 'reader';
  end if;
end $$;

-- Public helper for form validation. It intentionally reveals only availability,
-- not profile details.
create or replace function public.is_handle_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate is not null
    and candidate ~ '^[a-z0-9._-]{3,30}$'
    and not exists (
      select 1
      from public.profiles p
      where p.handle = candidate
    );
$$;

grant execute on function public.is_handle_available(text) to anon, authenticated;

-- Auth trigger: creates/updates profile rows and accepts invitations from
-- auth.users.raw_user_meta_data. This is needed when signUp creates the auth
-- user but e-mail confirmation means the app does not yet have an authenticated
-- session for normal RLS-protected profile writes.
create or replace function public.artales_sync_profile_from_auth_user_v081()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  meta jsonb;
  invite_uuid uuid;
  invite_row public.invites%rowtype;
  final_role public.app_role;
  raw_role text;
  raw_handle text;
  safe_handle text;
  raw_display_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  begin
    invite_uuid := nullif(meta ->> 'invite_id', '')::uuid;
  exception when others then
    invite_uuid := null;
  end;

  if invite_uuid is not null then
    select *
    into invite_row
    from public.invites i
    where i.id = invite_uuid
      and lower(i.email) = lower(new.email)
      and i.status = 'pending'
      and (i.expires_at is null or i.expires_at > now())
    limit 1;
  end if;

  if invite_row.id is not null then
    final_role := invite_row.invited_role::public.app_role;
  else
    raw_role := coalesce(meta ->> 'role', 'reader');
    if raw_role in ('admin', 'editor', 'member', 'reader') then
      final_role := raw_role::public.app_role;
    else
      final_role := 'reader'::public.app_role;
    end if;
  end if;

  raw_display_name := nullif(btrim(coalesce(meta ->> 'display_name', '')), '');
  raw_handle := lower(nullif(btrim(coalesce(meta ->> 'handle', '')), ''));

  if raw_handle ~ '^[a-z0-9._-]{3,30}$'
     and not exists (
       select 1 from public.profiles p
       where p.handle = raw_handle
         and p.id <> new.id
     ) then
    safe_handle := raw_handle;
  else
    safe_handle := null;
  end if;

  insert into public.profiles (
    id,
    email,
    role,
    is_active,
    display_name,
    handle,
    invite_id,
    invited_by_user_id
  ) values (
    new.id,
    lower(new.email),
    final_role,
    true,
    raw_display_name,
    safe_handle,
    invite_row.id,
    invite_row.invited_by_user_id
  )
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    is_active = true,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    handle = coalesce(public.profiles.handle, excluded.handle),
    invite_id = coalesce(public.profiles.invite_id, excluded.invite_id),
    invited_by_user_id = coalesce(public.profiles.invited_by_user_id, excluded.invited_by_user_id);

  if invite_row.id is not null then
    update public.invites
    set
      status = 'accepted',
      accepted_by_user_id = new.id,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
    where id = invite_row.id
      and status = 'pending';

    insert into public.activity_log (
      actor_user_id,
      target_type,
      target_id,
      action,
      metadata
    ) values (
      new.id,
      'invite',
      invite_row.id,
      'invite_accepted',
      jsonb_build_object(
        'role', invite_row.invited_role,
        'invitedBy', invite_row.invited_by_user_id
      )
    );
  else
    insert into public.activity_log (
      actor_user_id,
      target_type,
      target_id,
      action,
      metadata
    ) values (
      new.id,
      'profile',
      new.id,
      'reader_registered',
      jsonb_build_object('role', final_role)
    );
  end if;

  return new;
end;
$$;

-- Use a late-sorting trigger name so it runs after older profile bootstrap
-- triggers, if the project already has one.
drop trigger if exists zz_artales_profile_sync_v081 on auth.users;
create trigger zz_artales_profile_sync_v081
after insert on auth.users
for each row execute function public.artales_sync_profile_from_auth_user_v081();

comment on function public.artales_sync_profile_from_auth_user_v081() is
  'ARTales v0.8.1: syncs auth.users sign-ups into profiles and accepts invites even when e-mail confirmation prevents immediate authenticated writes.';
