-- Disposable only; extend the existing A2.1 fixture to the audited live identity contract.
CREATE SCHEMA artales_private AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA artales_private TO authenticated;
ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz;
CREATE UNIQUE INDEX fixture_profiles_handle_unique ON public.profiles(handle) WHERE handle IS NOT NULL;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- The earlier fixture deliberately omits auth rows for its original identities.
ALTER TABLE auth.users DISABLE TRIGGER zz_artales_profile_sync_v081;
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT id,email,now() FROM public.profiles ON CONFLICT(id) DO UPDATE SET email_confirmed_at=excluded.email_confirmed_at;
ALTER TABLE auth.users ENABLE TRIGGER zz_artales_profile_sync_v081;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Live legacy RPC definitions, obtained from the production catalog read-only.
CREATE OR REPLACE FUNCTION public.artales_complete_onboarding_v082(display_name_input text, handle_input text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.artales_ensure_profile_after_login_v082()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$;
GRANT EXECUTE ON FUNCTION public.artales_ensure_profile_after_login_v082(),public.artales_complete_onboarding_v082(text,text) TO anon,authenticated,service_role;
