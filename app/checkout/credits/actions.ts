"use server";

import { redirect } from "next/navigation";
import { createManualQrOrder } from "@/lib/manualQrPayments";

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCreditTopupOrder(formData: FormData): Promise<void> {
  const packageCode = formValue(formData, "package_code");
  const billingCountry = formValue(formData, "billing_country");

  const result = await createManualQrOrder({
    kind: "credit_topup",
    packageCode,
    billingCountry,
  });

  if (result.ok) {
    redirect(`/checkout/qr?order=${encodeURIComponent(result.orderId)}`);
  }

  if (result.reason === "not_authenticated") {
    redirect(`/login?error=register_required&next=${encodeURIComponent("/checkout/credits")}`);
  }

  redirect(`/checkout/credits?error=${encodeURIComponent(result.reason)}`);
}
