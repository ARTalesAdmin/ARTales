import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { createPurchaseIntent } from "@/lib/purchases";
import { getCookieLocale } from "@/lib/i18n/server";
import { getPublicDictionary } from "@/lib/i18n/public";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ product?: string; work?: string }>;
};

export default async function CheckoutComingSoonPage({ searchParams }: PageProps) {
  const [params, locale] = await Promise.all([searchParams, getCookieLocale()]);
  const { public: t } = getPublicDictionary(locale);
  const productId = params?.product ?? null;
  const workId = params?.work ?? null;

  if (productId || workId) {
    await createPurchaseIntent({
      productId,
      workId,
      sourceContext: "checkout_coming_soon",
      metadata: { route: "/checkout/coming-soon" },
    });
  }

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon">
        <p className="artales-product-panel__eyebrow">{t.checkoutEyebrow}</p>
        <h1>{t.checkoutComingSoonTitle}</h1>
        <p>{t.checkoutComingSoonText}</p>
        <p>{t.checkoutInterestText}</p>
        <div className="artales-checkout-coming-soon__status">
          <span>{t.checkoutProductsPrepared}</span>
          <span>{t.checkoutInterestCaptured}</span>
          <span>{t.checkoutPaymentsPending}</span>
          <span>{t.checkoutEntitlementsActive}</span>
        </div>
        <div className="artales-account-actions">
          <Link className="artales-button" href="/gallery">
            {t.backToGallery}
          </Link>
          <Link className="artales-button-secondary" href="/account/library">
            {t.myLibrary}
          </Link>
          <Link className="artales-button-secondary" href="/account/membership">
            {t.membershipOptions}
          </Link>
        </div>
      </main>
    </div>
  );
}
