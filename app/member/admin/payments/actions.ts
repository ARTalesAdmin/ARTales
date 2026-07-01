"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { cancelManualQrOrderAsAdmin, fulfillManualQrOrder, markManualQrOrderPaid } from "@/lib/manualQrAdmin";

function normalizeFormValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function markManualQrPaymentPaidAction(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const orderId = normalizeFormValue(formData.get("order_id"));
  const note = normalizeFormValue(formData.get("note"));

  if (!orderId) redirect("/member/admin/payments?error=missing_order");

  try {
    await markManualQrOrderPaid({
      orderId,
      adminUserId: profile.id,
      note: note || undefined,
    });
  } catch (error) {
    console.error("Manual QR mark paid failed:", error);
    redirect("/member/admin/payments?error=mark_paid_failed");
  }

  redirect("/member/admin/payments?success=marked_paid");
}

export async function fulfillManualQrPaymentAction(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const orderId = normalizeFormValue(formData.get("order_id"));
  const note = normalizeFormValue(formData.get("note"));

  if (!orderId) redirect("/member/admin/payments?error=missing_order");

  try {
    const result = await fulfillManualQrOrder({
      orderId,
      adminUserId: profile.id,
      note: note || undefined,
    });

    if (result.alreadyFulfilled) {
      redirect("/member/admin/payments?success=already_fulfilled");
    }
  } catch (error) {
    console.error("Manual QR fulfillment failed:", error);
    redirect("/member/admin/payments?error=fulfillment_failed");
  }

  redirect("/member/admin/payments?success=fulfilled");
}

export async function cancelManualQrPaymentAction(formData: FormData): Promise<void> {
  const profile = await requireAdmin();
  const orderId = normalizeFormValue(formData.get("order_id"));
  const note = normalizeFormValue(formData.get("note"));

  if (!orderId) redirect("/member/admin/payments?error=missing_order");

  try {
    await cancelManualQrOrderAsAdmin({
      orderId,
      adminUserId: profile.id,
      note: note || undefined,
    });
  } catch (error) {
    console.error("Manual QR cancel failed:", error);
    redirect("/member/admin/payments?error=cancel_failed");
  }

  redirect("/member/admin/payments?success=cancelled");
}
