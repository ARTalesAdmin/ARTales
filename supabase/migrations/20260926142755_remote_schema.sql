-- ARTales production schema baseline.

-- Captured from Supabase migration history version 20260926142755 (remote_schema).

-- Schema-only: no production data is included.

-- This file intentionally mirrors the registered remote baseline; behavioral/security hardening belongs in later migrations.



SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'editor',
    'member',
    'reader'
);

ALTER TYPE "public"."app_role" OWNER TO "postgres";

CREATE TYPE "public"."author_type" AS ENUM (
    'person',
    'collective',
    'unknown'
);

ALTER TYPE "public"."author_type" OWNER TO "postgres";

CREATE TYPE "public"."work_origin_type" AS ENUM (
    'public_domain',
    'original',
    'translation',
    'other'
);

ALTER TYPE "public"."work_origin_type" OWNER TO "postgres";

CREATE TYPE "public"."work_source_label" AS ENUM (
    'gutenberg',
    'web',
    'manual',
    'original'
);

ALTER TYPE "public"."work_source_label" OWNER TO "postgres";

CREATE TYPE "public"."work_status" AS ENUM (
    'draft',
    'review',
    'published',
    'archived'
);

ALTER TYPE "public"."work_status" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."activate_reader_membership_with_credits"("p_user_id" "uuid", "p_tier" "text", "p_price_at" integer, "p_member_unlocks" integer, "p_bonus_at" integer, "p_library_access" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_existing_other text;
  v_base_start timestamptz;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
begin
  if p_tier not in ('basic', 'plus', 'library') then
    return jsonb_build_object('ok', false, 'code', 'invalid_tier');
  end if;

  if p_price_at <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_price');
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id;

  if v_balance < p_price_at then
    return jsonb_build_object('ok', false, 'code', 'not_enough_credit', 'balance', v_balance);
  end if;

  select metadata->>'plan'
    into v_existing_other
  from public.reader_entitlements
  where user_id = p_user_id
    and entitlement_type = 'membership_access'
    and is_active = true
    and coalesce(expires_at, v_now) > v_now
    and coalesce(metadata->>'plan', '') <> p_tier
  order by expires_at desc nulls last
  limit 1;

  if v_existing_other is not null then
    return jsonb_build_object('ok', false, 'code', 'other_membership_active', 'active_tier', v_existing_other);
  end if;

  select max(expires_at)
    into v_base_start
  from public.reader_entitlements
  where user_id = p_user_id
    and entitlement_type = 'membership_access'
    and is_active = true
    and coalesce(metadata->>'plan', '') = p_tier
    and expires_at > v_now;

  v_starts_at := greatest(v_now, coalesce(v_base_start, v_now));
  v_expires_at := v_starts_at + interval '30 days';

  insert into public.reader_credit_ledger (
    user_id,
    amount,
    source,
    note,
    metadata
  ) values (
    p_user_id,
    -p_price_at,
    'credit_spend',
    'Membership activation: ' || p_tier,
    jsonb_build_object(
      'kind', 'membership_activation',
      'plan', p_tier,
      'period_days', 30,
      'starts_at', v_starts_at,
      'expires_at', v_expires_at,
      'bonus_at', 0,
      'bonus_policy', 'at_wallet_cleanup_v01013j'
    )
  );

  if p_member_unlocks > 0 then
    insert into public.reader_member_unlock_ledger (
      user_id,
      amount,
      source,
      note,
      metadata
    ) values (
      p_user_id,
      p_member_unlocks,
      'membership_activation',
      'Member online unlocks: ' || p_tier,
      jsonb_build_object(
        'kind', 'membership_unlock_allowance',
        'plan', p_tier,
        'starts_at', v_starts_at,
        'expires_at', v_expires_at
      )
    );
  end if;

  insert into public.reader_entitlements (
    user_id,
    work_id,
    entitlement_type,
    source,
    is_active,
    starts_at,
    expires_at,
    note,
    metadata
  ) values (
    p_user_id,
    null,
    'membership_access',
    'subscription_monthly',
    true,
    v_starts_at,
    v_expires_at,
    'Membership access: ' || p_tier,
    jsonb_build_object(
      'plan', p_tier,
      'price_at', p_price_at,
      'member_unlocks', p_member_unlocks,
      'bonus_at', 0,
      'library_access', p_library_access,
      'period_days', 30,
      'payment_model', 'at_wallet'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'activated',
    'plan', p_tier,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'price_at', p_price_at,
    'bonus_at', 0,
    'member_unlocks', p_member_unlocks,
    'balance_before', v_balance,
    'balance_after', v_balance - p_price_at
  );
end;
$$;

ALTER FUNCTION "public"."activate_reader_membership_with_credits"("p_user_id" "uuid", "p_tier" "text", "p_price_at" integer, "p_member_unlocks" integer, "p_bonus_at" integer, "p_library_access" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."artales_complete_onboarding_v082"("display_name_input" "text", "handle_input" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
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
$_$;

ALTER FUNCTION "public"."artales_complete_onboarding_v082"("display_name_input" "text", "handle_input" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."artales_ensure_profile_after_login_v082"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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

ALTER FUNCTION "public"."artales_ensure_profile_after_login_v082"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "invited_role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "invited_by_user_id" "uuid",
    "accepted_by_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invites_invited_role_check" CHECK (("invited_role" = ANY (ARRAY['editor'::"text", 'member'::"text", 'reader'::"text"]))),
    CONSTRAINT "invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);

ALTER TABLE "public"."invites" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."artales_find_pending_invite_for_email"("email_input" "text") RETURNS "public"."invites"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

ALTER FUNCTION "public"."artales_find_pending_invite_for_email"("email_input" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
declare
  meta jsonb;
  invite_uuid uuid;
  invite_row public.invites%rowtype;
  final_role public.app_role;
  raw_role text;
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
    raw_role := coalesce(meta ->> 'role', 'reader');
    if raw_role in ('admin', 'editor', 'member', 'reader') then
      final_role := raw_role::public.app_role;
    else
      final_role := 'reader'::public.app_role;
    end if;
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
$_$;

ALTER FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() IS 'ARTales v0.8.1: syncs auth.users sign-ups into profiles and accepts invites even when e-mail confirmation prevents immediate authenticated writes.';

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_handle_available"("candidate" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select candidate is not null
    and candidate ~ '^[a-z0-9._-]{3,30}$'
    and not exists (
      select 1
      from public.profiles p
      where p.handle = candidate
    );
$_$;

ALTER FUNCTION "public"."is_handle_available"("candidate" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_id uuid := auth.uid();
  changed_at timestamptz := now();
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = actor_id and p.is_active = true and p.role in ('admin', 'editor')
  ) then
    raise exception 'editor_or_admin_required' using errcode = '42501';
  end if;

  update public.works
  set content_changed_at = changed_at, content_changed_by = actor_id
  where id = p_work_id;

  if not found then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;

  insert into public.work_editor_activity (
    work_id, user_id, first_edited_at, last_edited_at, edit_count
  ) values (p_work_id, actor_id, changed_at, changed_at, 1)
  on conflict (work_id, user_id) do update
  set last_edited_at = excluded.last_edited_at,
      edit_count = public.work_editor_activity.edit_count + 1;
end;
$$;

ALTER FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."use_at_credit_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
    and is_active = true
    and starts_at <= v_now
    and (expires_at is null or expires_at > v_now)
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_credit_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'code', 'not_enough_credit', 'balance', v_balance);
  end if;

  insert into public.reader_credit_ledger (
    user_id,
    amount,
    source,
    note,
    metadata
  ) values (
    p_user_id,
    -1,
    'credit_spend',
    'Online reading unlock.',
    jsonb_build_object(
      'kind', 'online_unlock_spend',
      'work_id', p_work_id
    )
  );

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    update public.reader_entitlements
      set source = 'credit_spend',
          granted_by_user_id = null,
          note = 'Permanent online reading unlocked with 1 AT Credit.',
          is_active = true,
          starts_at = v_now,
          expires_at = null,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'kind', 'online_unlock_spend',
            'price_at', 1,
            'unlocked_at', v_now
          ),
          updated_at = v_now
    where id = v_entitlement_id;
  else
    insert into public.reader_entitlements (
      user_id,
      work_id,
      entitlement_type,
      source,
      granted_by_user_id,
      is_active,
      starts_at,
      expires_at,
      note,
      metadata
    ) values (
      p_user_id,
      p_work_id,
      'online_read',
      'credit_spend',
      null,
      true,
      v_now,
      null,
      'Permanent online reading unlocked with 1 AT Credit.',
      jsonb_build_object(
        'kind', 'online_unlock_spend',
        'price_at', 1,
        'unlocked_at', v_now
      )
    )
    returning id into v_entitlement_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'credit_unlock_used',
    'work_id', p_work_id,
    'entitlement_id', v_entitlement_id,
    'balance_before', v_balance,
    'balance_after', v_balance - 1
  );
end;
$$;

ALTER FUNCTION "public"."use_at_credit_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."use_member_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_balance integer;
  v_now timestamptz := now();
  v_entitlement_id uuid;
begin
  if p_user_id is null or p_work_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_unlock_target');
  end if;

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
    and is_active = true
    and starts_at <= v_now
    and (expires_at is null or expires_at > v_now)
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    return jsonb_build_object('ok', true, 'code', 'already_unlocked', 'work_id', p_work_id);
  end if;

  select coalesce(sum(amount), 0)::integer
    into v_balance
  from public.reader_member_unlock_ledger
  where user_id = p_user_id;

  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'code', 'not_enough_member_unlocks', 'balance', v_balance);
  end if;

  insert into public.reader_member_unlock_ledger (
    user_id,
    amount,
    source,
    related_work_id,
    note,
    metadata
  ) values (
    p_user_id,
    -1,
    'online_unlock_spend',
    p_work_id,
    'Member online unlock used.',
    jsonb_build_object(
      'kind', 'member_online_unlock_spend',
      'work_id', p_work_id
    )
  );

  select id
    into v_entitlement_id
  from public.reader_entitlements
  where user_id = p_user_id
    and work_id = p_work_id
    and entitlement_type = 'online_read'
  order by created_at desc
  limit 1;

  if v_entitlement_id is not null then
    update public.reader_entitlements
      set source = 'subscription_monthly',
          granted_by_user_id = null,
          note = 'Permanent online reading unlocked with a member unlock.',
          is_active = true,
          starts_at = v_now,
          expires_at = null,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'kind', 'member_online_unlock_spend',
            'unlocked_at', v_now
          ),
          updated_at = v_now
    where id = v_entitlement_id;
  else
    insert into public.reader_entitlements (
      user_id,
      work_id,
      entitlement_type,
      source,
      granted_by_user_id,
      is_active,
      starts_at,
      expires_at,
      note,
      metadata
    ) values (
      p_user_id,
      p_work_id,
      'online_read',
      'subscription_monthly',
      null,
      true,
      v_now,
      null,
      'Permanent online reading unlocked with a member unlock.',
      jsonb_build_object(
        'kind', 'member_online_unlock_spend',
        'unlocked_at', v_now
      )
    )
    returning id into v_entitlement_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'member_unlock_used',
    'work_id', p_work_id,
    'entitlement_id', v_entitlement_id,
    'balance_before', v_balance,
    'balance_after', v_balance - 1
  );
