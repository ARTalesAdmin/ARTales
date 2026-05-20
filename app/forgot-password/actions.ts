"use server";

import { redirect } from "next/navigation";
import { buildAppUrl } from "@/lib/appUrl";
import { createClient } from "@/lib/supabase/server";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function sendForgotPasswordEmail(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email) {
    redirect("/forgot-password?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAppUrl("/auth/callback?next=/reset-password"),
  });

  if (error) {
    console.error("Forgot password e-mail failed:", error);
    redirect("/forgot-password?error=send");
  }

  redirect("/forgot-password?success=sent");
}
