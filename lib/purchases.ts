import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { environmentLabel } from "@/lib/analytics";
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

type EnvironmentCount = {
  environment: string;
  label: string;
  count: number;
};

type WorkAnalyticsItem = {
  slug: string;
  title: string;
  authorName: string | null;
  detailViews: number;
  readerOpens: number;
  uniqueSessions: number;
  unlocks: number;
  purchaseIntents: number;
};

type DashboardWorkLookupRow = {
  id: string;
  slug: string;
  title: string | null;
  authors?: { name?: string | null } | { name?: string | null }[] | null;
};

type ProductInterestRow = {
  products?: { product_type?: string | null } | { product_type?: string | null }[] | null;
};

export type AdminDashboardMetrics = {
  range: DashboardRange;
  rangeLabel: string;
  generatedAt: string;
  rawPageViews: number;
  uniqueSessions: number;
  activeSignedInUsers: number;
  publicViews: number;
  readerOpens: number;
  accountViews: number;
  memberViews: number;
  adminViews: number;
  checkoutViews: number;
  authViews: number;
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
  environmentCounts: EnvironmentCount[];
  topWorks: WorkAnalyticsItem[];
  productInterest: ProductTypeCount[];
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

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function uniqueCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const set = new Set<string>();
  for (const row of rows) {
    const key = getKey(row);
    if (key) set.add(key);
  }
  return set.size;
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

async function getPageViewRows(start: string | null) {
  const admin = createAdminClient();
  let query = admin
    .from("page_views")
    .select("id, session_id, user_id, path, environment, event_type, entity_type, entity_slug, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (start) query = query.gte("created_at", start);
  const { data, error } = await query;
  if (error) {
    console.error("Dashboard page view load failed:", error);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    session_id: string | null;
    user_id: string | null;
    path: string | null;
    environment: string | null;
    event_type: string | null;
    entity_type: string | null;
    entity_slug: string | null;
    created_at: string;
  }>;
}

async function getTopWorks(params: {
  pageViews: Awaited<ReturnType<typeof getPageViewRows>>;
  start: string | null;
}) {
  const admin = createAdminClient();
  const workMap = new Map<string, WorkAnalyticsItem>();

  for (const view of params.pageViews) {
    if (view.entity_type !== "work" || !view.entity_slug) continue;
    const existing = workMap.get(view.entity_slug) ?? {
      slug: view.entity_slug,
      title: view.entity_slug,
      authorName: null,
      detailViews: 0,
      readerOpens: 0,
      uniqueSessions: 0,
      unlocks: 0,
      purchaseIntents: 0,
    };

    if (view.event_type === "work_detail_view") existing.detailViews += 1;
    if (view.event_type === "reader_open") existing.readerOpens += 1;
    workMap.set(view.entity_slug, existing);
  }

  const sessionsBySlug = new Map<string, Set<string>>();
  for (const view of params.pageViews) {
    if (view.entity_type !== "work" || !view.entity_slug || !view.session_id) continue;
    const set = sessionsBySlug.get(view.entity_slug) ?? new Set<string>();
    set.add(view.session_id);
    sessionsBySlug.set(view.entity_slug, set);
  }
  for (const [slug, sessions] of sessionsBySlug.entries()) {
    const item = workMap.get(slug);
    if (item) item.uniqueSessions = sessions.size;
  }

  const slugs = Array.from(workMap.keys());
  if (slugs.length > 0) {
    const { data: works, error } = await admin
      .from("works")
      .select("id, slug, title, primary_author_id, authors:primary_author_id(name)")
      .in("slug", slugs);
    if (error) console.error("Dashboard works lookup failed:", error);

    const workIdToSlug = new Map<string, string>();
    for (const row of (works ?? []) as DashboardWorkLookupRow[]) {
      const work = row;
      const slug = String(work.slug);
      const item = workMap.get(slug);
      if (!item) continue;
      item.title = String(work.title ?? slug);
      const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
      item.authorName = author?.name ? String(author.name) : null;
      workIdToSlug.set(String(work.id), slug);
    }

    let entitlementQuery = admin
      .from("reader_entitlements")
      .select("work_id, entitlement_type, created_at")
      .eq("entitlement_type", "online_read")
      .eq("is_active", true);
    if (params.start) entitlementQuery = entitlementQuery.gte("created_at", params.start);
    const { data: entitlements, error: entitlementsError } = await entitlementQuery;
    if (entitlementsError) console.error("Dashboard work unlock lookup failed:", entitlementsError);
    for (const row of entitlements ?? []) {
      const slug = workIdToSlug.get(String(row.work_id));
      if (!slug) continue;
      const item = workMap.get(slug);
      if (item) item.unlocks += 1;
    }

    let intentQuery = admin.from("purchase_intents").select("work_id, created_at");
    if (params.start) intentQuery = intentQuery.gte("created_at", params.start);
    const { data: intents, error: intentsError } = await intentQuery;
    if (intentsError) console.error("Dashboard work purchase intent lookup failed:", intentsError);
    for (const row of intents ?? []) {
      const slug = row.work_id ? workIdToSlug.get(String(row.work_id)) : null;
      if (!slug) continue;
      const item = workMap.get(slug);
      if (item) item.purchaseIntents += 1;
    }
  }

  return Array.from(workMap.values())
    .sort((a, b) => (b.readerOpens + b.detailViews + b.unlocks + b.purchaseIntents) - (a.readerOpens + a.detailViews + a.unlocks + a.purchaseIntents))
    .slice(0, 10);
}

export async function getAdminDashboardMetrics(range: DashboardRange): Promise<AdminDashboardMetrics> {
  const admin = createAdminClient();
  const start = rangeStart(range);
  const generatedAt = new Date().toISOString();

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

  const pageViews = await getPageViewRows(start);
  const rawPageViews = pageViews.length;
  const uniqueSessions = uniqueCount(pageViews, (row) => row.session_id);
  const activeSignedInUsers = uniqueCount(pageViews, (row) => row.user_id);

  const environmentMap = countBy(pageViews, (row) => row.environment ?? "unknown");
  const environmentCounts = Array.from(environmentMap.entries())
    .map(([environment, count]) => ({ environment, label: environmentLabel(environment), count }))
    .sort((a, b) => b.count - a.count);

  const publicViews = (environmentMap.get("public") ?? 0) + (environmentMap.get("auth") ?? 0);
  const readerOpens = pageViews.filter((row) => row.event_type === "reader_open").length;
  const accountViews = environmentMap.get("account") ?? 0;
  const memberViews = environmentMap.get("member") ?? 0;
  const adminViews = environmentMap.get("admin") ?? 0;
  const checkoutViews = environmentMap.get("checkout") ?? 0;
  const authViews = environmentMap.get("auth") ?? 0;

  const [accountsTotal, purchaseIntents, ordersTotal, paidOrders] = await Promise.all([
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

  let productInterestQuery = admin
    .from("purchase_intents")
    .select("products:product_id(product_type), created_at");
  if (start) productInterestQuery = productInterestQuery.gte("created_at", start);
  const { data: productInterestRows, error: productInterestError } = await productInterestQuery;
  if (productInterestError) console.error("Dashboard product interest failed:", productInterestError);

  const productInterestMap = new Map<string, number>();
  for (const row of (productInterestRows ?? []) as ProductInterestRow[]) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const productType = product?.product_type ? String(product.product_type) : "unknown";
    productInterestMap.set(productType, (productInterestMap.get(productType) ?? 0) + 1);
  }

  const topWorks = await getTopWorks({ pageViews, start });

  return {
    range,
    rangeLabel: range === "month" ? "Tento měsíc" : "Celkem",
    generatedAt,
    rawPageViews,
    uniqueSessions,
    activeSignedInUsers,
    publicViews,
    readerOpens,
    accountViews,
    memberViews,
    adminViews,
    checkoutViews,
    authViews,
    visits: rawPageViews,
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
    environmentCounts,
    topWorks,
    productInterest: Array.from(productInterestMap.entries())
      .map(([productType, count]) => ({ productType, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function metricsToCsv(metrics: AdminDashboardMetrics) {
  const rows = [
    ["Metric", "Value"],
    ["Range", metrics.rangeLabel],
    ["Generated at", metrics.generatedAt],
    ["Raw page views", String(metrics.rawPageViews)],
    ["Unique sessions", String(metrics.uniqueSessions)],
    ["Active signed-in users", String(metrics.activeSignedInUsers)],
    ["Public views", String(metrics.publicViews)],
    ["Reader opens", String(metrics.readerOpens)],
    ["Account views", String(metrics.accountViews)],
    ["Member views", String(metrics.memberViews)],
    ["Admin views", String(metrics.adminViews)],
    ["Checkout views", String(metrics.checkoutViews)],
    ["Auth views", String(metrics.authViews)],
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
    ["Environment counts", ""],
    ...metrics.environmentCounts.map((item) => [item.label, String(item.count)]),
    ["", ""],
    ["Product purchases", ""],
    ...metrics.productCounts.map((item) => [item.productType, String(item.count)]),
    ["", ""],
    ["Product interest", ""],
    ...metrics.productInterest.map((item) => [item.productType, String(item.count)]),
    ["", ""],
    ["Top works", "Detail views", "Reader opens", "Unique sessions", "Unlocks", "Purchase intents"],
    ...metrics.topWorks.map((item) => [
      item.title,
      String(item.detailViews),
      String(item.readerOpens),
      String(item.uniqueSessions),
      String(item.unlocks),
      String(item.purchaseIntents),
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export type { ProductType };