end;
$$;

ALTER FUNCTION "public"."use_member_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "action" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."activity_log" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."author_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "notification_level" "text" DEFAULT 'new_releases'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "author_follows_notification_level_check" CHECK (("notification_level" = ANY (ARRAY['new_releases'::"text", 'all_updates'::"text", 'silent'::"text"])))
);

ALTER TABLE "public"."author_follows" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."authors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "author_type" "public"."author_type" DEFAULT 'person'::"public"."author_type" NOT NULL,
    "bio" "text",
    "birth_year" integer,
    "death_year" integer,
    "country" "text",
    "primary_language" "text",
    "is_public_visible" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "writing_languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "portrait_image_path" "text",
    "portrait_image_alt" "text",
    "portrait_image_caption" "text",
    "name_cs" "text",
    "name_en" "text",
    "bio_cs" "text",
    "bio_en" "text",
    CONSTRAINT "authors_birth_year_reasonable" CHECK ((("birth_year" IS NULL) OR (("birth_year" >= 0) AND ("birth_year" <= 3000)))),
    CONSTRAINT "authors_death_year_reasonable" CHECK ((("death_year" IS NULL) OR (("death_year" >= 0) AND ("death_year" <= 3000)))),
    CONSTRAINT "authors_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "authors_slug_not_blank" CHECK (("btrim"("slug") <> ''::"text")),
    CONSTRAINT "authors_year_order" CHECK ((("birth_year" IS NULL) OR ("death_year" IS NULL) OR ("death_year" >= "birth_year")))
);

ALTER TABLE "public"."authors" OWNER TO "postgres";

COMMENT ON COLUMN "public"."authors"."writing_languages" IS 'Optional list of standardized language codes relevant to the author writing profile, e.g. en, fr, la.';

COMMENT ON COLUMN "public"."authors"."portrait_image_path" IS 'Path inside Supabase Storage bucket artales-images, e.g. authors/{author_slug}/portrait/portrait.webp.';

COMMENT ON COLUMN "public"."authors"."portrait_image_alt" IS 'Alt text for the public author portrait image.';

COMMENT ON COLUMN "public"."authors"."portrait_image_caption" IS 'Optional public caption or credit for the author portrait image.';

COMMENT ON COLUMN "public"."authors"."name_cs" IS 'Czech public display name for author pages and work cards. Falls back to name.';

COMMENT ON COLUMN "public"."authors"."name_en" IS 'English public display name for author pages and work cards. Falls back to name.';

COMMENT ON COLUMN "public"."authors"."bio_cs" IS 'Czech public author biography. Falls back to bio.';

COMMENT ON COLUMN "public"."authors"."bio_en" IS 'English public author biography. Falls back to bio.';

CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "is_public_visible" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cover_image_path" "text",
    "cover_image_alt" "text",
    "cover_image_caption" "text",
    "title_cs" "text",
    "title_en" "text",
    "subtitle_cs" "text",
    "subtitle_en" "text",
    "description_cs" "text",
    "description_en" "text",
    "curator_note_cs" "text",
    "curator_note_en" "text",
    "collection_type" "text" DEFAULT 'curated'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    CONSTRAINT "collections_collection_type_check" CHECK (("collection_type" = ANY (ARRAY['curated'::"text", 'seasonal'::"text", 'authorial'::"text", 'editorial'::"text", 'school_library'::"text", 'community'::"text"]))),
    CONSTRAINT "collections_slug_not_blank" CHECK (("btrim"("slug") <> ''::"text")),
    CONSTRAINT "collections_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."collections" OWNER TO "postgres";

COMMENT ON COLUMN "public"."collections"."cover_image_path" IS 'Path inside Supabase Storage bucket artales-images, e.g. collections/{collection_slug}/cover/cover.webp.';

COMMENT ON COLUMN "public"."collections"."cover_image_alt" IS 'Alt text for the public collection cover image.';

