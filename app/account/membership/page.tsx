import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";

const tiers = [
  {
    name: "Free Reader",
    price: "€0",
    text: "Reader account, synced profile tools and one future welcome title.",
  },
  {
    name: "Basic",
    price: "€1 / month",
    text: "2 permanent online unlocks each month and member prices.",
  },
  {
    name: "Plus",
    price: "€2 / month",
    text: "5 permanent online unlocks, 1 AT Credit and better member prices.",
  },
  {
    name: "Library",
    price: "€4 / month",
    text: "Unlimited online reading while active, 2 AT Credits and best prices.",
  },
];

export const dynamic = "force-dynamic";

export default async function AccountMembershipPage() {
  const profile = await requireCompletedAccountProfile("/account/membership");

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">Membership</p>
      <h1>ARTales membership preview</h1>
      <p className="artales-account-lede">
        You are currently on the <strong>Free Reader</strong> account layer. Paid memberships, AT Credits and product access will be activated in the commerce patch.
      </p>

      <div className="artales-account-tier-grid">
        {tiers.map((tier) => (
          <article key={tier.name} className="artales-account-card">
            <p className="artales-account-card__label">{tier.name}</p>
            <h2>{tier.price}</h2>
            <p>{tier.text}</p>
            {tier.name === "Plus" ? <span className="artales-account-badge">Best value</span> : null}
            {tier.name === "Library" ? <span className="artales-account-badge">Active full access</span> : null}
          </article>
        ))}
      </div>

      <section className="artales-account-panel">
        <h2>What this means now</h2>
        <p>
          Account identity is active for <strong>{profile.email}</strong>. Payments, subscription tiers, permanent unlocks and AT Credits are planned for v0.9.
        </p>
        <p>
          Until then, guest access remains preview-only and registered readers can use profile-backed reader/account tools as they are connected.
        </p>
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">Explore works</Link>
        <Link className="artales-button-secondary" href="/account/settings">Reader settings</Link>
      </div>
    </section>
  );
}
