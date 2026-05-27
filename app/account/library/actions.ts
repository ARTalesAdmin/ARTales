"use server";

import { requireCompletedAccountProfile } from "@/lib/account";
import { setSavedWorkForUser } from "@/lib/entitlements";

export async function setSavedWork(workId: string, saved: boolean): Promise<{ ok: boolean }> {
  const profile = await requireCompletedAccountProfile("/account/library");

  await setSavedWorkForUser({
    userId: profile.id,
    workId,
    saved,
  });

  return { ok: true };
}
