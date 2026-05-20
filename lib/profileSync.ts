import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeRole, type ArtalesRole } from "@/lib/permissions";
import { normalizeDisplayName, normalizeHandle, validateHandle } from "@/lib/profileValidation";

type AuthUserIdentity = {
  id: string;
  email: string | null | undefined;
};

type InviteRow = {
  id: string;
  email: string;
  invited_role: string;
  invited_by_user_id: string | null;
  status: string;
  expires_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  role: ArtalesRole;
  is_active: boolean | null;
  handle: string | null;
  display_name: string | null;
  invite_id: string | null;
  invited_by_user_id: string | null;
  profile_completed_at: string | null;
};

export type EnsureProfileResult = {
  ok: boolean;
  reason?: string;
  profile?: ProfileRow;
  acceptedInviteId?: string | null;
};

export type CompleteOnboardingResult = EnsureProfileResult & {
  onboardingComplete?: boolean;
};

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function fallbackDisplayName(email: string) {
  return email.split("@")[0] || "reader";
}

function fallbackHandle(userId: string) {
  return `user-${userId.replace(/-/g, "").slice(0, 8)}`;
}

async function insertActivity(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    actorUserId: string | null;
    targetType: string;
    targetId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("activity_log").insert({
    actor_user_id: input.actorUserId,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Activity log insert failed:", error);
  }
}

async function getLatestPendingInviteByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  if (!email) return null;

  const { data, error } = await admin
    .from("invites")
    .select("id, email, invited_role, invited_by_user_id, status, expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Pending invite lookup failed:", error);
    return null;
  }

  return (data ?? null) as InviteRow | null;
}

async function getProfileById(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, role, is_active, handle, display_name, invite_id, invited_by_user_id, profile_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Profile load failed:", error);
    return null;
  }

  return (data ?? null) as ProfileRow | null;
}

async function acceptInvite(
  admin: ReturnType<typeof createAdminClient>,
  invite: InviteRow,
  userId: string,
) {
  const { data, error } = await admin
    .from("invites")
    .update({
      status: "accepted",
      accepted_by_user_id: userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Invite accept update failed:", error);
    return false;
  }

  return Boolean(data?.id);
}

export async function ensureProfileForUser(
  user: AuthUserIdentity,
): Promise<EnsureProfileResult> {
  const userId = user.id;
  const email = normalizeEmail(user.email);

  if (!userId || !email) {
    return { ok: false, reason: "missing_user" };
  }

  const admin = createAdminClient();
  const existingProfile = await getProfileById(admin, userId);
  const pendingInvite = await getLatestPendingInviteByEmail(admin, email);
  const finalRole = pendingInvite
    ? normalizeRole(pendingInvite.invited_role)
    : normalizeRole(existingProfile?.role ?? "reader");

  const nextProfile = {
    id: userId,
    email,
    role: finalRole,
    is_active: true,
    handle: existingProfile?.handle ?? fallbackHandle(userId),
    display_name: existingProfile?.display_name ?? fallbackDisplayName(email),
    invite_id: existingProfile?.invite_id ?? pendingInvite?.id ?? null,
    invited_by_user_id:
      existingProfile?.invited_by_user_id ?? pendingInvite?.invited_by_user_id ?? null,
    profile_completed_at: existingProfile?.profile_completed_at ?? null,
  };

  const { error: upsertError } = await admin.from("profiles").upsert(nextProfile, {
    onConflict: "id",
  });

  if (upsertError) {
    console.error("Profile service upsert failed:", upsertError);
    return { ok: false, reason: "profile_upsert_failed" };
  }

  let acceptedInviteId: string | null = null;

  if (pendingInvite) {
    const accepted = await acceptInvite(admin, pendingInvite, userId);
    if (accepted) {
      acceptedInviteId = pendingInvite.id;
      await insertActivity(admin, {
        actorUserId: userId,
        targetType: "invite",
        targetId: pendingInvite.id,
        action: "invite_accepted",
        metadata: {
          role: finalRole,
          invitedBy: pendingInvite.invited_by_user_id,
          source: "service_profile_sync_v083",
        },
      });
    }
  }

  const savedProfile = await getProfileById(admin, userId);

  if (!savedProfile) {
    return { ok: false, reason: "profile_missing_after_upsert" };
  }

  return { ok: true, profile: savedProfile, acceptedInviteId };
}

export async function completeOnboardingForUser(
  user: AuthUserIdentity,
  input: { displayName: string; handle: string },
): Promise<CompleteOnboardingResult> {
  const displayName = normalizeDisplayName(input.displayName);
  const handle = normalizeHandle(input.handle);

  if (!displayName || !handle) {
    return { ok: false, reason: "missing" };
  }

  if (!validateHandle(handle)) {
    return { ok: false, reason: "handle" };
  }

  const ensured = await ensureProfileForUser(user);

  if (!ensured.ok || !ensured.profile) {
    return ensured;
  }

  const admin = createAdminClient();
  const { data: existingHandle, error: handleError } = await admin
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", user.id)
    .maybeSingle();

  if (handleError) {
    console.error("Handle uniqueness check failed:", handleError);
    return { ok: false, reason: "handle_check_failed" };
  }

  if (existingHandle) {
    return { ok: false, reason: "handle_taken" };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      display_name: displayName,
      handle,
      profile_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Onboarding profile update failed:", updateError);
    return { ok: false, reason: "profile_update_failed" };
  }

  const savedProfile = await getProfileById(admin, user.id);

  if (!savedProfile?.handle || !savedProfile?.display_name) {
    return { ok: false, reason: "profile_incomplete_after_update" };
  }

  await insertActivity(admin, {
    actorUserId: user.id,
    targetType: "profile",
    targetId: user.id,
    action: "profile_onboarding_completed",
    metadata: { handle, source: "service_profile_sync_v083" },
  });

  return {
    ok: true,
    profile: savedProfile,
    onboardingComplete: true,
    acceptedInviteId: ensured.acceptedInviteId ?? null,
  };
}
