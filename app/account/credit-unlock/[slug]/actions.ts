"use server";

import { redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { canOpenFullReader } from "@/lib/entitlements";
import { normalizeRole } from "@/lib/permissions";
import { spendAtCreditForOnlineUnlock, spendMemberUnlockForOnlineReading } from "@/lib/readerMembership";

function getUnlockTarget(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim(),
    workId: String(formData.get("work_id") ?? "").trim(),
  };
}

export async function useMemberOnlineUnlock(formData: FormData): Promise<void> {
  const { slug, workId } = getUnlockTarget(formData);

  if (!slug || !workId) {
    redirect("/account/library?error=missing_unlock_target");
  }

  const profile = await requireCompletedAccountProfile(`/account/credit-unlock/${slug}`);
  const role = normalizeRole(profile.role);

  if (role !== "reader") {
    redirect(`/reader/${slug}?mode=full`);
  }

  const alreadyOpen = await canOpenFullReader(profile, workId);
  if (alreadyOpen) {
    redirect(`/reader/${slug}?mode=full`);
  }

  const result = await spendMemberUnlockForOnlineReading({
    userId: profile.id,
    workId,
  });

  if (!result.ok) {
    redirect(`/account/credit-unlock/${slug}?error=${encodeURIComponent(result.code)}`);
  }

  redirect(`/account/credit-unlock/${slug}?success=member_unlock`);
}

export async function useAtCreditOnlineUnlock(formData: FormData): Promise<void> {
  const { slug, workId } = getUnlockTarget(formData);

  if (!slug || !workId) {
    redirect("/account/library?error=missing_unlock_target");
  }

  const profile = await requireCompletedAccountProfile(`/account/credit-unlock/${slug}`);
  const role = normalizeRole(profile.role);

  if (role !== "reader") {
    redirect(`/reader/${slug}?mode=full`);
  }

  const alreadyOpen = await canOpenFullReader(profile, workId);
  if (alreadyOpen) {
    redirect(`/reader/${slug}?mode=full`);
  }

  const result = await spendAtCreditForOnlineUnlock({
    userId: profile.id,
    workId,
  });

  if (!result.ok) {
    redirect(`/account/credit-unlock/${slug}?error=${encodeURIComponent(result.code)}`);
  }

  redirect(`/account/credit-unlock/${slug}?success=credit_unlock`);
}
