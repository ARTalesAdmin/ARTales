"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/permissions";

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

  // v0.8.2: finalize pending invitation/profile server-side after login.
  // This repairs the common flow where e-mail confirmation delays a normal session
  // during sign-up and the invite has to be accepted after the first real login.
  const { error: ensureError } = await supabase.rpc(
    "artales_ensure_profile_after_login_v082",
  );

  if (ensureError) {
    console.error("Profile/invite ensure after login failed:", ensureError);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, handle, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  if (!profile.handle || !profile.display_name) {
    redirect(`/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  if (next) {
    redirect(next);
  }

  const role = normalizeRole(profile.role);
  redirect(role === "reader" ? "/gallery" : "/member");
}
