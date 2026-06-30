import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ManualQrCheckoutKind = "credit_topup" | "support";

export type ManualQrCountry = {
  code: string;
  label: string;
};

export type ManualQrPackage = {
  code: string;
  title: string;
  description: string;
  amountCents: number;
  creditAmount?: number;
  badge?: string;
};

export type ManualQrPaymentConfig = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  bic: string;
  note: string;
  isConfigured: boolean;
};

export type ManualQrOrderSummary = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmountCents: number;
  currency: string;
  variableSymbol: string;
  paymentMessage: string;
  createdAt: string;
  kind: ManualQrCheckoutKind;
  billingCountry: string | null;
  qrPayload: string | null;
  qrImageUrl: string;
  item: {
    title: string;
    productType: string;
    fulfillmentStatus: string;
  } | null;
};

type OrderMetadata = {
  manual_qr_reference?: string;
  manual_qr_message?: string;
  manual_qr_kind?: ManualQrCheckoutKind;
  billing_country?: string;
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
  title: string | null;
  product_type: string | null;
  fulfillment_status: string | null;
};

export const MANUAL_QR_CURRENCY = "EUR";

export const MANUAL_QR_COUNTRIES: ManualQrCountry[] = [
  { code: "AT", label: "Rakousko" },
  { code: "BE", label: "Belgie" },
  { code: "BG", label: "Bulharsko" },
  { code: "HR", label: "Chorvatsko" },
  { code: "CY", label: "Kypr" },
  { code: "CZ", label: "Česko" },
  { code: "DK", label: "Dánsko" },
  { code: "EE", label: "Estonsko" },
  { code: "FI", label: "Finsko" },
  { code: "FR", label: "Francie" },
  { code: "DE", label: "Německo" },
  { code: "GR", label: "Řecko" },
  { code: "HU", label: "Maďarsko" },
  { code: "IE", label: "Irsko" },
  { code: "IT", label: "Itálie" },
  { code: "LV", label: "Lotyšsko" },
  { code: "LT", label: "Litva" },
  { code: "LU", label: "Lucembursko" },
  { code: "MT", label: "Malta" },
  { code: "NL", label: "Nizozemsko" },
  { code: "PL", label: "Polsko" },
  { code: "PT", label: "Portugalsko" },
  { code: "RO", label: "Rumunsko" },
  { code: "SK", label: "Slovensko" },
  { code: "SI", label: "Slovinsko" },
  { code: "ES", label: "Španělsko" },
  { code: "SE", label: "Švédsko" },
];

const MANUAL_QR_COUNTRY_CODES = new Set(MANUAL_QR_COUNTRIES.map((country) => country.code));

export const CREDIT_TOPUP_PACKAGES: ManualQrPackage[] = [
  {
    code: "credit_5",
    title: "Startovací kredit",
    description: "Dobré pro první odemčení a vyzkoušení placené vrstvy ARTales.",
    amountCents: 500,
    creditAmount: 5,
  },
  {
    code: "credit_10",
    title: "Čtenářský kredit",
    description: "Praktický balíček pro několik online odemčení nebo první PDF/EPUB nabídky.",
    amountCents: 1000,
    creditAmount: 10,
    badge: "Doporučeno pro start",
  },
  {
    code: "credit_20",
    title: "Rozšířený kredit",
    description: "Pohodlnější rezerva pro častější čtení, edice a budoucí členské výhody.",
    amountCents: 2000,
    creditAmount: 20,
  },
  {
    code: "credit_50",
    title: "Patronní kredit",
    description: "Vyšší kredit pro podporovatele, školy, testování větší knihovny nebo budoucí služby.",
    amountCents: 5000,
    creditAmount: 50,
  },
];

export const SUPPORT_PACKAGES: ManualQrPackage[] = [
  {
    code: "support_5",
    title: "Malá podpora",
    description: "Pomůže s provozem, přípravou edic a dalším vývojem platformy.",
    amountCents: 500,
  },
  {
    code: "support_10",
    title: "Podpora ARTales",
    description: "Dobrá jednorázová podpora nezávislého literárního prostoru.",
    amountCents: 1000,
    badge: "Dobrý start",
  },
  {
    code: "support_25",
    title: "Mecenášský příspěvek",
    description: "Pomáhá posouvat knihovnu, vizuály, ediční práci a nové funkce.",
    amountCents: 2500,
  },
  {
    code: "support_50",
    title: "Patron ARTales",
    description: "Výraznější podpora pro vznik dlouhodobé literární a ediční platformy.",
    amountCents: 5000,
  },
];

function shortOrderCode(orderId: string) {
  return orderId.replace(/-/g, "").slice(0, 10).toUpperCase();
}

