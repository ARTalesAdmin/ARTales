"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function resetPassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");

  if (!password || !passwordConfirm) {
    redirect("/reset-password?error=missing");
  }

  if (password !== passwordConfirm) {
    redirect("/reset-password?error=mismatch");
  }

  if (password.length < 8) {
    redirect("/reset-password?error=short");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/reset-password?error=session");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Reset password update failed:", error);
    redirect("/reset-password?error=save");
  }

  redirect("/login?success=password_reset");
}
