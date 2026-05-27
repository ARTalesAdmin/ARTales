"use server";

import { redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { grantWelcomeUnlock } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";

export async function useWelcomeUnlock(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const workId = String(formData.get("work_id") ?? "").trim();

  if (!slug || !workId) {
    redirect("/account/library?error=missing_unlock_target");
  }

  const profile = await requireCompletedAccountProfile(`/account/unlock/${slug}`);
  const role = normalizeRole(profile.role);

  if (role !== "reader") {
    redirect(`/reader/${slug}?mode=full`);
  }

  try {
    await grantWelcomeUnlock({
      userId: profile.id,
      workId,
    });
  } catch (error) {
    console.error("Welcome unlock failed:", error);
    redirect(`/account/unlock/${slug}?error=welcome_unlock_failed`);
  }

  redirect(`/reader/${slug}?mode=full&success=welcome_unlock`);
}
