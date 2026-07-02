"use server";

import { redirect } from "next/navigation";
import { cancelManualQrOrderForUser } from "@/lib/manualQrPayments";

function normalizeFormValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function cancelManualQrOrderAction(formData: FormData): Promise<void> {
  const orderId = normalizeFormValue(formData.get("order_id"));

  if (!orderId) {
    redirect("/account/credits?error=missing_order");
  }

  const result = await cancelManualQrOrderForUser(orderId);

  if (!result.ok) {
    redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&error=${encodeURIComponent(result.reason)}`);
  }

  redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&success=cancelled`);
}
