import { createAdminClient } from "@/lib/supabase/admin";
import { formatManualPaymentAmount } from "@/lib/manualQrPayments";

export type ManualQrAdminOrder = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userHandle: string | null;
  createdAt: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number;
  currency: string;
  formattedAmount: string;
  variableSymbol: string | null;
  paymentMessage: string | null;
  checkoutKind: string;
  billingCountry: string | null;
  paymentRail: string | null;
  creditAmount: number | null;
  itemId: string | null;
  itemTitle: string | null;
  itemType: string | null;
  fulfillmentStatus: string | null;
  userReportedPaidAt: string | null;
  userCancelledAt: string | null;
  manualCancelledAt: string | null;
  creditReversedAt: string | null;
};

type OrderMetadata = {
  checkout_kind?: string;
  manual_qr_reference?: string;
  manual_qr_message?: string;
  billing_country?: string;
  payment_rail?: string;
  credit_amount?: number;
  manual_paid_at?: string;
  manual_paid_by_user_id?: string;
  manual_fulfilled_at?: string;
  manual_fulfilled_by_user_id?: string;
  user_reported_paid_at?: string;
  user_cancelled_at?: string;
  manual_cancelled_at?: string;
  manual_cancelled_by_user_id?: string;
  manual_cancellation_note?: string | null;
  manual_credit_reversed_at?: string;
};

type ItemMetadata = {
  credit_amount?: number;
  checkout_kind?: string;
};

type OrderRow = {
  id: string;
  user_id: string | null;
  status: string | null;
  payment_status: string | null;
  total_amount_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  title: string | null;
  product_type: string | null;
  fulfillment_status: string | null;
  metadata: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
};

function asMetadata(value: Record<string, unknown> | null | undefined) {
  return (value ?? {}) as OrderMetadata & ItemMetadata;
}

function mergeMetadata(existing: Record<string, unknown> | null | undefined, next: Record<string, unknown>) {
  return {
    ...(existing ?? {}),
    ...next,
  };
}