COMMENT ON COLUMN "public"."collections"."cover_image_caption" IS 'Optional public caption or credit for the collection cover image.';

CREATE TABLE IF NOT EXISTS "public"."localization_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "work_id" "uuid",
    "requested_locale" "text" NOT NULL,
    "request_type" "text" DEFAULT 'translation'::"text" NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "localization_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['translation'::"text", 'validation'::"text", 'proofread'::"text"]))),
    CONSTRAINT "localization_requests_requested_locale_check" CHECK (("requested_locale" = ANY (ARRAY['en'::"text", 'cs'::"text"]))),
    CONSTRAINT "localization_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'planned'::"text", 'in_progress'::"text", 'done'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."localization_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."member_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submitted_by_user_id" "uuid" NOT NULL,
    "work_id" "uuid",
    "collection_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "file_note" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "reviewed_by_user_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_submissions_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'in_review'::"text", 'accepted'::"text", 'rejected'::"text", 'needs_changes'::"text", 'archived'::"text"]))),
    CONSTRAINT "member_submissions_type_check" CHECK (("type" = ANY (ARRAY['correction'::"text", 'image_asset'::"text", 'source_note'::"text", 'transcription'::"text", 'translation_note'::"text", 'metadata_suggestion'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."member_submissions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."membership_plans" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "intro_price_eur" numeric(8,2) DEFAULT 0 NOT NULL,
    "future_price_eur" numeric(8,2) DEFAULT 0 NOT NULL,
    "intro_unlock_note" "text" DEFAULT ''::"text" NOT NULL,
    "monthly_online_unlocks" integer DEFAULT 0 NOT NULL,
    "monthly_at_credits" integer DEFAULT 0 NOT NULL,
    "unlimited_online_reading" boolean DEFAULT false NOT NULL,
    "is_promotional" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."membership_plans" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "work_id" "uuid",
    "product_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_amount_cents" integer DEFAULT 0 NOT NULL,
    "total_amount_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "entitlement_type" "text",
    "fulfillment_status" "text" DEFAULT 'not_ready'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_entitlement_type_check" CHECK (("entitlement_type" = ANY (ARRAY['online_read'::"text", 'pdf_download'::"text", 'epub_download'::"text", 'print_discount'::"text", 'membership_access'::"text"]))),
    CONSTRAINT "order_items_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['not_ready'::"text", 'pending'::"text", 'fulfilled'::"text", 'failed'::"text", 'manual_required'::"text"]))),
    CONSTRAINT "order_items_product_type_check" CHECK (("product_type" = ANY (ARRAY['online_unlock'::"text", 'pdf_download'::"text", 'epub_download'::"text", 'pdf_epub_bundle'::"text", 'print'::"text", 'membership'::"text", 'credit_topup'::"text", 'support'::"text", 'donation'::"text"]))),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_total_amount_cents_check" CHECK (("total_amount_cents" >= 0)),
    CONSTRAINT "order_items_unit_amount_cents_check" CHECK (("unit_amount_cents" >= 0))
);

ALTER TABLE "public"."order_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "subtotal_amount_cents" integer DEFAULT 0 NOT NULL,
    "discount_amount_cents" integer DEFAULT 0 NOT NULL,
    "total_amount_cents" integer DEFAULT 0 NOT NULL,
    "provider" "text",
    "provider_session_id" "text",
    "provider_payment_id" "text",
    "paid_at" timestamp with time zone,
    "fulfilled_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_discount_amount_cents_check" CHECK (("discount_amount_cents" >= 0)),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['not_started'::"text", 'pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_payment'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text", 'fulfilled'::"text"]))),
    CONSTRAINT "orders_subtotal_amount_cents_check" CHECK (("subtotal_amount_cents" >= 0)),
    CONSTRAINT "orders_total_amount_cents_check" CHECK (("total_amount_cents" >= 0))
);

ALTER TABLE "public"."orders" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."page_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text",
    "user_id" "uuid",
    "path" "text" NOT NULL,
    "referrer" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text",
    "event_type" "text",
    "entity_type" "text",
    "entity_slug" "text"
);

ALTER TABLE "public"."page_views" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."product_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "price_context" "text" DEFAULT 'standard'::"text" NOT NULL,
    "membership_code" "text",
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "label" "text" DEFAULT 'Standard'::"text" NOT NULL,
    "is_intro" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 100 NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_prices_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "product_prices_price_context_check" CHECK (("price_context" = ANY (ARRAY['standard'::"text", 'reader'::"text", 'basic'::"text", 'plus'::"text", 'library'::"text", 'launch'::"text"])))
);

ALTER TABLE "public"."product_prices" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid",
    "product_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "entitlement_type" "text",
    "availability" "text" DEFAULT 'coming_soon'::"text" NOT NULL,
    "checkout_enabled" boolean DEFAULT false NOT NULL,
    "fulfillment_ready" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 100 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_availability_check" CHECK (("availability" = ANY (ARRAY['available'::"text", 'coming_soon'::"text", 'internal_only'::"text"]))),
    CONSTRAINT "products_entitlement_type_check" CHECK (("entitlement_type" = ANY (ARRAY['online_read'::"text", 'pdf_download'::"text", 'epub_download'::"text", 'print_discount'::"text"]))),
    CONSTRAINT "products_product_type_check" CHECK (("product_type" = ANY (ARRAY['online_unlock'::"text", 'pdf_download'::"text", 'epub_download'::"text", 'pdf_epub_bundle'::"text", 'print'::"text"]))),
    CONSTRAINT "products_work_required_for_work_products" CHECK (("work_id" IS NOT NULL))
);

ALTER TABLE "public"."products" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "public"."app_role" DEFAULT 'member'::"public"."app_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "handle" "text",
    "invited_by_user_id" "uuid",
    "invite_id" "uuid",
    "preferred_locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "reader_theme" "text" DEFAULT 'light'::"text" NOT NULL,
    "reader_width" "text" DEFAULT 'normal'::"text" NOT NULL,
    "reader_density" "text" DEFAULT 'comfort'::"text" NOT NULL,
    "reader_font_scale" numeric DEFAULT 1 NOT NULL,
    "reader_controls_collapsed" boolean DEFAULT false NOT NULL,
    "profile_completed_at" timestamp with time zone,
    CONSTRAINT "profiles_handle_format_check" CHECK ((("handle" IS NULL) OR (("btrim"("handle") <> ''::"text") AND ("handle" = "lower"("handle")) AND ("handle" !~ '\s'::"text") AND ("handle" ~ '^[a-z0-9._-]+$'::"text") AND (("char_length"("handle") >= 3) AND ("char_length"("handle") <= 30))))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role", 'member'::"public"."app_role", 'reader'::"public"."app_role"])))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."profiles"."profile_completed_at" IS 'Set when the user completes ARTales onboarding. Null means the profile still uses fallback identity data.';

CREATE TABLE IF NOT EXISTS "public"."purchase_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "work_id" "uuid",
    "status" "text" DEFAULT 'captured'::"text" NOT NULL,
    "source_context" "text" DEFAULT 'checkout_coming_soon'::"text" NOT NULL,
    "user_role" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_intents_status_check" CHECK (("status" = ANY (ARRAY['captured'::"text", 'converted'::"text", 'cancelled'::"text", 'abandoned'::"text"])))
);

ALTER TABLE "public"."purchase_intents" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_type" "text" DEFAULT 'at_credit'::"text" NOT NULL,
    "amount" integer NOT NULL,
    "source" "text" NOT NULL,
    "related_work_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_credit_ledger_source_check" CHECK (("source" = ANY (ARRAY['subscription_monthly'::"text", 'purchase'::"text", 'bonus'::"text", 'contribution'::"text", 'admin_adjustment'::"text", 'credit_spend'::"text", 'promo'::"text"])))
);

