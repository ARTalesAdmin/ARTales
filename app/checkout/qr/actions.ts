"use server";

import { redirect } from "next/navigation";
import { cancelManualQrOrderForUser, reportManualQrPaymentSent } from "@/lib/manualQrPayments";

function normalizeFormValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function reportManualQrPaymentSentAction(formData: FormData): Promise<void> {
  const orderId = normalizeFormValue(formData.get("order_id"));
  if (!orderId) redirect("/checkout/credits?error=missing_order");

  const result = await reportManualQrPaymentSent(orderId);

  if (result.ok) {
    redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&success=reported_paid`);
  }

  if (result.reason === "not_authenticated") {
    redirect(`/login?next=${encodeURIComponent(`/checkout/qr?order=${orderId}`)}`);
  }

  redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&error=${encodeURIComponent(result.reason)}`);
}

export async function cancelManualQrOrderAction(formData: FormData): Promise<void> {
  const orderId = normalizeFormValue(formData.get("order_id"));
  if (!orderId) redirect("/checkout/credits?error=missing_order");

  const result = await cancelManualQrOrderForUser(orderId);

  if (result.ok) {
    redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&success=cancelled`);
  }

  if (result.reason === "not_authenticated") {
    redirect(`/login?next=${encodeURIComponent(`/checkout/qr?order=${orderId}`)}`);
  }

  redirect(`/checkout/qr?order=${encodeURIComponent(orderId)}&error=${encodeURIComponent(result.reason)}`);
}
