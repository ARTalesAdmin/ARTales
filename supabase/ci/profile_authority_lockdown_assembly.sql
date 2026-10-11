-- ARTales profile authority emergency hardening, **local assembly only**.
-- This SQL must NOT be applied to production without independent authorization.
-- Root causes (read-only confirmed on production 2026-10-11):
-- - authenticated role has unscoped ALL on profiles; own-row RLS does not protect role/is_active
-- - signup trigger previously used user-controlled auth.raw_user_meta_data.role
-- - no dedicated authority-columns lock.
--
-- Scope: only public.profiles client privileges and existing signup sync function.
-- Service-role onboarding/invite management stays privileged and compatible.

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
-- Direct sign-up fallback may create only ordinary rows. Sensitive columns
-- (role, is_active, invited_by_user_id, invite_id, email verification) are
-- never writable by PostgREST clients; privileged onboarding still works.
GRANT INSERT (id,email,display_name,handle,preferred_locale,reader_theme,
              reader_width,reader_density,reader_font_scale,reader_controls_collapsed)
  ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name,handle,preferred_locale,reader_theme,reader_width,
              reader_density,reader_font_scale,reader_controls_collapsed,profile_completed_at)
  ON TABLE public.profiles TO authenticated;

-- Existing auth.users AFTER INSERT trigger calls this function with definer
-- privileges, so column grants alone CANNOT close metadata-driven registration.
create or replace function public.artales_sync_profile_from_auth_user_v081()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  meta jsonb;
  invite_uuid uuid;
  invite_row public.invites%rowtype;
  final_role public.app_role;
  raw_handle text;
  safe_handle text;
  raw_display_name text;
  safe_display_name text;
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

  if invite_row.id is null then
    invite_row := public.artales_find_pending_invite_for_email(new.email);
  end if;

  if invite_row.id is not null then
    final_role := invite_row.invited_role::public.app_role;
  else
    -- User-editable auth.user_metadata is never authority for staff roles.
    -- Only a verified server-side invitation can grant editor/admin.
    final_role := 'reader'::public.app_role;
  end if;

  raw_display_name := nullif(btrim(coalesce(meta ->> 'display_name', '')), '');
  raw_handle := lower(nullif(btrim(coalesce(meta ->> 'handle', '')), ''));

  if raw_display_name is not null then
    safe_display_name := raw_display_name;
  else
    safe_display_name := split_part(coalesce(new.email, 'reader'), '@', 1);
  end if;

  if raw_handle ~ '^[a-z0-9._-]{3,30}$'
     and not exists (
       select 1
       from public.profiles p
       where p.handle = raw_handle
         and p.id <> new.id
     ) then
    safe_handle := raw_handle;
  else
    safe_handle := 'user-' || replace(left(new.id::text, 8), '-', '');
  end if;

  insert into public.profiles (
    id,
    email,
    role,
    is_active,
    display_name,
    handle,
    invite_id,
    invited_by_user_id,
    profile_completed_at
  ) values (
    new.id,
    lower(coalesce(new.email, '')),
    final_role,
    true,
    safe_display_name,
    safe_handle,
    invite_row.id,
    invite_row.invited_by_user_id,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when invite_row.id is not null then excluded.role
      else public.profiles.role
    end,
    is_active = true,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    handle = coalesce(nullif(public.profiles.handle, ''), excluded.handle),
    invite_id = coalesce(public.profiles.invite_id, excluded.invite_id),
    invited_by_user_id = coalesce(public.profiles.invited_by_user_id, excluded.invited_by_user_id),
    profile_completed_at = public.profiles.profile_completed_at;

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
        'source', 'auth_trigger_v086'
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
      jsonb_build_object('role', final_role, 'source', 'auth_trigger_v086')
    );
  end if;

  return new;
end;
$function$;

-- RLS already ensures authenticated direct inserts/updates affect only auth.uid().
-- Do not weaken that RLS or give EXECUTE on privileged role assignment functions.
REVOKE ALL ON FUNCTION public.artales_sync_profile_from_auth_user_v081()
  FROM PUBLIC,anon,authenticated;