export type ManualQrAdminOrderList = {
  orders: ManualQrAdminOrder[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listManualQrAdminOrders(options: {
  page?: number;
  pageSize?: number;
  status?: "active" | "cancelled" | "all";
} = {}): Promise<ManualQrAdminOrderList> {
  const admin = createAdminClient();
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const statusFilter = options.status ?? "active";

  let query = admin
    .from("orders")
    .select("id, user_id, status, payment_status, total_amount_cents, currency, metadata, created_at", { count: "exact" })
    .eq("provider", "manual_qr");

  if (statusFilter === "active") {
    query = query.not("status", "in", "(cancelled,refunded)");
  } else if (statusFilter === "cancelled") {
    query = query.in("status", ["cancelled", "refunded"]);
  }

  const { data: orders, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Manual QR admin orders load failed:", error);
    return { orders: [], total: 0, page, pageSize };
  }

  const orderRows = (orders ?? []) as OrderRow[];
  const orderIds = orderRows.map((order) => order.id);
  const userIds = Array.from(new Set(orderRows.map((order) => order.user_id).filter(Boolean))) as string[];

  const [itemsResult, profilesResult] = await Promise.all([
    orderIds.length > 0
      ? admin
          .from("order_items")
          .select("id, order_id, title, product_type, fulfillment_status, metadata")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? admin
          .from("profiles")
          .select("id, email, display_name, handle")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsResult.error) console.error("Manual QR admin items load failed:", itemsResult.error);
  if (profilesResult.error) console.error("Manual QR admin profiles load failed:", profilesResult.error);

  const itemByOrderId = new Map<string, OrderItemRow>();
  for (const item of ((itemsResult.data ?? []) as OrderItemRow[])) {
    if (!itemByOrderId.has(item.order_id)) itemByOrderId.set(item.order_id, item);
  }

  const profileById = new Map<string, ProfileRow>();
  for (const profile of ((profilesResult.data ?? []) as ProfileRow[])) {
    profileById.set(profile.id, profile);
  }

  const mappedOrders = orderRows.map((order) => {
    const orderMetadata = asMetadata(order.metadata);
    const item = itemByOrderId.get(order.id) ?? null;
    const itemMetadata = asMetadata(item?.metadata);
    const profile = order.user_id ? profileById.get(order.user_id) ?? null : null;
    const totalAmountCents = Number(order.total_amount_cents ?? 0);
    const currency = String(order.currency ?? "EUR");
    const checkoutKind = String(orderMetadata.checkout_kind ?? item?.product_type ?? "manual_qr");
    const creditAmount = Number(orderMetadata.credit_amount ?? itemMetadata.credit_amount ?? 0) || null;

    return {
      id: order.id,
      userId: order.user_id,
      userEmail: profile?.email ?? null,
      userName: profile?.display_name ?? null,
      userHandle: profile?.handle ?? null,
      createdAt: order.created_at,
      status: String(order.status ?? "pending_payment"),
      paymentStatus: String(order.payment_status ?? "pending"),
      totalAmountCents,
      currency,
      formattedAmount: formatManualPaymentAmount(totalAmountCents, currency),
      variableSymbol: orderMetadata.manual_qr_reference ?? null,
      paymentMessage: orderMetadata.manual_qr_message ?? null,
      checkoutKind,
      billingCountry: orderMetadata.billing_country ?? null,
      paymentRail: orderMetadata.payment_rail ?? null,
      creditAmount,
      itemId: item?.id ?? null,
      itemTitle: item?.title ?? null,
      itemType: item?.product_type ?? null,
      fulfillmentStatus: item?.fulfillment_status ?? null,
      userReportedPaidAt: orderMetadata.user_reported_paid_at ?? null,
      userCancelledAt: orderMetadata.user_cancelled_at ?? null,
      manualCancelledAt: orderMetadata.manual_cancelled_at ?? null,
      creditReversedAt: orderMetadata.manual_credit_reversed_at ?? null,
    };
  });

  return { orders: mappedOrders, total: count ?? mappedOrders.length, page, pageSize };
}

export async function markManualQrOrderPaid(params: {
  orderId: string;
  adminUserId: string;
  note?: string;
}) {
  const admin = createAdminClient();
  const paidAt = new Date().toISOString();

  const { data: order, error: loadError } = await admin
    .from("orders")
    .select("id, metadata")
    .eq("id", params.orderId)
    .eq("provider", "manual_qr")
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!order) throw new Error("Manual QR order not found.");

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      paid_at: paidAt,
      metadata: mergeMetadata(order.metadata as Record<string, unknown> | null, {
        manual_paid_at: paidAt,
        manual_paid_by_user_id: params.adminUserId,
        manual_payment_note: params.note ?? null,
      }),
    })
    .eq("id", params.orderId);

  if (error) throw new Error(error.message);
}

export async function fulfillManualQrOrder(params: {
  orderId: string;
  adminUserId: string;
  note?: string;
}) {
  const admin = createAdminClient();
  const fulfilledAt = new Date().toISOString();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, user_id, status, payment_status, metadata")
    .eq("id", params.orderId)
    .eq("provider", "manual_qr")
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Manual QR order not found.");
  if (!order.user_id) throw new Error("Manual QR order has no user.");

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("id, product_type, fulfillment_status, metadata, title")
    .eq("order_id", params.orderId)
    .limit(1);

  if (itemsError) throw new Error(itemsError.message);
  const item = items?.[0] as (OrderItemRow & { title: string | null }) | undefined;
  if (!item) throw new Error("Manual QR order item not found.");

  const orderMetadata = asMetadata(order.metadata as Record<string, unknown> | null);
  const itemMetadata = asMetadata(item.metadata);
  const checkoutKind = String(orderMetadata.checkout_kind ?? item.product_type ?? "");
  const creditAmount = Number(orderMetadata.credit_amount ?? itemMetadata.credit_amount ?? 0);

  if (item.fulfillment_status === "fulfilled" || order.status === "fulfilled") {
    return { alreadyFulfilled: true };
  }

  if (checkoutKind === "credit_topup") {
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      throw new Error("Credit amount is missing.");
    }

    const { error: ledgerError } = await admin.from("reader_credit_ledger").insert({
      user_id: order.user_id,
      credit_type: "at_credit",
      amount: creditAmount,
      source: "purchase",
      related_work_id: null,
      note: params.note || `Ruční QR dobití kreditu k objednávce ${params.orderId}.`,
      metadata: {
        order_id: params.orderId,
        payment_method: "manual_qr",
        fulfilled_by_user_id: params.adminUserId,
        fulfilled_at: fulfilledAt,
      },
    });

    if (ledgerError) throw new Error(ledgerError.message);
  }

  const mergedOrderMetadata = mergeMetadata(order.metadata as Record<string, unknown> | null, {
    manual_paid_at: orderMetadata.manual_paid_at ?? fulfilledAt,
    manual_paid_by_user_id: orderMetadata.manual_paid_by_user_id ?? params.adminUserId,
    manual_fulfilled_at: fulfilledAt,
    manual_fulfilled_by_user_id: params.adminUserId,
    manual_fulfillment_note: params.note ?? null,
  });

  const [itemUpdate, orderUpdate] = await Promise.all([
    admin
      .from("order_items")
      .update({ fulfillment_status: "fulfilled" })
      .eq("id", item.id),
    admin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "fulfilled",
        paid_at: orderMetadata.manual_paid_at ?? fulfilledAt,
        fulfilled_at: fulfilledAt,
        metadata: mergedOrderMetadata,
      })
      .eq("id", params.orderId),
  ]);

  if (itemUpdate.error) throw new Error(itemUpdate.error.message);
  if (orderUpdate.error) throw new Error(orderUpdate.error.message);

  return { alreadyFulfilled: false };
}


