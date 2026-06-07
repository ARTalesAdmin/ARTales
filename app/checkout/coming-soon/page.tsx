import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";

export const dynamic = "force-dynamic";

export default function CheckoutComingSoonPage() {
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
          You can still read previews, use your welcome unlock, access titles already in your library, or return to the membership overview.
        </p>
        <div className="artales-checkout-coming-soon__status">
          <span>Products prepared</span>
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