ALTER TABLE "public"."reader_credit_ledger" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_entitlement_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requested_by_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "work_id" "uuid" NOT NULL,
    "request_type" "text" DEFAULT 'online_read_manual_grant'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "note" "text",
    "admin_note" "text",
    "reviewed_by_user_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_entitlement_requests_request_type_check" CHECK (("request_type" = 'online_read_manual_grant'::"text")),
    CONSTRAINT "reader_entitlement_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."reader_entitlement_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "work_id" "uuid",
    "entitlement_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "granted_by_user_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_entitlements_entitlement_type_check" CHECK (("entitlement_type" = ANY (ARRAY['online_read'::"text", 'pdf_download'::"text", 'epub_download'::"text", 'print_discount'::"text", 'membership_access'::"text"]))),
    CONSTRAINT "reader_entitlements_source_check" CHECK (("source" = ANY (ARRAY['welcome_unlock'::"text", 'manual_grant'::"text", 'subscription_monthly'::"text", 'credit_spend'::"text", 'purchase'::"text", 'admin_adjustment'::"text", 'promo'::"text"]))),
    CONSTRAINT "reader_entitlements_work_required_for_products" CHECK ((("entitlement_type" = 'membership_access'::"text") OR ("work_id" IS NOT NULL)))
);

ALTER TABLE "public"."reader_entitlements" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_library_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "work_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "last_opened_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_library_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['saved'::"text", 'recent'::"text", 'unlocked'::"text", 'download'::"text"])))
);

ALTER TABLE "public"."reader_library_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_member_unlock_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "source" "text" NOT NULL,
    "related_work_id" "uuid",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_member_unlock_ledger_source_check" CHECK (("source" = ANY (ARRAY['membership_activation'::"text", 'online_unlock_spend'::"text", 'admin_adjustment'::"text", 'promo'::"text"])))
);

ALTER TABLE "public"."reader_member_unlock_ledger" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."reader_notes" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "work_slug" "text" NOT NULL,
    "title" "text",
    "body" "text",
    "color" "text" DEFAULT 'gold'::"text" NOT NULL,
    "progress_percent" double precision DEFAULT 0 NOT NULL,
    "scroll_y" double precision DEFAULT 0 NOT NULL,
    "page_index" integer,
    "page_count" integer,
    "layout_mode" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_notes_color_check" CHECK (("color" = ANY (ARRAY['gold'::"text", 'blue'::"text", 'green'::"text", 'rose'::"text", 'violet'::"text"]))),
    CONSTRAINT "reader_notes_layout_mode_check" CHECK (("layout_mode" = ANY (ARRAY['pagedFlow'::"text", 'spread'::"text", 'scroll'::"text", 'page'::"text"]))),
    CONSTRAINT "reader_notes_progress_percent_check" CHECK ((("progress_percent" >= (0)::double precision) AND ("progress_percent" <= (100)::double precision)))
);

ALTER TABLE "public"."reader_notes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "label_cs" "text" NOT NULL,
    "label_en" "text",
    "description_cs" "text",
    "description_en" "text",
    "type" "text" DEFAULT 'other'::"text" NOT NULL,
    "canonical_tag_id" "uuid",
    "is_public_visible" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tags_type_check" CHECK (("type" = ANY (ARRAY['genre'::"text", 'form'::"text", 'theme'::"text", 'mood'::"text", 'period'::"text", 'language'::"text", 'difficulty'::"text", 'reading_mode'::"text", 'format'::"text", 'audience'::"text", 'content_note'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."work_collections" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_content_block_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "blocks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "block_count" integer GENERATED ALWAYS AS ("jsonb_array_length"("blocks")) STORED,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "work_content_block_batches_blocks_array_check" CHECK (("jsonb_typeof"("blocks") = 'array'::"text"))
);

ALTER TABLE "public"."work_content_block_batches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_contributors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "author_id" "uuid",
    "display_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "display_order" integer DEFAULT 100 NOT NULL,
    "public_note" "text",
    "internal_note" "text",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_contributors_role_check" CHECK (("role" = ANY (ARRAY['author'::"text", 'original_author'::"text", 'translator'::"text", 'editor'::"text", 'proofreader'::"text", 'illustrator'::"text", 'curator'::"text", 'publisher'::"text", 'technical_editor'::"text", 'narrator'::"text", 'audio_editor'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."work_contributors" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_editor_activity" (
    "work_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "first_edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edit_count" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "work_editor_activity_edit_count_check" CHECK (("edit_count" > 0))
);

ALTER TABLE "public"."work_editor_activity" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "work_id" "uuid" NOT NULL,
    "feedback_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'editorial'::"text" NOT NULL,
    "source_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by_user_id" "uuid",
    CONSTRAINT "work_feedback_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 3) AND ("char_length"(TRIM(BOTH FROM "body")) <= 4000))),
    CONSTRAINT "work_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['general'::"text", 'correction'::"text", 'translation'::"text", 'formatting'::"text", 'rights'::"text", 'comment'::"text"]))),
    CONSTRAINT "work_feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'acknowledged'::"text"]))),
    CONSTRAINT "work_feedback_visibility_check" CHECK (("visibility" = ANY (ARRAY['editorial'::"text", 'author_candidate'::"text", 'public_candidate'::"text"])))
);

