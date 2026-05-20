"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  normalizeDisplayName,
  normalizeHandle,
  validateHandle,
} from "@/lib/profileValidation";

function profileError(reason: string) {
  redirect(`/account/profile?error=${encodeURIComponent(reason)}`);
}

export async function updateAccountProfile(formData: FormData): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account/profile");
  }

  const displayName = normalizeDisplayName(String(formData.get("display_name") ?? ""));
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));

  if (!displayName || !handle) {
    profileError("missing");
  }

  if (!validateHandle(handle)) {
    profileError("handle");
  }

  const admin = createAdminClient();
  const { data: existingHandle, error: handleError } = await admin
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", user.id)
    .maybeSingle();

  if (handleError) {
    console.error("Account profile handle check failed:", handleError);
    profileError("handle_check");
  }

  if (existingHandle) {
    profileError("handle_taken");
  }

  const { error } = await admin
    .from("profiles")
    .update({
      display_name: displayName,
      handle,
      profile_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("Account profile update failed:", error);
    profileError("save");
  }

  await admin.from("activity_log").insert({
    actor_user_id: user.id,
    target_type: "profile",
    target_id: user.id,
    action: "profile_updated",
    metadata: { handle, source: "account_profile_v086" },
  });

  redirect("/account/profile?success=profile");
}
