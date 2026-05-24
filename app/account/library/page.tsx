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
        This is the reader-side home for saved works, reading history, online unlocks and future downloads.
        In this stabilization patch it stays mostly structural, so commerce and entitlements can be added cleanly later.
      </p>

      <div className="artales-account-grid">
        <article className="artales-account-card">
          <p className="artales-account-card__label">Saved works</p>
          <h2>Browser saves now, account sync later</h2>
          <p>
            Current save-for-later behavior is still local to the browser. The next account layer should sync saved works
            to the user profile and make them visible across devices.
          </p>
          <p className="artales-account-muted">Source now: localStorage · Target later: database table</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Recently read</p>
          <h2>Reading continuity</h2>
          <p>
            Reader progress and bookmarks already exist as reader UX primitives. This page reserves their account-level overview.
          </p>
          <p className="artales-account-muted">Prepared for synchronized progress and device handoff.</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Unlocked titles</p>
          <h2>Entitlements</h2>
          <p>
            Welcome titles, monthly unlocks, purchased online reading access and Library-tier access will appear here after v0.9.
          </p>
          <p className="artales-account-muted">No payment or entitlement logic is active in this patch.</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Downloads</p>
          <h2>PDF / EPUB</h2>
          <p>
            Purchased downloads and future AT Credit redemptions will be connected after the commerce model is implemented.
          </p>
          <p className="artales-account-muted">Prepared for PDF, EPUB and future print orders.</p>
        </article>
      </div>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">Browse gallery</Link>
        <Link className="artales-button-secondary" href="/account/membership">View membership plan</Link>
      </div>
    </section>
  );
}
