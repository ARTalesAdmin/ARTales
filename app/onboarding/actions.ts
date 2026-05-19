"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDisplayName,
  normalizeHandle,
  validateHandle,
} from "@/lib/profileValidation";
import { recordActivity } from "@/lib/activityLog";

function safeNext(value: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export async function completeOnboarding(formData: FormData): Promise<void> {
  const displayName = normalizeDisplayName(
    String(formData.get("display_name") ?? ""),
  );
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!displayName || !handle) {
    redirect(`/onboarding?error=missing${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  if (!validateHandle(handle)) {
    redirect(`/onboarding?error=handle${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfile?.handle !== handle) {
    const { data: handleAvailable, error: handleCheckError } = await supabase.rpc(
      "is_handle_available",
      { candidate: handle },
    );

    if (handleCheckError) {
      console.error("Handle availability check error:", handleCheckError);
    }

    if (handleAvailable === false) {
      redirect(`/onboarding?error=handle_taken${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      handle,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Onboarding profile update error:", error);
    redirect(`/onboarding?error=save${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  await recordActivity({
    actorUserId: user.id,
    action: "profile_onboarding_completed",
    targetType: "profile",
    targetId: user.id,
    metadata: { handle },
  });

  if (next) {
    redirect(next);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile?.role === "reader" ? "/gallery" : "/member");
}
