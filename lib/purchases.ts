import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/products";

type CountResult = { count: number | null; error: { message: string } | null };

type DashboardRange = "month" | "all";

type RoleCount = {
  role: string;
  count: number;
};

type ProductTypeCount = {
  productType: string;
  count: number;
};

export type AdminDashboardMetrics = {
  range: DashboardRange;
  rangeLabel: string;
  generatedAt: string;
  visits: number;
  accountsTotal: number;
  accountsByRole: RoleCount[];
  purchaseIntents: number;
  ordersTotal: number;
  paidOrders: number;
  paymentsReceivedCents: number;
  paymentsReceivedFormatted: string;
  onlineReadsPurchased: number;
  pdfsPurchased: number;
  epubsPurchased: number;
  booksPurchased: number;
  productCounts: ProductTypeCount[];
  entitlementsOnlineRead: number;
  entitlementsPdf: number;
  entitlementsEpub: number;
};

function getMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function formatEuroCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function rangeStart(range: DashboardRange) {
  return range === "month" ? getMonthStart() : null;
}

async function safeCount(query: PromiseLike<CountResult>, label: string) {
  const result = await query;
  if (result.error) {
    console.error(`${label} failed:`, result.error);
    return 0;
  }

  return result.count ?? 0;
}

function applyCreatedRange<T extends { gte: (column: string, value: string) => T }>(query: T, start: string | null): T {
  return start ? query.gte("created_at", start) : query;
}

