import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function AccountLibraryPage() {
  await requireCompletedAccountProfile("/account/library");

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">My library</p>
      <h1>Your ARTales library</h1>
      <p className="artales-account-lede">
        This space will collect saved works, unlocked titles, purchased downloads and print orders.
      </p>

      <div className="artales-account-grid">
        <article className="artales-account-card">
          <p className="artales-account-card__label">Saved works</p>
          <h2>Coming next</h2>
          <p>Saved works currently live locally in your browser. The next commerce/account layer will sync them to your profile.</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Unlocked titles</p>
          <h2>Entitlements</h2>
          <p>Welcome titles, monthly unlocks and purchased online reading access will appear here.</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Downloads</p>
          <h2>PDF / EPUB</h2>
          <p>Purchased downloads and future AT Credit redemptions will be connected in the commerce patch.</p>
        </article>
      </div>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">Browse gallery</Link>
        <Link className="artales-button-secondary" href="/account/membership">View membership plan</Link>
      </div>
    </section>
  );
}
