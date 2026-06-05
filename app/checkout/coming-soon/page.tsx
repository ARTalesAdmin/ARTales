import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";

export const dynamic = "force-dynamic";

export default function CheckoutComingSoonPage() {
  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon">
        <p className="artales-product-panel__eyebrow">ARTales checkout</p>
        <h1>Payments are coming soon</h1>
        <p>
          Product and access options are now being prepared in ARTales, but real checkout is not enabled yet. You can still use welcome unlocks or admin-granted access while the payment layer is being built.
        </p>
        <div className="artales-account-actions">
          <Link className="artales-button" href="/gallery">
            Back to gallery
          </Link>
          <Link className="artales-button-secondary" href="/account/membership">
            View membership options
          </Link>
        </div>
      </main>
    </div>
  );
}