ALTER TABLE "public"."work_feedback" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."work_tags" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."works" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "subtitle" "text",
    "summary" "text" NOT NULL,
    "content" "text" NOT NULL,
    "canonical_language" "text" NOT NULL,
    "origin_type" "public"."work_origin_type" NOT NULL,
    "source_label" "public"."work_source_label" NOT NULL,
    "source_reference" "text",
    "status" "public"."work_status" DEFAULT 'draft'::"public"."work_status" NOT NULL,
    "primary_author_id" "uuid" NOT NULL,
    "collection_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "submitted_for_review_by" "uuid",
    "submitted_for_review_at" timestamp with time zone,
    "published_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_blocks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cover_image_path" "text",
    "cover_image_alt" "text",
    "cover_image_caption" "text",
    "cover_image_request" "text",
    "edition_title" "text",
    "edition_version" "text",
    "edition_language" "text",
    "original_language" "text",
    "edition_source_url" "text",
    "edition_license" "text",
    "edition_publisher" "text",
    "publication_year" "text",
    "isbn" "text",
    "isbn_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "isbn_note" "text",
    "edition_note_public" "text",
    "edition_note_internal" "text",
    "contributor_summary" "text",
    "title_cs" "text",
    "title_en" "text",
    "subtitle_cs" "text",
    "subtitle_en" "text",
    "summary_cs" "text",
    "summary_en" "text",
    "content_changed_at" timestamp with time zone,
    "content_changed_by" "uuid",
    CONSTRAINT "works_canonical_language_not_blank" CHECK (("btrim"("canonical_language") <> ''::"text")),
    CONSTRAINT "works_content_not_blank" CHECK (("btrim"("content") <> ''::"text")),
    CONSTRAINT "works_isbn_status_check" CHECK (("isbn_status" = ANY (ARRAY['not_required'::"text", 'planned'::"text", 'requested'::"text", 'assigned'::"text", 'external'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "works_published_fields_consistent" CHECK ((("status" <> 'published'::"public"."work_status") OR (("published_at" IS NOT NULL) AND ("published_by" IS NOT NULL)))),
    CONSTRAINT "works_review_fields_consistent" CHECK ((("status" <> 'review'::"public"."work_status") OR (("submitted_for_review_at" IS NOT NULL) AND ("submitted_for_review_by" IS NOT NULL)))),
    CONSTRAINT "works_slug_not_blank" CHECK (("btrim"("slug") <> ''::"text")),
    CONSTRAINT "works_source_reference_required" CHECK (((("source_label" = ANY (ARRAY['web'::"public"."work_source_label", 'manual'::"public"."work_source_label"])) AND ("source_reference" IS NOT NULL) AND ("btrim"("source_reference") <> ''::"text")) OR ("source_label" = ANY (ARRAY['gutenberg'::"public"."work_source_label", 'original'::"public"."work_source_label"])))),
    CONSTRAINT "works_summary_length" CHECK ((("char_length"("summary") >= 200) AND ("char_length"("summary") <= 800))),
    CONSTRAINT "works_summary_not_blank" CHECK (("btrim"("summary") <> ''::"text")),
    CONSTRAINT "works_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."works" OWNER TO "postgres";

COMMENT ON COLUMN "public"."works"."cover_image_path" IS 'Path inside Supabase Storage bucket artales-images, e.g. works/{work_id}/cover/cover.webp. Do not store the full public URL unless temporarily necessary.';

COMMENT ON COLUMN "public"."works"."cover_image_alt" IS 'Alt text for the public cover image.';

COMMENT ON COLUMN "public"."works"."cover_image_caption" IS 'Optional public caption or credit for the cover image.';

COMMENT ON COLUMN "public"."works"."cover_image_request" IS 'Internal non-public note for editors: original cover file name or instruction. Technical storage path is filled later by an administrator.';

COMMENT ON COLUMN "public"."works"."title_cs" IS 'Public Czech work title used by localized ARTales public surfaces.';

COMMENT ON COLUMN "public"."works"."title_en" IS 'Public English work title used by localized ARTales public surfaces.';

COMMENT ON COLUMN "public"."works"."subtitle_cs" IS 'Public Czech work subtitle used by localized ARTales public surfaces.';

COMMENT ON COLUMN "public"."works"."subtitle_en" IS 'Public English work subtitle used by localized ARTales public surfaces.';

COMMENT ON COLUMN "public"."works"."summary_cs" IS 'Public Czech work annotation/summary used by localized ARTales public surfaces.';

COMMENT ON COLUMN "public"."works"."summary_en" IS 'Public English work annotation/summary used by localized ARTales public surfaces.';

ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."author_follows"
    ADD CONSTRAINT "author_follows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."author_follows"
    ADD CONSTRAINT "author_follows_user_id_author_id_key" UNIQUE ("user_id", "author_id");

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_token_hash_key" UNIQUE ("token_hash");

ALTER TABLE ONLY "public"."localization_requests"
    ADD CONSTRAINT "localization_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."member_submissions"
    ADD CONSTRAINT "member_submissions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_prices"
    ADD CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."product_prices"
    ADD CONSTRAINT "product_prices_unique_context" UNIQUE ("product_id", "price_context", "currency");

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_unique_work_type" UNIQUE ("work_id", "product_type");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_credit_ledger"
    ADD CONSTRAINT "reader_credit_ledger_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_entitlement_requests"
    ADD CONSTRAINT "reader_entitlement_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_entitlements"
    ADD CONSTRAINT "reader_entitlements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_library_items"
    ADD CONSTRAINT "reader_library_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_library_items"
    ADD CONSTRAINT "reader_library_items_user_id_work_id_item_type_key" UNIQUE ("user_id", "work_id", "item_type");

ALTER TABLE ONLY "public"."reader_member_unlock_ledger"
    ADD CONSTRAINT "reader_member_unlock_ledger_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reader_notes"
    ADD CONSTRAINT "reader_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_work_id_collection_id_key" UNIQUE ("work_id", "collection_id");

ALTER TABLE ONLY "public"."work_content_block_batches"
    ADD CONSTRAINT "work_content_block_batches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_contributors"
    ADD CONSTRAINT "work_contributors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_editor_activity"
    ADD CONSTRAINT "work_editor_activity_pkey" PRIMARY KEY ("work_id", "user_id");

ALTER TABLE ONLY "public"."work_feedback"
    ADD CONSTRAINT "work_feedback_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_work_id_tag_id_key" UNIQUE ("work_id", "tag_id");

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_slug_key" UNIQUE ("slug");

CREATE INDEX "activity_log_action_idx" ON "public"."activity_log" USING "btree" ("action");

CREATE INDEX "activity_log_actor_user_id_idx" ON "public"."activity_log" USING "btree" ("actor_user_id");

CREATE INDEX "activity_log_target_idx" ON "public"."activity_log" USING "btree" ("target_type", "target_id");

CREATE INDEX "idx_author_follows_author_id" ON "public"."author_follows" USING "btree" ("author_id");

CREATE INDEX "idx_author_follows_user_id" ON "public"."author_follows" USING "btree" ("user_id");

CREATE INDEX "idx_authors_created_by" ON "public"."authors" USING "btree" ("created_by");

CREATE INDEX "idx_authors_public_visible" ON "public"."authors" USING "btree" ("is_public_visible");

CREATE INDEX "idx_authors_updated_by" ON "public"."authors" USING "btree" ("updated_by");

CREATE INDEX "idx_collections_created_by" ON "public"."collections" USING "btree" ("created_by");

CREATE INDEX "idx_collections_public_visible" ON "public"."collections" USING "btree" ("is_public_visible");

CREATE INDEX "idx_collections_updated_by" ON "public"."collections" USING "btree" ("updated_by");

CREATE INDEX "idx_localization_requests_status" ON "public"."localization_requests" USING "btree" ("status");

CREATE INDEX "idx_localization_requests_work_id" ON "public"."localization_requests" USING "btree" ("work_id");

CREATE INDEX "idx_reader_notes_user_work_updated" ON "public"."reader_notes" USING "btree" ("user_id", "work_slug", "updated_at" DESC);

CREATE INDEX "idx_work_feedback_acknowledged_at" ON "public"."work_feedback" USING "btree" ("acknowledged_at" DESC);

CREATE INDEX "idx_work_feedback_acknowledged_by_user_id" ON "public"."work_feedback" USING "btree" ("acknowledged_by_user_id");

CREATE INDEX "idx_work_feedback_created_at" ON "public"."work_feedback" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_work_feedback_status" ON "public"."work_feedback" USING "btree" ("status");

CREATE INDEX "idx_work_feedback_user_id" ON "public"."work_feedback" USING "btree" ("user_id");

CREATE INDEX "idx_work_feedback_work_id" ON "public"."work_feedback" USING "btree" ("work_id");

CREATE INDEX "idx_works_collection_id" ON "public"."works" USING "btree" ("collection_id");

CREATE INDEX "idx_works_created_by" ON "public"."works" USING "btree" ("created_by");

CREATE INDEX "idx_works_origin_type" ON "public"."works" USING "btree" ("origin_type");

CREATE INDEX "idx_works_primary_author_id" ON "public"."works" USING "btree" ("primary_author_id");

CREATE INDEX "idx_works_published_at" ON "public"."works" USING "btree" ("published_at");

CREATE INDEX "idx_works_source_label" ON "public"."works" USING "btree" ("source_label");

CREATE INDEX "idx_works_status" ON "public"."works" USING "btree" ("status");

CREATE INDEX "idx_works_updated_by" ON "public"."works" USING "btree" ("updated_by");

CREATE INDEX "invites_email_idx" ON "public"."invites" USING "btree" ("email");

CREATE INDEX "invites_invited_by_user_id_idx" ON "public"."invites" USING "btree" ("invited_by_user_id");

CREATE INDEX "invites_status_idx" ON "public"."invites" USING "btree" ("status");

CREATE INDEX "member_submissions_status_idx" ON "public"."member_submissions" USING "btree" ("status");

CREATE INDEX "member_submissions_submitted_by_user_id_idx" ON "public"."member_submissions" USING "btree" ("submitted_by_user_id");

CREATE INDEX "member_submissions_work_id_idx" ON "public"."member_submissions" USING "btree" ("work_id");

CREATE INDEX "order_items_order_idx" ON "public"."order_items" USING "btree" ("order_id");

CREATE INDEX "order_items_product_type_idx" ON "public"."order_items" USING "btree" ("product_type", "created_at" DESC);

CREATE INDEX "order_items_work_idx" ON "public"."order_items" USING "btree" ("work_id", "created_at" DESC);

CREATE INDEX "orders_paid_at_idx" ON "public"."orders" USING "btree" ("paid_at" DESC);

CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "orders_user_idx" ON "public"."orders" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "page_views_created_idx" ON "public"."page_views" USING "btree" ("created_at" DESC);

CREATE INDEX "page_views_entity_idx" ON "public"."page_views" USING "btree" ("entity_type", "entity_slug", "created_at" DESC);

CREATE INDEX "page_views_environment_idx" ON "public"."page_views" USING "btree" ("environment", "created_at" DESC);

CREATE INDEX "page_views_event_type_idx" ON "public"."page_views" USING "btree" ("event_type", "created_at" DESC);

CREATE INDEX "page_views_path_idx" ON "public"."page_views" USING "btree" ("path", "created_at" DESC);

CREATE INDEX "page_views_session_idx" ON "public"."page_views" USING "btree" ("session_id", "created_at" DESC);

CREATE INDEX "page_views_user_idx" ON "public"."page_views" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "product_prices_context_idx" ON "public"."product_prices" USING "btree" ("price_context", "is_active");

CREATE INDEX "product_prices_product_idx" ON "public"."product_prices" USING "btree" ("product_id");

CREATE INDEX "products_type_idx" ON "public"."products" USING "btree" ("product_type", "is_active");

CREATE INDEX "products_work_idx" ON "public"."products" USING "btree" ("work_id");

CREATE UNIQUE INDEX "profiles_handle_unique_idx" ON "public"."profiles" USING "btree" ("handle") WHERE ("handle" IS NOT NULL);

CREATE INDEX "purchase_intents_product_idx" ON "public"."purchase_intents" USING "btree" ("product_id", "created_at" DESC);

CREATE INDEX "purchase_intents_status_idx" ON "public"."purchase_intents" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "purchase_intents_user_idx" ON "public"."purchase_intents" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "purchase_intents_work_idx" ON "public"."purchase_intents" USING "btree" ("work_id", "created_at" DESC);

CREATE INDEX "reader_credit_ledger_user_idx" ON "public"."reader_credit_ledger" USING "btree" ("user_id");

CREATE INDEX "reader_entitlement_requests_status_idx" ON "public"."reader_entitlement_requests" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "reader_entitlement_requests_target_user_idx" ON "public"."reader_entitlement_requests" USING "btree" ("target_user_id");

CREATE INDEX "reader_entitlement_requests_work_idx" ON "public"."reader_entitlement_requests" USING "btree" ("work_id");

CREATE INDEX "reader_entitlements_active_idx" ON "public"."reader_entitlements" USING "btree" ("user_id", "entitlement_type", "is_active");

CREATE UNIQUE INDEX "reader_entitlements_active_unique_work_access_idx" ON "public"."reader_entitlements" USING "btree" ("user_id", "work_id", "entitlement_type") WHERE (("is_active" = true) AND ("work_id" IS NOT NULL));

CREATE INDEX "reader_entitlements_user_idx" ON "public"."reader_entitlements" USING "btree" ("user_id");

CREATE INDEX "reader_entitlements_work_idx" ON "public"."reader_entitlements" USING "btree" ("work_id");

CREATE INDEX "reader_library_items_user_idx" ON "public"."reader_library_items" USING "btree" ("user_id");

CREATE INDEX "reader_library_items_work_idx" ON "public"."reader_library_items" USING "btree" ("work_id");

CREATE INDEX "reader_member_unlock_ledger_user_idx" ON "public"."reader_member_unlock_ledger" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "tags_is_public_visible_idx" ON "public"."tags" USING "btree" ("is_public_visible");

CREATE INDEX "tags_sort_order_idx" ON "public"."tags" USING "btree" ("sort_order", "label_cs");

CREATE INDEX "tags_type_idx" ON "public"."tags" USING "btree" ("type");

CREATE INDEX "work_collections_collection_idx" ON "public"."work_collections" USING "btree" ("collection_id", "sort_order");

CREATE INDEX "work_collections_work_idx" ON "public"."work_collections" USING "btree" ("work_id", "sort_order");

CREATE INDEX "work_content_block_batches_work_created_idx" ON "public"."work_content_block_batches" USING "btree" ("work_id", "created_at", "id");

CREATE INDEX "work_contributors_role_idx" ON "public"."work_contributors" USING "btree" ("role");

CREATE INDEX "work_contributors_work_id_idx" ON "public"."work_contributors" USING "btree" ("work_id");

CREATE INDEX "work_editor_activity_user_last_idx" ON "public"."work_editor_activity" USING "btree" ("user_id", "last_edited_at" DESC);

CREATE INDEX "work_tags_tag_idx" ON "public"."work_tags" USING "btree" ("tag_id", "sort_order");

CREATE INDEX "work_tags_work_idx" ON "public"."work_tags" USING "btree" ("work_id", "sort_order");

CREATE INDEX "works_content_changed_at_idx" ON "public"."works" USING "btree" ("content_changed_at" DESC);

CREATE OR REPLACE TRIGGER "trg_authors_updated_at" BEFORE UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_collections_updated_at" BEFORE UPDATE ON "public"."collections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_works_updated_at" BEFORE UPDATE ON "public"."works" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."author_follows"
    ADD CONSTRAINT "author_follows_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."author_follows"
    ADD CONSTRAINT "author_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."localization_requests"
    ADD CONSTRAINT "localization_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."localization_requests"
    ADD CONSTRAINT "localization_requests_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."member_submissions"
    ADD CONSTRAINT "member_submissions_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."member_submissions"
    ADD CONSTRAINT "member_submissions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."member_submissions"
    ADD CONSTRAINT "member_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."member_submissions"
    ADD CONSTRAINT "member_submissions_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."product_prices"
    ADD CONSTRAINT "product_prices_membership_code_fkey" FOREIGN KEY ("membership_code") REFERENCES "public"."membership_plans"("code") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."product_prices"
    ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."purchase_intents"
    ADD CONSTRAINT "purchase_intents_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reader_credit_ledger"
    ADD CONSTRAINT "reader_credit_ledger_related_work_id_fkey" FOREIGN KEY ("related_work_id") REFERENCES "public"."works"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reader_credit_ledger"
    ADD CONSTRAINT "reader_credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_entitlement_requests"
    ADD CONSTRAINT "reader_entitlement_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_entitlement_requests"
    ADD CONSTRAINT "reader_entitlement_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reader_entitlement_requests"
    ADD CONSTRAINT "reader_entitlement_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_entitlement_requests"
    ADD CONSTRAINT "reader_entitlement_requests_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_entitlements"
    ADD CONSTRAINT "reader_entitlements_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reader_entitlements"
    ADD CONSTRAINT "reader_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_entitlements"
    ADD CONSTRAINT "reader_entitlements_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_library_items"
    ADD CONSTRAINT "reader_library_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_library_items"
    ADD CONSTRAINT "reader_library_items_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_member_unlock_ledger"
    ADD CONSTRAINT "reader_member_unlock_ledger_related_work_id_fkey" FOREIGN KEY ("related_work_id") REFERENCES "public"."works"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reader_member_unlock_ledger"
    ADD CONSTRAINT "reader_member_unlock_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reader_notes"
    ADD CONSTRAINT "reader_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_canonical_tag_id_fkey" FOREIGN KEY ("canonical_tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_collections"
    ADD CONSTRAINT "work_collections_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_content_block_batches"
    ADD CONSTRAINT "work_content_block_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_content_block_batches"
    ADD CONSTRAINT "work_content_block_batches_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_contributors"
    ADD CONSTRAINT "work_contributors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_contributors"
    ADD CONSTRAINT "work_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_contributors"
    ADD CONSTRAINT "work_contributors_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_editor_activity"
    ADD CONSTRAINT "work_editor_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_editor_activity"
    ADD CONSTRAINT "work_editor_activity_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_feedback"
    ADD CONSTRAINT "work_feedback_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_feedback"
    ADD CONSTRAINT "work_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_feedback"
    ADD CONSTRAINT "work_feedback_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."work_tags"
    ADD CONSTRAINT "work_tags_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_content_changed_by_fkey" FOREIGN KEY ("content_changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_primary_author_id_fkey" FOREIGN KEY ("primary_author_id") REFERENCES "public"."authors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_submitted_for_review_by_fkey" FOREIGN KEY ("submitted_for_review_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

CREATE POLICY "Editors and admins can insert authors" ON "public"."authors" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])) AND ("profiles"."is_active" = true)))) AND ("created_by" = "auth"."uid"()) AND ("updated_by" = "auth"."uid"())));

