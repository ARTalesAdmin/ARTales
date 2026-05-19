"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDisplayName,
  normalizeHandle,
  validateHandle,
} from "@/lib/profileValidation";
import { normalizeRole } from "@/lib/permissions";
import { completeOnboardingForUser } from "@/lib/profileSync";

function safeNext(value: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

function buildOnboardingErrorUrl(reason: string, next: string) {
  return `/onboarding?error=${encodeURIComponent(reason)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
}

export async function completeOnboarding(formData: FormData): Promise<void> {
  const displayName = normalizeDisplayName(
    String(formData.get("display_name") ?? ""),
  );
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!displayName || !handle) {
    redirect(buildOnboardingErrorUrl("missing", next));
  }

  if (!validateHandle(handle)) {
    redirect(buildOnboardingErrorUrl("handle", next));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const result = await completeOnboardingForUser(
    { id: user.id, email: user.email },
    { displayName, handle },
  );

  if (!result.ok || !result.profile) {
    const allowedReasons = new Set([
      "missing",
      "handle",
      "handle_taken",
      "missing_user",
      "profile_upsert_failed",
      "profile_missing_after_upsert",
      "handle_check_failed",
      "profile_update_failed",
      "profile_incomplete_after_update",
    ]);
    const safeReason = result.reason && allowedReasons.has(result.reason)
      ? result.reason
      : "save";
    redirect(buildOnboardingErrorUrl(safeReason, next));
  }

  if (next) {
    redirect(next);
  }

  const role = normalizeRole(result.profile.role ?? "reader");
  redirect(role === "reader" ? "/gallery" : "/member");
}
