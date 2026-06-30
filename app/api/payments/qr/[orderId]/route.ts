import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createQrPaymentPayload } from "@/lib/manualQrPayments";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

type OrderMetadata = {
  manual_qr_reference?: string;
  manual_qr_message?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, user_id, total_amount_cents, currency, metadata")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("QR payment order load failed:", error);
    return new NextResponse("Order load failed", { status: 500 });
  }

  if (!order) {
    return new NextResponse("Not found", { status: 404 });
  }

  const metadata = (order.metadata ?? {}) as OrderMetadata;
  const variableSymbol = metadata.manual_qr_reference;
  const message = metadata.manual_qr_message;

  if (!variableSymbol || !message) {
    return new NextResponse("Missing payment reference", { status: 422 });
  }

  const payload = createQrPaymentPayload({
    amountCents: Number(order.total_amount_cents ?? 0),
    currency: String(order.currency ?? "EUR"),
    variableSymbol,
    message,
  });

  if (!payload) {
    return new NextResponse("QR payment config missing", { status: 422 });
  }

  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