function createNumericReference(orderId: string) {
  let hash = 2166136261;
  for (let index = 0; index < orderId.length; index += 1) {
    hash ^= orderId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return String(Math.abs(hash) % 10000000000).padStart(10, "0");
}

function normalizeCountry(value: string) {
  const country = value.trim().toUpperCase();
  return MANUAL_QR_COUNTRY_CODES.has(country) ? country : null;
}

function getPackage(kind: ManualQrCheckoutKind, packageCode: string) {
  const packages = kind === "credit_topup" ? CREDIT_TOPUP_PACKAGES : SUPPORT_PACKAGES;
  return packages.find((item) => item.code === packageCode) ?? null;
}

function normalizePackageCode(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCheckoutKind(value: string): ManualQrCheckoutKind | null {
  if (value === "credit_topup" || value === "support") return value;
  return null;
}

function formatAmountForQr(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function sanitizeSpdValue(value: string) {
  return value
    .replace(/\*/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function getManualQrPaymentConfig(): ManualQrPaymentConfig {
  const accountName = process.env.ARTALES_QR_ACCOUNT_NAME ?? "ARTales";
  const bankName = process.env.ARTALES_QR_BANK_NAME ?? "";
  const accountNumber = process.env.ARTALES_QR_ACCOUNT_NUMBER ?? "";
  const iban = (process.env.ARTALES_QR_IBAN ?? "").replace(/\s+/g, "").toUpperCase();
  const bic = (process.env.ARTALES_QR_BIC ?? "").replace(/\s+/g, "").toUpperCase();
  const note = process.env.ARTALES_QR_PAYMENT_NOTE ?? "Kredit nebo podpora se aktivuje ručně po spárování platby.";

  return {
    accountName,
    bankName,
    accountNumber,
    iban,
    bic,
    note,
    isConfigured: Boolean(iban),
  };
}

export function formatManualPaymentAmount(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  const normalizedCurrency = currency.toUpperCase();

  if (normalizedCurrency === "EUR") {
    return `€${amount.toFixed(2)}`;
  }

  if (normalizedCurrency === "CZK") {
    return `${amount.toFixed(2)} Kč`;
  }

  return `${amount.toFixed(2)} ${normalizedCurrency}`;
}

export function createManualQrPaymentMessage(orderId: string, kind: ManualQrCheckoutKind) {
  const prefix = kind === "credit_topup" ? "ARTales kredit" : "ARTales podpora";
  return `${prefix} ${shortOrderCode(orderId)}`;
}

export function createQrPaymentPayload(params: {
  amountCents: number;
  currency: string;
  variableSymbol: string;
  message: string;
}) {
  const config = getManualQrPaymentConfig();
  if (!config.iban) return null;

  const account = config.bic ? `${config.iban}+${config.bic}` : config.iban;

  return [
    "SPD",
    "1.0",
    `ACC:${account}`,
    `AM:${formatAmountForQr(params.amountCents)}`,
    `CC:${params.currency.toUpperCase()}`,
    `X-VS:${params.variableSymbol}`,
    `MSG:${sanitizeSpdValue(params.message)}`,
  ].join("*");
}

export async function createManualQrOrder(params: {
  kind: ManualQrCheckoutKind;
  packageCode: string;
  billingCountry: string;
}) {
  const kind = normalizeCheckoutKind(params.kind);
  const packageCode = normalizePackageCode(params.packageCode);
  const billingCountry = normalizeCountry(params.billingCountry);

  if (!kind) return { ok: false as const, reason: "invalid_kind" };
  if (!billingCountry) return { ok: false as const, reason: "unsupported_country" };

  const selectedPackage = getPackage(kind, packageCode);
  if (!selectedPackage || selectedPackage.amountCents <= 0) {
    return { ok: false as const, reason: "invalid_package" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, reason: "not_authenticated" };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: intent, error: intentError } = await admin
    .from("purchase_intents")
    .insert({
      user_id: user.id,
      product_id: null,
      work_id: null,
      status: "captured",
      source_context: kind === "credit_topup" ? "manual_qr_credit_topup" : "manual_qr_support",
      user_role: profile?.role ? String(profile.role) : null,
      metadata: {
        checkout_method: "manual_qr",
        checkout_kind: kind,
        package_code: selectedPackage.code,
        amount_cents: selectedPackage.amountCents,
        credit_amount: selectedPackage.creditAmount ?? null,
        currency: MANUAL_QR_CURRENCY,
        billing_country: billingCountry,
      },
    })
    .select("id")
    .single();

  if (intentError || !intent) {
    console.error("Manual QR purchase intent creation failed:", intentError);
    return { ok: false as const, reason: "intent_failed" };
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      status: "pending_payment",
      payment_status: "pending",
      currency: MANUAL_QR_CURRENCY,
      subtotal_amount_cents: selectedPackage.amountCents,
      discount_amount_cents: 0,
      total_amount_cents: selectedPackage.amountCents,
      provider: "manual_qr",
      provider_session_id: String(intent.id),
      metadata: {
        checkout_method: "manual_qr",
        checkout_kind: kind,
        purchase_intent_id: String(intent.id),
        package_code: selectedPackage.code,
        credit_amount: selectedPackage.creditAmount ?? null,
        billing_country: billingCountry,
        tax_scope: "eu_oss_launch_only",
      },
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Manual QR order creation failed:", orderError);
    return { ok: false as const, reason: "order_failed" };
  }

  const orderId = String(order.id);
  const variableSymbol = createNumericReference(orderId);
  const paymentMessage = createManualQrPaymentMessage(orderId, kind);
  const title = kind === "credit_topup"
    ? `Dobití kreditu ARTales · ${selectedPackage.creditAmount ?? selectedPackage.amountCents / 100} kreditů`
    : `Podpora ARTales · ${selectedPackage.title}`;

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: orderId,
    product_id: null,
    work_id: null,
    product_type: kind,
    title,
    quantity: 1,
    unit_amount_cents: selectedPackage.amountCents,
    total_amount_cents: selectedPackage.amountCents,
    currency: MANUAL_QR_CURRENCY,
    entitlement_type: null,
    fulfillment_status: kind === "credit_topup" ? "manual_required" : "not_ready",
    metadata: {
      checkout_method: "manual_qr",
      checkout_kind: kind,
      package_code: selectedPackage.code,
      credit_amount: selectedPackage.creditAmount ?? null,
      billing_country: billingCountry,
      fulfillment_kind: kind === "credit_topup" ? "credit_topup" : "none",
    },
  });

  if (itemError) {
    console.error("Manual QR order item creation failed:", itemError);
    return { ok: false as const, reason: "item_failed" };
  }

  await Promise.all([
    admin
      .from("orders")
      .update({
        metadata: {
          checkout_method: "manual_qr",
          checkout_kind: kind,
          purchase_intent_id: String(intent.id),
          package_code: selectedPackage.code,
          credit_amount: selectedPackage.creditAmount ?? null,
          billing_country: billingCountry,
          tax_scope: "eu_oss_launch_only",
          manual_qr_reference: variableSymbol,
          manual_qr_message: paymentMessage,
        },
      })
      .eq("id", orderId),
    admin
      .from("purchase_intents")
      .update({
        status: "converted",
        metadata: {
          checkout_method: "manual_qr",
          checkout_kind: kind,
          package_code: selectedPackage.code,
          amount_cents: selectedPackage.amountCents,
          credit_amount: selectedPackage.creditAmount ?? null,
          currency: MANUAL_QR_CURRENCY,
          billing_country: billingCountry,
          order_id: orderId,
        },
      })
      .eq("id", String(intent.id)),
  ]);

  return { ok: true as const, orderId };
}

export async function getManualQrOrderSummary(userId: string, orderId: string): Promise<ManualQrOrderSummary | null> {
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status, payment_status, total_amount_cents, currency, metadata, created_at")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    console.error("Manual QR order summary load failed:", orderError);
    return null;
  }

  if (!order) return null;

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("title, product_type, fulfillment_status")
    .eq("order_id", orderId)
    .limit(1);

  if (itemsError) console.error("Manual QR order item summary load failed:", itemsError);

  const typedOrder = order as OrderRow;
  const firstItem = items?.[0] as OrderItemRow | undefined;
  const metadata = (typedOrder.metadata ?? {}) as OrderMetadata;
  const kind = metadata.manual_qr_kind === "support" ? "support" : "credit_topup";
  const variableSymbol = metadata.manual_qr_reference ?? createNumericReference(String(typedOrder.id));
  const paymentMessage = metadata.manual_qr_message ?? createManualQrPaymentMessage(String(typedOrder.id), kind);
  const currency = String(typedOrder.currency ?? MANUAL_QR_CURRENCY);
  const amountCents = Number(typedOrder.total_amount_cents ?? 0);

  return {
    id: String(typedOrder.id),
    status: String(typedOrder.status ?? "pending_payment"),
    paymentStatus: String(typedOrder.payment_status ?? "pending"),
    totalAmountCents: amountCents,
    currency,
    variableSymbol,
    paymentMessage,
    createdAt: String(typedOrder.created_at),
    kind,
    billingCountry: metadata.billing_country ?? null,
    qrPayload: createQrPaymentPayload({
      amountCents,
      currency,
      variableSymbol,
      message: paymentMessage,
    }),
    qrImageUrl: `/api/payments/qr/${encodeURIComponent(String(typedOrder.id))}`,
    item: firstItem
      ? {
          title: firstItem.title ?? "ARTales platba",
          productType: firstItem.product_type ?? kind,
          fulfillmentStatus: firstItem.fulfillment_status ?? "not_ready",
        }
      : null,
  };
}
