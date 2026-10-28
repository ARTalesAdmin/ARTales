-- ARTales identity role authority hardening. STAGED, NOT APPLIED.
-- Production grants/DDL and any merge require independent Architect approval.
-- Split out from Snapshot general PR #278 because role authority is cross-cutting.
-- Based on verified production RLS, grants, auth.users trigger and v0.8.6 function.
DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t
       JOIN pg_proc p ON p.oid=t.tgfoid
       WHERE t.tgrelid='auth.users'::regclass
       AND t.tgname='zz_artales_profile_sync_v081' AND t.tgenabled='O'
       AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
       AND position('meta ->> ''role''' in pg_get_functiondef(p.oid))>0)
  OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='profiles' AND policyname='Users can update own profile')
  OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='invites' AND policyname='Invite managers and invitees can update invites')
  THEN RAISE EXCEPTION 'artales_identity_preflight_drift'; END IF;
END
$preflight$;

-- In the deployed v0.8.6 app, ordinary self-service profile changes use only
-- display_name and handle. Service-role onboarding/invite sync retains full DML.
-- Never grant INSERT/UPDATE/DELETE on privilege-bearing columns to a client.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, handle, preferred_locale, reader_theme,
 reader_width, reader_density, reader_font_scale, reader_controls_collapsed)
 ON TABLE public.profiles TO authenticated;
-- Even a later accidental table-level grant must not revive self-admin INSERT.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Legacy invite UPDATE policy was permissive across all columns/statuses.
-- Keep only the authenticated admin/editor revocation that the app performs.
-- Accepted invites and editor-assigned roles remain immutable to browser clients.
REVOKE UPDATE, DELETE ON TABLE public.invites FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON TABLE public.invites TO authenticated;
DROP POLICY IF EXISTS "Invite managers and invitees can update invites" ON public.invites;
CREATE POLICY artales_invites_authenticated_revoke_only_v1
 ON public.invites FOR UPDATE TO authenticated
 USING (status='pending' AND EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.is_active AND (
     p.role::text='admin'
     OR (p.role::text='editor' AND invites.invited_role IN ('member','reader'))
   )
 ))
 WITH CHECK (status='revoked');

-- Preserve the existing trigger's service-owned authoritative invitation flow,
-- but remove the only authorization fallback from user-editable metadata.
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
    -- Never authorize from user-editable auth.raw_user_meta_data.
    -- Only a matching pending server-side invitation may assign elevated roles.
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

-- No role grants, user data rewrites, auth user deletes or publication actions.
