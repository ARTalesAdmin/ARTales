"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/permissions";
import { ensureProfileForUser } from "@/lib/profileSync";
import { getCurrentProfile } from "@/lib/auth";
import { getServerSupabaseConnection } from "@/lib/supabase/connectionIsolation";
import { isProfileComplete } from "@/lib/profileValidation";

function safeNext(value: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "").trim());

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email") && message.includes("confirm")) {
      redirect("/login?error=confirm_email");
    }
    redirect("/login?error=invalid");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid");
  }

  // A cloud ephemeral preview never receives a service-role key. Its one
  // pilot account must be provisioned on that isolated branch ahead of time.
  // The localhost-only switch runs this same no-admin-key login path in E2 CI.
  const target = getServerSupabaseConnection();
  const preprovisionedPilot = target.enabled && (
    target.reason === "ephemeral" ||
    (target.reason === "local" && process.env.ARTALES_TEST_READONLY_LOGIN === "1")
  );
  const ensured = preprovisionedPilot
    ? { ok: true, profile: await getCurrentProfile(), reason: "branch_profile_not_provisioned" }
    : await ensureProfileForUser({ id: user.id, email: user.email });

  if (!ensured.ok || !ensured.profile || ensured.profile.id !== user.id) {
    console.error("Profile/invite ensure after login failed:", ensured.reason);
    redirect("/login?error=profile_save");
  }

  const profile = ensured.profile;

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  if (!isProfileComplete(profile)) {
    redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  if (next) {
    redirect(next);
  }

  const role = normalizeRole(profile.role);
  redirect(role === "reader" ? "/account" : "/member");
}