CREATE POLICY "Editors and admins can insert collections" ON "public"."collections" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors and admins can insert works" ON "public"."works" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors and admins can read all authors" ON "public"."authors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])) AND ("profiles"."is_active" = true)))));

CREATE POLICY "Editors and admins can read all collections" ON "public"."collections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors and admins can read all works" ON "public"."works" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors and admins can update authors" ON "public"."authors" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])) AND ("profiles"."is_active" = true))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])) AND ("profiles"."is_active" = true)))) AND ("updated_by" = "auth"."uid"())));

CREATE POLICY "Editors and admins can update collections" ON "public"."collections" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors and admins can update works" ON "public"."works" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['editor'::"public"."app_role", 'admin'::"public"."app_role"]))))));

CREATE POLICY "Editors can delete work content block batches" ON "public"."work_content_block_batches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors can insert own editorial activity" ON "public"."work_editor_activity" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))));

CREATE POLICY "Editors can insert work content block batches" ON "public"."work_content_block_batches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors can read editorial activity" ON "public"."work_editor_activity" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors can read work content block batches" ON "public"."work_content_block_batches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors can review submissions" ON "public"."member_submissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))) WITH CHECK (true);

CREATE POLICY "Editors can update own editorial activity" ON "public"."work_editor_activity" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))));

