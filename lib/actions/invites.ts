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

  // v0.8.5: use the normal public Supabase sign-up flow again.
  // A null session after signUp() usually means e-mail confirmation is enabled,
  // not that the account already exists. Invite/profile sync is handled by
  // the auth trigger as a fallback and by service-role ensureProfileForUser()
  // when data.user is available. Final onboarding happens after sign-in.
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAppUrl("/login?success=registered"),
      data: {
        role: invite.invited_role,
        invited_role: invite.invited_role,
        invite_id: invite.id,
        invited_by_user_id: invite.invited_by_user_id,
      },
    },
  });

  if (error) {
    console.error("Invite signUp error:", error);
    const message = error.message.toLowerCase();

    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists") ||
      message.includes("duplicate")
    ) {
      redirect(`/invite/${token}?error=already_registered`);
    }

    redirect(`/invite/${token}?error=signup&detail=${encodeURIComponent(error.message)}`);
  }

  if (data.user?.id) {
    const ensured = await ensureProfileForUser({
      id: data.user.id,
      email: data.user.email ?? email,
    });

    if (!ensured.ok) {
      console.error("Invite profile ensure failed after signUp:", ensured.reason);
      // Do not block account confirmation because profile sync also runs after login.
      redirect(`/login?success=check_email_invite&warning=${encodeURIComponent(ensured.reason ?? "profile_sync_pending")}`);
    }
  }

  if (!data.session) {
    redirect("/login?success=check_email_invite");
  }

  redirect("/onboarding");
}
