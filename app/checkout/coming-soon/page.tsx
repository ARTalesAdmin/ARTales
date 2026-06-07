import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { createPurchaseIntent } from "@/lib/purchases";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ product?: string; work?: string }>;
};

export default async function CheckoutComingSoonPage({ searchParams }: PageProps) {
  const params = await searchParams;
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
        <p className="artales-product-panel__eyebrow">ARTales checkout</p>
        <h1>Checkout is not enabled yet</h1>
        <p>
          This product and access model is already prepared in ARTales, but real payments are still disabled while the launch setup is being finalized.
        </p>
        <p>
          Your interest has been recorded anonymously or with your reader account if you are signed in. This helps us decide what to launch first.
        </p>
        <div className="artales-checkout-coming-soon__status">
          <span>Products prepared</span>
          <span>Purchase interest captured</span>
          <span>Payments pending</span>
          <span>Reader entitlements active</span>
        </div>
        <div className="artales-account-actions">
          <Link className="artales-button" href="/gallery">
            Back to gallery
          </Link>
          <Link className="artales-button-secondary" href="/account/library">
            My library
          </Link>
          <Link className="artales-button-secondary" href="/account/membership">
            Membership options
          </Link>
        </div>
      </main>
    </div>
  );
}
