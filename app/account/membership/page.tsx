import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { MEMBERSHIP_TIERS, formatEuro } from "@/lib/membership";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type MembershipTierDictionary = {
  name: string;
  description: string;
  badge?: string;
  unlocks: string;
  credits: string;
  prices: string;
};

export default async function AccountMembershipPage() {
  const profile = await requireCompletedAccountProfile("/account/membership");
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.membership;
  const tierCopy = dictionary.tiers as Record<string, MembershipTierDictionary>;

  return (
    <section className="artales-account-page artales-account-membership-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">
        {dictionary.ledePrefix} <strong>{dictionary.freeReader}</strong>. {dictionary.ledeSuffix}
      </p>

      <section className="artales-account-promo-panel artales-account-membership-hero">
        <div>
          <p className="artales-account-card__label">{dictionary.launchOfferLabel}</p>
          <h2>{dictionary.launchOfferTitle}</h2>
          <p>{dictionary.launchOfferText}</p>
          <p className="artales-account-muted">{dictionary.paymentNotice}</p>
        </div>
        <div className="artales-account-membership-price-strip" aria-label={dictionary.launchOfferLabel}>
          <span>€1</span>
          <span>€2</span>
          <span>€4</span>
        </div>
      </section>

      <div className="artales-account-tier-grid artales-account-membership-grid">
        {MEMBERSHIP_TIERS.map((tier) => {
          const copy = tierCopy[tier.code];
          return (
            <article key={tier.code} className="artales-account-card artales-account-tier-card">
              <div className="artales-account-tier-card__topline">
                <p className="artales-account-card__label">{copy.name}</p>
                {copy.badge ? <span className="artales-account-badge">{copy.badge}</span> : null}
              </div>
              <h2>{formatEuro(tier.introPrice)} <span>{dictionary.perMonth}</span></h2>
              {tier.futurePrice > tier.introPrice ? (
                <p className="artales-account-muted">
                  {dictionary.laterPrice}: {formatEuro(tier.futurePrice)} {dictionary.perMonth}
                </p>
              ) : (
                <p className="artales-account-muted">{dictionary.freeLayer}</p>
              )}
              <p>{copy.description}</p>
              <ul className="artales-account-feature-list">
                <li>{copy.unlocks}</li>
                <li>{copy.credits}</li>
                <li>{copy.prices}</li>
              </ul>
            </article>
          );
        })}
      </div>

      <section className="artales-account-panel artales-community-section">
        <p className="artales-account-card__label">{dictionary.modelLabel}</p>
        <h2>{dictionary.modelTitle}</h2>
        <div className="artales-account-model-grid">
          {dictionary.modelPoints.map((point) => (
            <article key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="artales-account-panel artales-community-section">
        <p className="artales-account-card__label">{dictionary.currentStateLabel}</p>
        <h2>{dictionary.currentStateTitle}</h2>
        <p>
          {dictionary.identityPrefix} <strong>{profile.email}</strong>. {dictionary.identitySuffix}
        </p>
        <p>{dictionary.paymentsDisabled}</p>
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">{dictionary.exploreWorks}</Link>
        <Link className="artales-button-secondary" href="/account/library">{dictionary.openLibrary}</Link>
      </div>
    </section>
  );
}
