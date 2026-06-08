import type { ProductType, WorkProductOffer } from "@/lib/products";

export type ProductSurfaceStatus =
  | "unlocked"
  | "available"
  | "preparing"
  | "coming_later"
  | "not_available";

export type ProductSurfaceItem = {
  key: ProductType;
  product: WorkProductOffer | null;
  status: ProductSurfaceStatus;
};

const DELIVERY_ORDER: ProductType[] = [
  "online_unlock",
  "pdf_download",
  "epub_download",
  "pdf_epub_bundle",
  "print",
];

export function getProductSurfaceStatus(
  product: WorkProductOffer | null | undefined,
  canReadFull: boolean
): ProductSurfaceStatus {
  if (!product) return "not_available";

  if (product.type === "online_unlock" && canReadFull) return "unlocked";

  if (product.availability !== "available") return "coming_later";

  if (!product.fulfillmentReady) return "preparing";

  if (!product.checkoutEnabled) return "coming_later";

  return "available";
}

export function getProductSurfaceItems(
  products: WorkProductOffer[],
  canReadFull: boolean
): ProductSurfaceItem[] {
  const productByType = new Map<ProductType, WorkProductOffer>();
  for (const product of products) {
    productByType.set(product.type, product);
  }

  return DELIVERY_ORDER
    .map((key) => {
      const product = productByType.get(key) ?? null;
      return {
        key,
        product,
        status: getProductSurfaceStatus(product, canReadFull),
      } satisfies ProductSurfaceItem;
    })
    .filter((item) => item.product || item.key !== "print");
}

export function isDownloadProduct(type: ProductType) {
  return type === "pdf_download" || type === "epub_download" || type === "pdf_epub_bundle";
}
