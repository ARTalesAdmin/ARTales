import { createAdminClient } from "@/lib/supabase/admin";
import { formatManualPaymentAmount } from "@/lib/manualQrPayments";

export type ReaderCreditLedgerItem = {
  id: string;
  amount: number;
  source: string;
  note: string | null;
  createdAt: string;
  orderId: string | null;
};

export type ReaderManualQrPaymentItem = {
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  formattedAmount: string;
  currency: string;
  totalAmountCents: number;
  variableSymbol: string | null;
  paymentMessage: string | null;
  checkoutKind: string;
  billingCountry: string | null;
  paymentRail: string | null;
  creditAmount: number | null;
  userReportedPaidAt: string | null;
  userCancelledAt: string | null;
  manualCancelledAt: string | null;
  manualFulfilledAt: string | null;
  itemTitle: string | null;
  fulfillmentStatus: string | null;
};

export type ReaderCommerceSummary = {
  creditBalance: number;
  creditLedger: ReaderCreditLedgerItem[];
  payments: ReaderManualQrPaymentItem[];
};

type CreditLedgerRow = {
  id: string;
  amount: number | null;
  source: string | null;
  note: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type OrderRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  total_amount_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  title: string | null;
  product_type: string | null;
  fulfillment_status: string | null;
  metadata: Record<string, unknown> | null;
};

type OrderMetadata = {
  checkout_kind?: string;
  manual_qr_reference?: string;
  manual_qr_message?: string;
  billing_country?: string;
  payment_rail?: string;
  credit_amount?: number;
  user_reported_paid_at?: string;
  user_cancelled_at?: string;
  manual_cancelled_at?: string;
  manual_fulfilled_at?: string;
};

type ItemMetadata = {
  checkout_kind?: string;
  credit_amount?: number;
};

function asMetadata(value: Record<string, unknown> | null | undefined) {
  return (value ?? {}) as OrderMetadata & ItemMetadata;
}

function getOrderIdFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.order_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getReaderCommerceSummary(userId: string): Promise<ReaderCommerceSummary> {
  const admin = createAdminClient();

  const [ledgerResult, ordersResult] = await Promise.all([
    admin
      .from("reader_credit_ledger")
      .select("id, amount, source, note, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
    admin
      .from("orders")
      .select("id, status, payment_status, total_amount_cents, currency, metadata, created_at")
      .eq("user_id", userId)
      .eq("provider", "manual_qr")
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  if (ledgerResult.error) console.error("Reader credit ledger load failed:", ledgerResult.error);
  if (ordersResult.error) console.error("Reader manual QR orders load failed:", ordersResult.error);

  const ledgerRows = (ledgerResult.data ?? []) as CreditLedgerRow[];
  const orderRows = (ordersResult.data ?? []) as OrderRow[];
  const orderIds = orderRows.map((order) => order.id);

  const itemsResult = orderIds.length > 0
    ? await admin
        .from("order_items")
        .select("order_id, title, product_type, fulfillment_status, metadata")
        .in("order_id", orderIds)
    : { data: [], error: null };

  if (itemsResult.error) console.error("Reader manual QR order items load failed:", itemsResult.error);

  const itemByOrderId = new Map<string, OrderItemRow>();
  for (const item of ((itemsResult.data ?? []) as OrderItemRow[])) {
    if (!itemByOrderId.has(item.order_id)) itemByOrderId.set(item.order_id, item);
  }

  const creditLedger = ledgerRows.map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    source: String(row.source ?? "unknown"),
    note: row.note,
    createdAt: row.created_at,
    orderId: getOrderIdFromMetadata(row.metadata),
  }));

  const creditBalance = creditLedger.reduce((sum, row) => sum + row.amount, 0);

  const payments = orderRows.map((order) => {
    const orderMetadata = asMetadata(order.metadata);
    const item = itemByOrderId.get(order.id) ?? null;
    const itemMetadata = asMetadata(item?.metadata);
    const totalAmountCents = Number(order.total_amount_cents ?? 0);
    const currency = String(order.currency ?? "EUR");
    const checkoutKind = String(orderMetadata.checkout_kind ?? item?.product_type ?? "manual_qr");
    const creditAmount = Number(orderMetadata.credit_amount ?? itemMetadata.credit_amount ?? 0) || null;

    return {
      id: order.id,
      createdAt: order.created_at,
      status: String(order.status ?? "pending_payment"),
      paymentStatus: String(order.payment_status ?? "pending"),
      formattedAmount: formatManualPaymentAmount(totalAmountCents, currency),
      currency,
      totalAmountCents,
      variableSymbol: orderMetadata.manual_qr_reference ?? null,
      paymentMessage: orderMetadata.manual_qr_message ?? null,
      checkoutKind,
      billingCountry: orderMetadata.billing_country ?? null,
      paymentRail: orderMetadata.payment_rail ?? null,
      creditAmount,
      userReportedPaidAt: orderMetadata.user_reported_paid_at ?? null,
      userCancelledAt: orderMetadata.user_cancelled_at ?? null,
      manualCancelledAt: orderMetadata.manual_cancelled_at ?? null,
      manualFulfilledAt: orderMetadata.manual_fulfilled_at ?? null,
      itemTitle: item?.title ?? null,
      fulfillmentStatus: item?.fulfillment_status ?? null,
    };
  });

  return { creditBalance, creditLedger, payments };
}