CREATE POLICY "Editors can update work content block batches" ON "public"."work_content_block_batches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors manage tags" ON "public"."tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors manage work collections" ON "public"."work_collections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Editors manage work tags" ON "public"."work_tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Internal users can create submissions" ON "public"."member_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("submitted_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role", 'member'::"public"."app_role"])))))));

CREATE POLICY "Invite managers and invitees can update invites" ON "public"."invites" FOR UPDATE TO "authenticated" USING ((("accepted_by_user_id" = "auth"."uid"()) OR ("invited_by_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))))) WITH CHECK (true);

CREATE POLICY "Invite managers can create invites" ON "public"."invites" FOR INSERT TO "authenticated" WITH CHECK ((("invited_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND (("p"."role" = 'admin'::"public"."app_role") OR (("p"."role" = 'editor'::"public"."app_role") AND ("invites"."invited_role" = ANY (ARRAY['member'::"text", 'reader'::"text"])))))))));

CREATE POLICY "Invite managers can read invites" ON "public"."invites" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))));

CREATE POLICY "Members can read own submissions" ON "public"."member_submissions" FOR SELECT TO "authenticated" USING ((("submitted_by_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))));

CREATE POLICY "Pending invites can be read by token" ON "public"."invites" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'pending'::"text") AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));

CREATE POLICY "Public can read collections of published works" ON "public"."work_collections" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_collections"."work_id") AND (("w"."status" = 'published'::"public"."work_status") OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))))))));

CREATE POLICY "Public can read published work content block batches" ON "public"."work_content_block_batches" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_content_block_batches"."work_id") AND ("w"."status" = 'published'::"public"."work_status")))));

CREATE POLICY "Public can read published works" ON "public"."works" FOR SELECT USING (("status" = 'published'::"public"."work_status"));

CREATE POLICY "Public can read tags of published works" ON "public"."work_tags" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_tags"."work_id") AND (("w"."status" = 'published'::"public"."work_status") OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"]))))))))));

CREATE POLICY "Public can read visible authors" ON "public"."authors" FOR SELECT USING (("is_public_visible" = true));

CREATE POLICY "Public can read visible collections" ON "public"."collections" FOR SELECT USING (("is_public_visible" = true));

CREATE POLICY "Public can read visible tags" ON "public"."tags" FOR SELECT TO "authenticated", "anon" USING ((("is_public_visible" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))));

CREATE POLICY "Users can delete their author follows" ON "public"."author_follows" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own activity" ON "public"."activity_log" FOR INSERT TO "authenticated" WITH CHECK ((("actor_user_id" = "auth"."uid"()) OR ("actor_user_id" IS NULL)));

CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can insert their author follows" ON "public"."author_follows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their feedback" ON "public"."work_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their localization requests" ON "public"."localization_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can read related activity" ON "public"."activity_log" FOR SELECT TO "authenticated" USING ((("actor_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['admin'::"public"."app_role", 'editor'::"public"."app_role"])))))));

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can view their author follows" ON "public"."author_follows" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their feedback" ON "public"."work_feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their localization requests" ON "public"."localization_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "active product prices are readable" ON "public"."product_prices" FOR SELECT USING (("is_active" = true));

CREATE POLICY "active products are readable" ON "public"."products" FOR SELECT USING (("is_active" = true));

ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."author_follows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."localization_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."member_submissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership plans are readable" ON "public"."membership_plans" FOR SELECT USING (("is_active" = true));

ALTER TABLE "public"."membership_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."product_prices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."purchase_intents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_credit_ledger" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_entitlement_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_entitlements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_library_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_member_unlock_ledger" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reader_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reader_notes_delete_own" ON "public"."reader_notes" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "reader_notes_insert_own" ON "public"."reader_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "reader_notes_select_own" ON "public"."reader_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "reader_notes_update_own" ON "public"."reader_notes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "requesters can read own entitlement requests" ON "public"."reader_entitlement_requests" FOR SELECT USING (("auth"."uid"() = "requested_by_user_id"));

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own credit ledger" ON "public"."reader_credit_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "users can read own entitlements" ON "public"."reader_entitlements" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "users can read own library items" ON "public"."reader_library_items" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "users can read own member unlock ledger" ON "public"."reader_member_unlock_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "users can read own order items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."user_id" = "auth"."uid"())))));

