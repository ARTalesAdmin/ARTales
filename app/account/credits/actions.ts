"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompletedAccountProfile } from "@/lib/account";

function parseCreditAmount(value: FormDataEntryValue | null) {
  const amount = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function giftCreditToArtales(formData: FormData): Promise<void> {
  const profile = await requireCompletedAccountProfile("/account/credits");
  const amount = parseCreditAmount(formData.get("amount"));

  if (!amount) {
    redirect("/account/credits?error=invalid_credit_gift");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reader_credit_ledger")
    .select("amount")
    .eq("user_id", profile.id);

  if (error) {
    console.error("Credit gift balance check failed:", error);
    redirect("/account/credits?error=credit_gift_failed");
  }

  const balance = (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  if (balance < amount) {
    redirect("/account/credits?error=not_enough_credit");
  }

  const { error: insertError } = await admin.from("reader_credit_ledger").insert({
    user_id: profile.id,
    credit_type: "at_credit",
    amount: -amount,
    source: "contribution",
    note: "Dar kreditu projektu ARTales",
    metadata: {
      contribution_kind: "artales_project_support",
      amount,
    },
  });

  if (insertError) {
    console.error("Credit gift insert failed:", insertError);
    redirect("/account/credits?error=credit_gift_failed");
  }

  redirect("/account/credits?success=credit_gifted");
}
