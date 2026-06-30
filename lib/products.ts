import { createClient } from "@/lib/supabase/server";
import type { MembershipTierCode } from "@/lib/membership";

export type ProductType =
  | "online_unlock"
  | "pdf_download"
  | "epub_download"
  | "pdf_epub_bundle"
  | "print";

export type ProductPriceContext =
  | "standard"
  | "reader"
  | "basic"
  | "plus"
  | "library"
  | "launch";

export type ProductAvailability = "available" | "coming_soon" | "internal_only";

export type WorkProductPrice = {
  id: string;
  context: ProductPriceContext;
  amountCents: number;
  currency: string;
  isIntro: boolean;
  label: string;
  membershipCode: MembershipTierCode | null;
};

export type WorkProductOffer = {
  id: string;
  workId: string;
  type: ProductType;
  title: string;
  description: string;
  availability: ProductAvailability;
  checkoutEnabled: boolean;
  fulfillmentReady: boolean;
  displayOrder: number;
  entitlementType: "online_read" | "pdf_download" | "epub_download" | "print_discount" | null;
  prices: WorkProductPrice[];
};

type RawProductPrice = {
  id: unknown;
  price_context: unknown;
  amount_cents: unknown;
  currency: unknown;
  is_intro: unknown;
  label: unknown;
  membership_code: unknown;
  is_active?: unknown;
  display_order?: unknown;
};

type RawProductRow = {
  id: unknown;
  work_id: unknown;
  product_type: unknown;
  title: unknown;
  description: unknown;
  availability: unknown;
  checkout_enabled: unknown;
  fulfillment_ready: unknown;
  display_order: unknown;
  entitlement_type: unknown;
  product_prices?: RawProductPrice[] | RawProductPrice | null;
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  online_unlock: "Online unlock",
  pdf_download: "PDF",
  epub_download: "EPUB",
  pdf_epub_bundle: "PDF + EPUB bundle",
  print: "Print edition",
};

export const DEFAULT_PRODUCT_COPY: Record<ProductType, { title: string; description: string }> = {
  online_unlock: {
    title: "Online unlock",
    description: "Permanent online reading access in your ARTales library.",
  },
  pdf_download: {
    title: "PDF edition",
    description: "Downloadable PDF edition. Delivery will be enabled after PDF export is ready.",
  },
  epub_download: {
    title: "EPUB edition",
    description: "Downloadable EPUB edition for e-readers. Coming after export tooling is ready.",
  },
  pdf_epub_bundle: {
    title: "PDF + EPUB bundle",
    description: "Combined digital edition package for readers who want both formats.",
  },
  print: {
    title: "Print edition",
    description: "Printed edition placeholder. Pricing will vary by title and print setup.",
  },
};

export function formatProductPrice(
  price: WorkProductPrice | null | undefined,
  fallbackLabel = "Coming soon"
) {
  if (!price) return fallbackLabel;

  const amount = price.amountCents / 100;

  if (price.currency.toUpperCase() === "EUR") {
    return `€${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
  }

  return `${amount.toFixed(2)} ${price.currency.toUpperCase()}`;
}

export function getPrimaryProductPrice(product: WorkProductOffer) {
  return (
    product.prices.find((price) => price.context === "standard") ??
    product.prices.find((price) => price.context === "reader") ??
    product.prices[0] ??
    null
  );
}

export function getProductAccessNote(product: WorkProductOffer) {
  if (product.availability === "internal_only") {
    return "Internal access only.";
  }

  if (!product.fulfillmentReady) {
    return "Fulfilment coming soon.";
  }

  if (!product.checkoutEnabled) {
    return "Checkout coming soon.";
  }

  return "Ready for checkout.";
}

function asPriceArray(value: RawProductRow["product_prices"]): RawProductPrice[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeProductType(value: unknown): ProductType | null {
  const stringValue = String(value ?? "");
  if (
    stringValue === "online_unlock" ||
    stringValue === "pdf_download" ||
    stringValue === "epub_download" ||
    stringValue === "pdf_epub_bundle" ||
    stringValue === "print"
  ) {
    return stringValue;
  }

  return null;
}

function normalizeAvailability(value: unknown): ProductAvailability {
  const stringValue = String(value ?? "coming_soon");
  if (stringValue === "available" || stringValue === "internal_only") return stringValue;
  return "coming_soon";
}

function normalizePriceContext(value: unknown): ProductPriceContext {
  const stringValue = String(value ?? "standard");
  if (
    stringValue === "standard" ||
    stringValue === "reader" ||
    stringValue === "basic" ||
    stringValue === "plus" ||
    stringValue === "library" ||
    stringValue === "launch"
  ) {
    return stringValue;
  }

  return "standard";
}

function normalizeMembershipCode(value: unknown): MembershipTierCode | null {
  const stringValue = String(value ?? "");
  if (
    stringValue === "free_reader" ||
    stringValue === "basic" ||
    stringValue === "plus" ||
    stringValue === "library"
  ) {
    return stringValue;
  }

  return null;
}

function normalizeProduct(row: RawProductRow): WorkProductOffer | null {
  const type = normalizeProductType(row.product_type);
  if (!type) return null;

  return {
    id: String(row.id),
    workId: String(row.work_id),
    type,
    title: String(row.title || DEFAULT_PRODUCT_COPY[type].title),
    description: String(row.description || DEFAULT_PRODUCT_COPY[type].description),
    availability: normalizeAvailability(row.availability),
    checkoutEnabled: Boolean(row.checkout_enabled),
    fulfillmentReady: Boolean(row.fulfillment_ready),
    displayOrder: Number(row.display_order ?? 100),
    entitlementType: row.entitlement_type == null ? null : (String(row.entitlement_type) as WorkProductOffer["entitlementType"]),
    prices: asPriceArray(row.product_prices)
      .map((price) => ({
        id: String(price.id),
        context: normalizePriceContext(price.price_context),
        amountCents: Number(price.amount_cents ?? 0),
        currency: String(price.currency ?? "EUR"),
        isIntro: Boolean(price.is_intro),
        label: String(price.label ?? "Standard"),
        membershipCode: normalizeMembershipCode(price.membership_code),
      }))
      .sort((a, b) => a.amountCents - b.amountCents),
  };
}

export async function getWorkProductOffers(workId: string): Promise<WorkProductOffer[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      work_id,
      product_type,
      title,
      description,
      availability,
      checkout_enabled,
      fulfillment_ready,
      display_order,
      entitlement_type,
      product_prices (
        id,
        price_context,
        amount_cents,
        currency,
        is_intro,
        label,
        membership_code,
        is_active,
        display_order
      )
    `)
    .eq("work_id", workId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Work product catalogue load failed:", error);
    return [];
  }

  const rawRows = (data ?? []) as unknown[];

  return rawRows
    .map((row: unknown) => normalizeProduct(row as RawProductRow))
    .filter((product): product is WorkProductOffer => Boolean(product))
    .map((product: WorkProductOffer) => ({
      ...product,
      prices: product.prices.filter((price: WorkProductPrice) => price.amountCents >= 0),
    }));
}
