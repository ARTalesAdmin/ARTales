"use server";

import { redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { activateMembershipWithCredits, isActivatableMembershipTier } from "@/lib/readerMembership";

export async function activateMembership(formData: FormData): Promise<void> {
  const tier = String(formData.get("tier") ?? "").trim();

  if (!isActivatableMembershipTier(tier)) {
    redirect("/account/membership?error=invalid_tier");
  }

  const profile = await requireCompletedAccountProfile("/account/membership");
  const result = await activateMembershipWithCredits({ userId: profile.id, tier });

  if (!result.ok) {
    redirect(`/account/membership?error=${encodeURIComponent(result.code)}`);
  }

  redirect(`/account/membership?success=membership_activated&tier=${encodeURIComponent(tier)}`);
}
