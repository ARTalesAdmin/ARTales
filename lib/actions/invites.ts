"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordActivity } from "@/lib/activityLog";
import {
  getInviteByToken,
  generateInviteToken,
  hashInviteToken,
} from "@/lib/dbInvites";
import { requireInviteManager } from "@/lib/guards";
import { canInviteRole, normalizeRole } from "@/lib/permissions";
import { buildAppUrl } from "@/lib/appUrl";
import { ensureProfileForUser } from "@/lib/profileSync";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}


export async function createInvite(formData: FormData): Promise<void> {
  const profile = await requireInviteManager();
  const supabase = await createClient();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const invitedRole = normalizeRole(
    String(formData.get("invited_role") ?? "reader"),
  );
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!email || !email.includes("@")) {
    redirect("/member/invites?error=email");
  }

  if (!canInviteRole(profile, invitedRole)) {
    redirect("/member/invites?error=role");
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 14,
  ).toISOString();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      email,
      invited_role: invitedRole,
      token_hash: tokenHash,
      invited_by_user_id: profile.id,
      status: "pending",
      expires_at: expiresAt,
      note,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Invite create error:", error);
    redirect("/member/invites?error=save");
  }

  await recordActivity({
    actorUserId: profile.id,
    action: "invite_created",
    targetType: "invite",
    targetId: data.id,
    metadata: { email, invitedRole },
  });

  const inviteUrl = buildAppUrl(`/invite/${token}`);
  redirect(
    `/member/invites?success=created&invite=${encodeURIComponent(inviteUrl)}`,
  );
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const profile = await requireInviteManager();
  const supabase = await createClient();

  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending");

  if (error) {
    console.error("Invite revoke error:", error);
    redirect("/member/invites?error=revoke");
  }

  await recordActivity({
    actorUserId: profile.id,
    action: "invite_revoked",
    targetType: "invite",
    targetId: inviteId,
  });

  redirect("/member/invites?success=revoked");
}

export async function registerFromInvite(
  token: string,
  formData: FormData,
): Promise<void> {
  const invite = await getInviteByToken(token);

  if (!invite || invite.status !== "pending") {
    redirect(`/invite/${token}?error=invalid`);
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    redirect(`/invite/${token}?error=expired`);
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || email !== invite.email || !password) {
    redirect(`/invite/${token}?error=missing`);
  }

  if (password.length < 8) {
    redirect(`/invite/${token}?error=password_short`);
  }

  // v0.8.4: invite sign-up uses the server-side Supabase Admin API.
  // The regular public signUp() flow can return a null session when e-mail
  // confirmation is enabled and was previously misread as "account exists".
  // For invitation-based accounts we already have a controlled invite token,
  // so we create the auth user server-side, mark the e-mail as confirmed for
  // this MVP flow, then prepare the ARTales profile/invite lineage.
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: invite.invited_role,
      invited_role: invite.invited_role,
      invite_id: invite.id,
      invited_by_user_id: invite.invited_by_user_id,
    },
  });

  if (error || !data.user) {
    console.error("Invite admin createUser error:", error);
    const message = error?.message.toLowerCase() ?? "";

    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists") ||
      message.includes("duplicate")
    ) {
      redirect(`/invite/${token}?error=already_registered`);
    }

    redirect(`/invite/${token}?error=signup&detail=${encodeURIComponent(error?.message ?? "unknown")}`);
  }

  const ensured = await ensureProfileForUser({
    id: data.user.id,
    email: data.user.email ?? email,
  });

  if (!ensured.ok) {
    console.error("Invite profile ensure failed after admin createUser:", ensured.reason);
    redirect(`/invite/${token}?error=profile_sync&reason=${encodeURIComponent(ensured.reason ?? "unknown")}`);
  }

  redirect("/login?success=invite_ready");
}
