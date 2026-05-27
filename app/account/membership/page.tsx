import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import {
  INTRO_PROMO_COPY,
  MEMBERSHIP_TIERS,
  formatEuro,
  getUnlockLabel,
} from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function AccountMembershipPage() {
  const profile = await requireCompletedAccountProfile("/account/membership");

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">Membership</p>
      <h1>ARTales membership</h1>
      <p className="artales-account-lede">
        You are currently on the <strong>Free Reader</strong> account layer. v0.9 starts the entitlement foundation: online unlocks, reader library and AT Credits are prepared before payments go live.
      </p>

      <section className="artales-account-promo-panel">
        <p className="artales-account-card__label">Launch offer</p>
        <h2>First 3 months / first 100 readers</h2>
        <p>
          Introductory membership prices are planned as <strong>€1 / €2 / €4</strong> for Basic, Plus and Library. Later standard pricing is planned as <strong>€2 / €4 / €7</strong>.
        </p>
        <p className="artales-account-muted">
          {INTRO_PROMO_COPY} Payment activation is not part of this patch yet; this page prepares the public/account copy and pricing logic.
        </p>
      </section>

      <div className="artales-account-tier-grid">
        {MEMBERSHIP_TIERS.map((tier) => (
          <article key={tier.code} className="artales-account-card artales-account-tier-card">
            <div className="artales-account-tier-card__topline">
              <p className="artales-account-card__label">{tier.name}</p>
              {tier.badge ? <span className="artales-account-badge">{tier.badge}</span> : null}
            </div>
            <h2>{formatEuro(tier.introPrice)} <span>/ month</span></h2>
            {tier.futurePrice > tier.introPrice ? (
              <p className="artales-account-muted">
                Later planned price: {formatEuro(tier.futurePrice)} / month
              </p>
            ) : (
              <p className="artales-account-muted">Free account layer.</p>
            )}
            <p>{tier.description}</p>
            <ul className="artales-account-feature-list">
              <li>{getUnlockLabel(tier.monthlyOnlineUnlocks)}</li>
              <li>{tier.monthlyAtCredits} AT Credits / month</li>
              <li>{tier.code === "library" ? "Best member prices" : tier.code === "free_reader" ? "Reader tools and settings" : "Member prices"}</li>
            </ul>
          </article>
        ))}
      </div>

      <section className="artales-account-panel">
        <h2>What this means now</h2>
        <p>
          Account identity is active for <strong>{profile.email}</strong>. The v0.9 entitlement layer creates the structure for online reading access, future PDF/EPUB products, subscription benefits and AT Credits.
        </p>
        <p>
          Payments are still disabled. Until product/payment activation, access can be granted only by system logic or later by admin/manual tools.
        </p>
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">Explore works</Link>
        <Link className="artales-button-secondary" href="/account/library">Open my library</Link>
      </div>
    </section>
  );
}
