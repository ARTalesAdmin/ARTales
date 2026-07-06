import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { MEMBERSHIP_PRICEBOOK, formatAt } from "@/lib/memberPricebook";

export const dynamic = "force-dynamic";

type MembershipTierDictionary = {
  name: string;
  description: string;
  badge?: string;
  unlocks: string;
  credits: string;
  prices: string;
};

const tierOrder = ["free_reader", "basic", "plus", "library"] as const;

export default async function AccountMembershipPage() {
  const profile = await requireCompletedAccountProfile("/account/membership");
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.membership;
  const tierCopy = dictionary.tiers as Record<string, MembershipTierDictionary>;
  const isCs = locale === "cs";

  return (
    <section className="artales-account-page artales-account-membership-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">
        {dictionary.ledePrefix} <strong>{dictionary.freeReader}</strong>. {dictionary.ledeSuffix}
      </p>

      <section className="artales-account-promo-panel artales-account-membership-hero">
        <div>
          <p className="artales-account-card__label">{dictionary.creditModelLabel}</p>
          <h2>{dictionary.creditModelTitle}</h2>
          <p>{dictionary.creditModelText}</p>
          <p className="artales-account-muted">{dictionary.paymentNotice}</p>
        </div>
        <div className="artales-account-membership-price-strip" aria-label={dictionary.creditModelLabel}>
          <span>{formatAt(MEMBERSHIP_PRICEBOOK.tiers.basic.foundingAt, locale)}</span>
          <span>{formatAt(MEMBERSHIP_PRICEBOOK.tiers.plus.foundingAt, locale)}</span>
          <span>{formatAt(MEMBERSHIP_PRICEBOOK.tiers.library.foundingAt, locale)}</span>
        </div>
      </section>

      <div className="artales-account-tier-grid artales-account-membership-grid">
        {tierOrder.map((tierCode) => {
          const tier = MEMBERSHIP_PRICEBOOK.tiers[tierCode];
          const copy = tierCopy[tierCode];
          const priceLine = tierCode === "free_reader"
            ? formatAt(0, locale)
            : `${formatAt(tier.foundingAt, locale)} / ${dictionary.period}`;
          const standardLine = tierCode === "free_reader"
            ? dictionary.noStandardPrice
            : `${dictionary.standardPrice}: ${formatAt(tier.standardAt, locale)} / ${dictionary.period}`;

          return (
            <article key={tierCode} className="artales-account-card artales-account-tier-card">
              <div className="artales-account-tier-card__topline">
                <p className="artales-account-card__label">{copy.name}</p>
                {copy.badge ? <span className="artales-account-badge">{copy.badge}</span> : null}
              </div>
              <h2>{priceLine}</h2>
              <p className="artales-account-muted">{standardLine}</p>
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
        <p className="artales-account-card__label">{dictionary.valueLabel}</p>
        <h2>{dictionary.valueTitle}</h2>
        <div className="artales-account-model-grid">
          {dictionary.valuePoints.map((point) => (
            <article key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="artales-account-panel artales-community-section">
        <p className="artales-account-card__label">{dictionary.pricebookLabel}</p>
        <h2>{dictionary.pricebookTitle}</h2>
        <div className="artales-account-model-grid">
          {dictionary.pricebookPoints.map((point) => (
            <article key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="artales-account-panel artales-community-section">
        <p className="artales-account-card__label">{dictionary.patronageLabel}</p>
        <h2>{dictionary.patronageTitle}</h2>
        <p>{dictionary.patronageText}</p>
        <div className="artales-account-model-grid">
          <article>
            <h3>{isCs ? "Patron ARTales" : "ARTales Patron"}</h3>
            <p>{dictionary.patronText}</p>
          </article>
          <article>
            <h3>{isCs ? "Mecenáš ARTales" : "ARTales Benefactor"}</h3>
            <p>{dictionary.mecenatText}</p>
          </article>
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
        <Link className="artales-button" href="/checkout/credits">{dictionary.topUpCredits}</Link>
        <Link className="artales-button-secondary" href="/credits">{dictionary.creditInfo}</Link>
        <Link className="artales-button-secondary" href="/hall">{dictionary.openHall}</Link>
        <Link className="artales-button-secondary" href="/account/library">{dictionary.openLibrary}</Link>
      </div>
    </section>
  );
}
