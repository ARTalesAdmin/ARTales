"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/lib/activityLog";
import {
  getInviteByToken,
  generateInviteToken,
  hashInviteToken,
} from "@/lib/dbInvites";
import { requireInviteManager } from "@/lib/guards";
import { canInviteRole, normalizeRole } from "@/lib/permissions";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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

  const inviteUrl = `${getAppUrl()}/invite/${token}`;
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
  const displayName = String(formData.get("display_name") ?? "").trim();
  const handle = String(formData.get("handle") ?? "")
    .trim()
    .toLowerCase();

  if (
    !email ||
    email !== invite.email ||
    !password ||
    !displayName ||
    !handle
  ) {
    redirect(`/invite/${token}?error=missing`);
  }

  if (password.length < 8) {
    redirect(`/invite/${token}?error=password_short`);
  }

  if (!/^[a-z0-9_-]{3,32}$/.test(handle)) {
    redirect(`/invite/${token}?error=handle`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        handle,
        invited_role: invite.invited_role,
        invite_id: invite.id,
      },
    },
  });

  if (error || !data.user) {
    console.error("Invite sign-up error:", error);
    redirect(`/invite/${token}?error=signup`);
  }

  const userId = data.user.id;

  await supabase.from("profiles").upsert({
    id: userId,
    email,
    handle,
    display_name: displayName,
    role: invite.invited_role,
    is_active: true,
    invited_by_user_id: invite.invited_by_user_id,
    invite_id: invite.id,
  });

  await supabase
    .from("invites")
    .update({
      status: "accepted",
      accepted_by_user_id: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  await recordActivity({
    actorUserId: userId,
    action: "invite_accepted",
    targetType: "invite",
    targetId: invite.id,
    metadata: {
      role: invite.invited_role,
      invitedBy: invite.invited_by_user_id,
    },
  });

  redirect(
    invite.invited_role === "reader"
      ? "/gallery?success=registered"
      : "/member",
  );
}
