"use server";

import { redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { unlockOnlineReadWithCredit } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";

export async function unlockWithCredit(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const workId = String(formData.get("work_id") ?? "").trim();

  if (!slug || !workId) {
    redirect("/account/library?error=missing_credit_unlock_target");
  }

  const profile = await requireCompletedAccountProfile(`/account/credit-unlock/${slug}`);
  const role = normalizeRole(profile.role);

  if (role !== "reader") {
    redirect(`/reader/${slug}?mode=full`);
  }

  const result = await unlockOnlineReadWithCredit({
    userId: profile.id,
    workId,
    slug,
  });

  if (result.status === "already_unlocked") {
    redirect(`/reader/${slug}?mode=full`);
  }

  if (result.status === "insufficient_credit") {
    redirect(`/account/credit-unlock/${slug}?error=not_enough_credit`);
  }

  if (result.status === "error") {
    redirect(`/account/credit-unlock/${slug}?error=credit_unlock_failed`);
  }

  redirect(`/reader/${slug}?mode=full&success=credit_unlock`);
}
