"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/lib/activityLog";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function registerReader(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const handle = String(formData.get("handle") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !password || !displayName || !handle) {
    redirect("/register?error=missing");
  }

  if (password.length < 8) {
    redirect("/register?error=password_short");
  }

  if (!/^[a-z0-9_-]{3,32}$/.test(handle)) {
    redirect("/register?error=handle");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        handle,
        role: "reader",
      },
    },
  });

  if (error || !data.user) {
    console.error("Reader registration error:", error);
    redirect("/register?error=signup");
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    handle,
    display_name: displayName,
    role: "reader",
    is_active: true,
  });

  await recordActivity({
    actorUserId: data.user.id,
    action: "reader_registered",
    targetType: "profile",
    targetId: data.user.id,
  });

  if (next && next.startsWith("/")) {
    redirect(next);
  }

  redirect("/gallery?success=registered");
}
