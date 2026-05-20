"use server";

import { redirect } from "next/navigation";
import { buildAppUrl } from "@/lib/appUrl";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function securityError(reason: string) {
  redirect(`/account/security?error=${encodeURIComponent(reason)}`);
}

export async function changeAccountPassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!password || !passwordConfirm) {
    securityError("missing");
  }

  if (password !== passwordConfirm) {
    securityError("mismatch");
  }

  if (password.length < 8) {
    securityError("short");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/account/security");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Account password update failed:", error);
    securityError("save");
  }

  const admin = createAdminClient();
  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "profile",
    target_id: user.id,
    action: "password_changed",
    metadata: { source: "account_security_v088" },
  });

  redirect("/account/security?success=password");
}

export async function sendAccountPasswordReset(): Promise<void> {
  const user = await getCurrentUser();

  if (!user?.email) {
    redirect("/login?next=/account/security");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: buildAppUrl("/auth/callback?next=/reset-password"),
  });

  if (error) {
    console.error("Account password reset e-mail failed:", error);
    securityError("reset_send");
  }

  redirect("/account/security?success=reset_sent");
}
