"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompletedAccountProfile } from "@/lib/account";

function parseCreditAmount(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!/^[0-9]+$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
}

export async function giftCreditToArtales(formData: FormData): Promise<void> {
  const profile = await requireCompletedAccountProfile("/account/credits");
  const amount = parseCreditAmount(formData.get("amount"));

  if (!amount) {
    redirect("/account/credits?error=invalid_credit_gift");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("artales_gift_reader_credit", {
    p_user_id: profile.id,
    p_amount: amount,
  });

  if (error) {
    console.error("Credit gift RPC failed:", error);
    redirect("/account/credits?error=credit_gift_failed");
  }
  const result = (data ?? {}) as { ok?: boolean; code?: string };
  if (!result.ok) {
    redirect(result.code === "not_enough_credit"
      ? "/account/credits?error=not_enough_credit"
      : "/account/credits?error=credit_gift_failed");
  }

  redirect("/account/credits?success=credit_gifted");
}