CREATE POLICY "users can read own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "users can read own purchase intents" ON "public"."purchase_intents" FOR SELECT USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."work_collections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."work_content_block_batches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."work_contributors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."work_editor_activity" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."work_feedback" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."work_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."works" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."activate_reader_membership_with_credits"("p_user_id" "uuid", "p_tier" "text", "p_price_at" integer, "p_member_unlocks" integer, "p_bonus_at" integer, "p_library_access" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."activate_reader_membership_with_credits"("p_user_id" "uuid", "p_tier" "text", "p_price_at" integer, "p_member_unlocks" integer, "p_bonus_at" integer, "p_library_access" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."activate_reader_membership_with_credits"("p_user_id" "uuid", "p_tier" "text", "p_price_at" integer, "p_member_unlocks" integer, "p_bonus_at" integer, "p_library_access" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."artales_complete_onboarding_v082"("display_name_input" "text", "handle_input" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."artales_complete_onboarding_v082"("display_name_input" "text", "handle_input" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."artales_complete_onboarding_v082"("display_name_input" "text", "handle_input" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."artales_ensure_profile_after_login_v082"() TO "anon";

GRANT ALL ON FUNCTION "public"."artales_ensure_profile_after_login_v082"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."artales_ensure_profile_after_login_v082"() TO "service_role";

GRANT ALL ON TABLE "public"."invites" TO "anon";

GRANT ALL ON TABLE "public"."invites" TO "authenticated";

GRANT ALL ON TABLE "public"."invites" TO "service_role";

GRANT ALL ON FUNCTION "public"."artales_find_pending_invite_for_email"("email_input" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."artales_find_pending_invite_for_email"("email_input" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."artales_find_pending_invite_for_email"("email_input" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() TO "anon";

GRANT ALL ON FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."artales_sync_profile_from_auth_user_v081"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."is_handle_available"("candidate" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."is_handle_available"("candidate" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_handle_available"("candidate" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."record_work_editorial_activity"("p_work_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."use_at_credit_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."use_at_credit_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."use_at_credit_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."use_member_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."use_member_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."use_member_online_unlock"("p_user_id" "uuid", "p_work_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."activity_log" TO "anon";

GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";

GRANT ALL ON TABLE "public"."activity_log" TO "service_role";

GRANT ALL ON TABLE "public"."author_follows" TO "anon";

GRANT ALL ON TABLE "public"."author_follows" TO "authenticated";

GRANT ALL ON TABLE "public"."author_follows" TO "service_role";

GRANT ALL ON TABLE "public"."authors" TO "anon";

GRANT ALL ON TABLE "public"."authors" TO "authenticated";

GRANT ALL ON TABLE "public"."authors" TO "service_role";

GRANT ALL ON TABLE "public"."collections" TO "anon";

GRANT ALL ON TABLE "public"."collections" TO "authenticated";

GRANT ALL ON TABLE "public"."collections" TO "service_role";

GRANT ALL ON TABLE "public"."localization_requests" TO "anon";

GRANT ALL ON TABLE "public"."localization_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."localization_requests" TO "service_role";

GRANT ALL ON TABLE "public"."member_submissions" TO "anon";

GRANT ALL ON TABLE "public"."member_submissions" TO "authenticated";

GRANT ALL ON TABLE "public"."member_submissions" TO "service_role";

GRANT ALL ON TABLE "public"."membership_plans" TO "anon";

GRANT ALL ON TABLE "public"."membership_plans" TO "authenticated";

GRANT ALL ON TABLE "public"."membership_plans" TO "service_role";

GRANT ALL ON TABLE "public"."order_items" TO "anon";

GRANT ALL ON TABLE "public"."order_items" TO "authenticated";

GRANT ALL ON TABLE "public"."order_items" TO "service_role";

GRANT ALL ON TABLE "public"."orders" TO "anon";

GRANT ALL ON TABLE "public"."orders" TO "authenticated";

GRANT ALL ON TABLE "public"."orders" TO "service_role";

GRANT ALL ON TABLE "public"."page_views" TO "anon";

GRANT ALL ON TABLE "public"."page_views" TO "authenticated";

GRANT ALL ON TABLE "public"."page_views" TO "service_role";

GRANT ALL ON TABLE "public"."product_prices" TO "anon";

GRANT ALL ON TABLE "public"."product_prices" TO "authenticated";

GRANT ALL ON TABLE "public"."product_prices" TO "service_role";

GRANT ALL ON TABLE "public"."products" TO "anon";

GRANT ALL ON TABLE "public"."products" TO "authenticated";

GRANT ALL ON TABLE "public"."products" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."purchase_intents" TO "anon";

GRANT ALL ON TABLE "public"."purchase_intents" TO "authenticated";

GRANT ALL ON TABLE "public"."purchase_intents" TO "service_role";

GRANT ALL ON TABLE "public"."reader_credit_ledger" TO "anon";

GRANT ALL ON TABLE "public"."reader_credit_ledger" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_credit_ledger" TO "service_role";

GRANT ALL ON TABLE "public"."reader_entitlement_requests" TO "anon";

GRANT ALL ON TABLE "public"."reader_entitlement_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_entitlement_requests" TO "service_role";

GRANT ALL ON TABLE "public"."reader_entitlements" TO "anon";

GRANT ALL ON TABLE "public"."reader_entitlements" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_entitlements" TO "service_role";

GRANT ALL ON TABLE "public"."reader_library_items" TO "anon";

GRANT ALL ON TABLE "public"."reader_library_items" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_library_items" TO "service_role";

GRANT ALL ON TABLE "public"."reader_member_unlock_ledger" TO "anon";

GRANT ALL ON TABLE "public"."reader_member_unlock_ledger" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_member_unlock_ledger" TO "service_role";

GRANT ALL ON TABLE "public"."reader_notes" TO "anon";

GRANT ALL ON TABLE "public"."reader_notes" TO "authenticated";

GRANT ALL ON TABLE "public"."reader_notes" TO "service_role";

GRANT ALL ON TABLE "public"."tags" TO "anon";

GRANT ALL ON TABLE "public"."tags" TO "authenticated";

GRANT ALL ON TABLE "public"."tags" TO "service_role";

GRANT ALL ON TABLE "public"."work_collections" TO "anon";

GRANT ALL ON TABLE "public"."work_collections" TO "authenticated";

GRANT ALL ON TABLE "public"."work_collections" TO "service_role";

GRANT ALL ON TABLE "public"."work_content_block_batches" TO "anon";

GRANT ALL ON TABLE "public"."work_content_block_batches" TO "authenticated";

GRANT ALL ON TABLE "public"."work_content_block_batches" TO "service_role";

GRANT ALL ON TABLE "public"."work_contributors" TO "anon";

GRANT ALL ON TABLE "public"."work_contributors" TO "authenticated";

GRANT ALL ON TABLE "public"."work_contributors" TO "service_role";

GRANT ALL ON TABLE "public"."work_editor_activity" TO "anon";

GRANT ALL ON TABLE "public"."work_editor_activity" TO "authenticated";

GRANT ALL ON TABLE "public"."work_editor_activity" TO "service_role";

GRANT ALL ON TABLE "public"."work_feedback" TO "anon";

GRANT ALL ON TABLE "public"."work_feedback" TO "authenticated";

GRANT ALL ON TABLE "public"."work_feedback" TO "service_role";

GRANT ALL ON TABLE "public"."work_tags" TO "anon";

GRANT ALL ON TABLE "public"."work_tags" TO "authenticated";

GRANT ALL ON TABLE "public"."work_tags" TO "service_role";

GRANT ALL ON TABLE "public"."works" TO "anon";

GRANT ALL ON TABLE "public"."works" TO "authenticated";

GRANT ALL ON TABLE "public"."works" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

CREATE EVENT TRIGGER "ensure_rls" ON "ddl_command_end"
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER EVENT TRIGGER "ensure_rls" OWNER TO "postgres";