export async function cancelManualQrOrderAsAdmin(params: {
  orderId: string;
  adminUserId: string;
  note?: string;
}) {
  const admin = createAdminClient();
  const cancelledAt = new Date().toISOString();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, user_id, status, payment_status, metadata")
    .eq("id", params.orderId)
    .eq("provider", "manual_qr")
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Manual QR order not found.");

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("id, product_type, fulfillment_status, metadata, title")
    .eq("order_id", params.orderId)
    .limit(1);

  if (itemsError) throw new Error(itemsError.message);
  const item = items?.[0] as (OrderItemRow & { title: string | null }) | undefined;

  const orderMetadata = asMetadata(order.metadata as Record<string, unknown> | null);
  const itemMetadata = asMetadata(item?.metadata);
  const checkoutKind = String(orderMetadata.checkout_kind ?? item?.product_type ?? "");
  const creditAmount = Number(orderMetadata.credit_amount ?? itemMetadata.credit_amount ?? 0);
  const wasFulfilled = String(order.status ?? "") === "fulfilled" || item?.fulfillment_status === "fulfilled";
  const alreadyReversed = Boolean(orderMetadata.manual_credit_reversed_at);

  if (wasFulfilled && checkoutKind === "credit_topup" && creditAmount > 0 && !alreadyReversed) {
    const { error: ledgerError } = await admin.from("reader_credit_ledger").insert({
      user_id: order.user_id,
      credit_type: "at_credit",
      amount: -Math.abs(creditAmount),
      source: "admin_adjustment",
      related_work_id: null,
      note: params.note || `Storno QR dobití kreditu k objednávce ${params.orderId}.`,
      metadata: {
        order_id: params.orderId,
        payment_method: "manual_qr",
        reversed_by_user_id: params.adminUserId,
        reversed_at: cancelledAt,
      },
    });

    if (ledgerError) throw new Error(ledgerError.message);
  }

  const nextPaymentStatus = String(order.payment_status ?? "") === "paid" || wasFulfilled ? "refunded" : "failed";
  const nextStatus = wasFulfilled || nextPaymentStatus === "refunded" ? "refunded" : "cancelled";

  const [itemUpdate, orderUpdate] = await Promise.all([
    item
      ? admin
          .from("order_items")
          .update({ fulfillment_status: "failed" })
          .eq("id", item.id)
      : Promise.resolve({ error: null }),
    admin
      .from("orders")
      .update({
        status: nextStatus,
        payment_status: nextPaymentStatus,
        cancelled_at: cancelledAt,
        metadata: mergeMetadata(order.metadata as Record<string, unknown> | null, {
          manual_cancelled_at: cancelledAt,
          manual_cancelled_by_user_id: params.adminUserId,
          manual_cancellation_note: params.note ?? null,
          manual_credit_reversed_at: wasFulfilled && checkoutKind === "credit_topup" && creditAmount > 0 && !alreadyReversed
            ? cancelledAt
            : orderMetadata.manual_credit_reversed_at ?? null,
        }),
      })
      .eq("id", params.orderId),
  ]);

  if (itemUpdate.error) throw new Error(itemUpdate.error.message);
  if (orderUpdate.error) throw new Error(orderUpdate.error.message);
}
