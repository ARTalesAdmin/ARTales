"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDisplayName,
  normalizeHandle,
  validateHandle,
} from "@/lib/profileValidation";
import { normalizeRole } from "@/lib/permissions";

function safeNext(value: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

type OnboardingResult = {
  ok?: boolean;
  reason?: string;
  role?: string;
};

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

  const { data, error } = await supabase.rpc(
    "artales_complete_onboarding_v082",
    {
      display_name_input: displayName,
      handle_input: handle,
    },
  );

  if (error) {
    console.error("Onboarding RPC error:", error);
    redirect(`/onboarding?error=save${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const result = (data ?? {}) as OnboardingResult;

  if (!result.ok) {
    const reason = result.reason ?? "save";
    const allowedReasons = new Set([
      "missing",
      "handle",
      "handle_taken",
      "not_authenticated",
      "save",
    ]);
    const safeReason = allowedReasons.has(reason) ? reason : "save";
    redirect(`/onboarding?error=${safeReason}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  if (next) {
    redirect(next);
  }

  const role = normalizeRole(result.role ?? "reader");
  redirect(role === "reader" ? "/gallery" : "/member");
}
