"use server";

import { redirect } from "next/navigation";
import { parseEconomicRequestId } from "@/lib/economicRequest";
import { requireCompletedAccountProfile } from "@/lib/account";
import { activateMembershipWithCredits, isActivatableMembershipTier } from "@/lib/readerMembership";

export async function activateMembership(formData: FormData): Promise<void> {
  const tier = String(formData.get("tier") ?? "").trim();

  if (!isActivatableMembershipTier(tier)) {
    redirect("/account/membership?error=invalid_tier");
  }

  const profile = await requireCompletedAccountProfile("/account/membership");
  const requestId = parseEconomicRequestId(formData.get("economic_request_id"));
  if (!requestId) redirect("/account/membership?error=request_id_required");
  const result = await activateMembershipWithCredits({ userId: profile.id, tier, requestId });

  if (!result.ok) {
    redirect(`/account/membership?error=${encodeURIComponent(result.code)}`);
  }

  redirect(`/account/membership?success=membership_activated&tier=${encodeURIComponent(tier)}`);
}
