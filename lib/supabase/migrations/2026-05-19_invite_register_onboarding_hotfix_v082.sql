-- ARTales v0.8.2 – Invite/login/onboarding reliability hotfix
-- Fixes cases where Supabase e-mail confirmation delays invite acceptance,
-- profiles are missing after sign-up, or onboarding updates zero rows.

-- Ensure app_role contains all current v0.8 roles.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'member'
  ) then
    alter type public.app_role add value 'member';
  end if;

  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'reader'
  ) then
    alter type public.app_role add value 'reader';
  end if;
end $$;

-- Handle helper stays public for UI validation.
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

-- Keep database handle rules aligned with UI validation.
alter table public.profiles
  drop constraint if exists profiles_handle_format_check;

alter table public.profiles
  add constraint profiles_handle_format_check
  check (
    handle is null
    or (
      btrim(handle) <> ''
      and handle = lower(handle)
      and handle !~ '\s'
      and handle ~ '^[a-z0-9._-]+$'
      and char_length(handle) between 3 and 30
    )
  );


-- Internal helper: find the best pending invite for an e-mail.
create or replace function public.artales_find_pending_invite_for_email(email_input text)
returns public.invites
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite_row public.invites%rowtype;
begin
  select * into invite_row
  from public.invites i
  where lower(i.email) = lower(email_input)
    and i.status = 'pending'
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc
  limit 1;

  return invite_row;
end;
$$;

-- Ensure an authenticated user has a profile and accept a pending invite by e-mail.
-- Called after successful login and from onboarding.
create or replace function public.artales_ensure_profile_after_login_v082()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
  current_email text;
  existing_profile public.profiles%rowtype;
  invite_row public.invites%rowtype;
  final_role public.app_role;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select lower(u.email)
  into current_email
  from auth.users u
  where u.id = current_user_id;

  if current_email is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_email');
  end if;

  select *
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  invite_row := public.artales_find_pending_invite_for_email(current_email);

  if invite_row.id is not null then
    final_role := invite_row.invited_role::public.app_role;
  elsif existing_profile.id is not null then
    final_role := existing_profile.role;
  else
    final_role := 'reader'::public.app_role;
  end if;

  insert into public.profiles (
    id,
    email,
    role,
    is_active,
    invite_id,
    invited_by_user_id
  ) values (
    current_user_id,
    current_email,
    final_role,
    true,
    invite_row.id,
    invite_row.invited_by_user_id
  )
  on conflict (id) do update set
    email = excluded.email,
    -- If there is a pending invite, it is authoritative.
    role = case
      when invite_row.id is not null then excluded.role
      else public.profiles.role
    end,
    is_active = true,
    invite_id = coalesce(public.profiles.invite_id, excluded.invite_id),
    invited_by_user_id = coalesce(public.profiles.invited_by_user_id, excluded.invited_by_user_id);

  if invite_row.id is not null then
    update public.invites
    set
      status = 'accepted',
      accepted_by_user_id = current_user_id,
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
      current_user_id,
      'invite',
      invite_row.id,
      'invite_accepted',
      jsonb_build_object(
        'role', invite_row.invited_role,
        'invitedBy', invite_row.invited_by_user_id,
        'source', 'ensure_profile_after_login_v082'
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'role', final_role);
end;
$$;

grant execute on function public.artales_ensure_profile_after_login_v082() to authenticated;

-- Complete onboarding in a SECURITY DEFINER function so it can create a missing
-- profile, keep invite lineage, and avoid update-zero-rows loops.
create or replace function public.artales_complete_onboarding_v082(
  display_name_input text,
  handle_input text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid;
  normalized_display_name text;
  normalized_handle text;
  ensure_result jsonb;
  profile_role public.app_role;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  normalized_display_name := nullif(regexp_replace(btrim(coalesce(display_name_input, '')), '\s+', ' ', 'g'), '');
  normalized_handle := lower(nullif(btrim(coalesce(handle_input, '')), ''));

  if normalized_display_name is null or normalized_handle is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if normalized_handle !~ '^[a-z0-9._-]{3,30}$' then
    return jsonb_build_object('ok', false, 'reason', 'handle');
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.handle = normalized_handle
      and p.id <> current_user_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'handle_taken');
  end if;

  ensure_result := public.artales_ensure_profile_after_login_v082();

  update public.profiles
  set
    display_name = normalized_display_name,
    handle = normalized_handle
  where id = current_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'save');
  end if;

  select role
  into profile_role
  from public.profiles
  where id = current_user_id;

  insert into public.activity_log (
    actor_user_id,
    target_type,
    target_id,
    action,
    metadata
  ) values (
    current_user_id,
    'profile',
    current_user_id,
    'profile_onboarding_completed',
    jsonb_build_object('handle', normalized_handle)
  );

  return jsonb_build_object('ok', true, 'role', profile_role);
end;
$$;

grant execute on function public.artales_complete_onboarding_v082(text, text) to authenticated;

-- Update trigger function too, so future auth sign-ups work even before first login.
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

  -- If metadata did not carry invite_id, fallback by e-mail. This is important
  -- for partially created users or provider edge cases.
  if invite_row.id is null then
    invite_row := public.artales_find_pending_invite_for_email(new.email);
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
    role = case
      when invite_row.id is not null then excluded.role
      else public.profiles.role
    end,
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
        'invitedBy', invite_row.invited_by_user_id,
        'source', 'auth_trigger_v082'
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

-- Recreate trigger in case earlier migration partially failed.
drop trigger if exists zz_artales_profile_sync_v081 on auth.users;
create trigger zz_artales_profile_sync_v081
after insert on auth.users
for each row execute function public.artales_sync_profile_from_auth_user_v081();