export async function createPurchaseIntent(params: {
  productId?: string | null;
  workId?: string | null;
  sourceContext?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;

  let role: string | null = null;
  if (userId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    role = profile?.role ? String(profile.role) : null;
  }

  const { error } = await admin.from("purchase_intents").insert({
    user_id: userId,
    product_id: params.productId || null,
    work_id: params.workId || null,
    status: "captured",
    source_context: params.sourceContext ?? "checkout_coming_soon",
    user_role: role,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("Purchase intent capture failed:", error);
  }
}

export async function getAdminDashboardMetrics(range: DashboardRange): Promise<AdminDashboardMetrics> {
  const admin = createAdminClient();
  const start = rangeStart(range);
  const generatedAt = new Date().toISOString();

  const visitsQuery = applyCreatedRange(
    admin.from("page_views").select("id", { count: "exact", head: true }),
    start,
  );
  const accountsQuery = applyCreatedRange(
    admin.from("profiles").select("id", { count: "exact", head: true }),
    start,
  );
  const intentsQuery = applyCreatedRange(
    admin.from("purchase_intents").select("id", { count: "exact", head: true }),
    start,
  );
  const ordersQuery = applyCreatedRange(
    admin.from("orders").select("id", { count: "exact", head: true }),
    start,
  );
  const paidOrdersQuery = applyCreatedRange(
    admin.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "fulfilled"]),
    start,
  );

  const [visits, accountsTotal, purchaseIntents, ordersTotal, paidOrders] = await Promise.all([
    safeCount(visitsQuery, "Dashboard visit count"),
    safeCount(accountsQuery, "Dashboard account count"),
    safeCount(intentsQuery, "Dashboard purchase intent count"),
    safeCount(ordersQuery, "Dashboard order count"),
    safeCount(paidOrdersQuery, "Dashboard paid order count"),
  ]);

  let roleQuery = admin.from("profiles").select("role, created_at");
  if (start) roleQuery = roleQuery.gte("created_at", start);
  const { data: rolesData, error: rolesError } = await roleQuery;
  if (rolesError) console.error("Dashboard role count failed:", rolesError);

  const roleMap = new Map<string, number>();
  for (const row of rolesData ?? []) {
    const role = String(row.role ?? "unknown");
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
  }

  let ordersPaidSumQuery = admin
    .from("orders")
    .select("total_amount_cents, created_at")
    .in("status", ["paid", "fulfilled"]);
  if (start) ordersPaidSumQuery = ordersPaidSumQuery.gte("created_at", start);
  const { data: paidRows, error: paidError } = await ordersPaidSumQuery;
  if (paidError) console.error("Dashboard payment sum failed:", paidError);
  const paymentsReceivedCents = (paidRows ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount_cents ?? 0),
    0,
  );

  let orderItemsQuery = admin.from("order_items").select("product_type, quantity, created_at");
  if (start) orderItemsQuery = orderItemsQuery.gte("created_at", start);
  const { data: orderItems, error: orderItemsError } = await orderItemsQuery;
  if (orderItemsError) console.error("Dashboard order item count failed:", orderItemsError);

  const productMap = new Map<string, number>();
  for (const row of orderItems ?? []) {
    const productType = String(row.product_type ?? "unknown");
    const quantity = Number(row.quantity ?? 1);
    productMap.set(productType, (productMap.get(productType) ?? 0) + quantity);
  }

  let entitlementQuery = admin
    .from("reader_entitlements")
    .select("entitlement_type, created_at")
    .eq("is_active", true);
  if (start) entitlementQuery = entitlementQuery.gte("created_at", start);
  const { data: entitlementRows, error: entitlementError } = await entitlementQuery;
  if (entitlementError) console.error("Dashboard entitlement count failed:", entitlementError);

  const entitlementCount = (type: string) =>
    (entitlementRows ?? []).filter((row) => row.entitlement_type === type).length;

  return {
    range,
    rangeLabel: range === "month" ? "Tento měsíc" : "Celkem",
    generatedAt,
    visits,
    accountsTotal,
    accountsByRole: Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => a.role.localeCompare(b.role)),
    purchaseIntents,
    ordersTotal,
    paidOrders,
    paymentsReceivedCents,
    paymentsReceivedFormatted: formatEuroCents(paymentsReceivedCents),
    onlineReadsPurchased: productMap.get("online_unlock") ?? 0,
    pdfsPurchased: productMap.get("pdf_download") ?? 0,
    epubsPurchased: productMap.get("epub_download") ?? 0,
    booksPurchased: productMap.get("print") ?? 0,
    productCounts: Array.from(productMap.entries())
      .map(([productType, count]) => ({ productType, count }))
      .sort((a, b) => a.productType.localeCompare(b.productType)),
    entitlementsOnlineRead: entitlementCount("online_read"),
    entitlementsPdf: entitlementCount("pdf_download"),
    entitlementsEpub: entitlementCount("epub_download"),
  };
}

export function metricsToCsv(metrics: AdminDashboardMetrics) {
  const rows = [
    ["Metric", "Value"],
    ["Range", metrics.rangeLabel],
    ["Generated at", metrics.generatedAt],
    ["Visits", String(metrics.visits)],
    ["Accounts total", String(metrics.accountsTotal)],
    ["Purchase intents", String(metrics.purchaseIntents)],
    ["Orders total", String(metrics.ordersTotal)],
    ["Paid orders", String(metrics.paidOrders)],
    ["Payments received", metrics.paymentsReceivedFormatted],
    ["Online reads purchased", String(metrics.onlineReadsPurchased)],
    ["PDFs purchased", String(metrics.pdfsPurchased)],
    ["EPUBs purchased", String(metrics.epubsPurchased)],
    ["Print books purchased", String(metrics.booksPurchased)],
    ["Online read entitlements", String(metrics.entitlementsOnlineRead)],
    ["PDF entitlements", String(metrics.entitlementsPdf)],
    ["EPUB entitlements", String(metrics.entitlementsEpub)],
    ["", ""],
    ["Accounts by role", ""],
    ...metrics.accountsByRole.map((item) => [item.role, String(item.count)]),
    ["", ""],
    ["Product counts", ""],
    ...metrics.productCounts.map((item) => [item.productType, String(item.count)]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export type { ProductType };
