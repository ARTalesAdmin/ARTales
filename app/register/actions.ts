"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/lib/activityLog";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeNext(value: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export async function registerReader(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) {
    redirect("/register?error=missing");
  }

  if (password.length < 8) {
    redirect("/register?error=password_short");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "reader",
      },
    },
  });

  if (error || !data.user) {
    console.error("Reader registration error:", error);
    redirect("/register?error=signup");
  }

  if (data.session) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      role: "reader",
      is_active: true,
    });

    await recordActivity({
      actorUserId: data.user.id,
      action: "reader_registered",
      targetType: "profile",
      targetId: data.user.id,
    });

    redirect(next || "/onboarding");
  }

  redirect("/login?success=registered");
}
