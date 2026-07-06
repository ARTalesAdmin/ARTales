import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { MEMBERSHIP_PRICEBOOK, formatAt } from "@/lib/memberPricebook";
import { normalizeRole } from "@/lib/permissions";
import { activateMembership } from "./actions";
import { getReaderMembershipStatus } from "@/lib/readerMembership";

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

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string; tier?: string }>;
};

function formatMembershipDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getMembershipNotice(
  params: { error?: string; success?: string; tier?: string },
  dictionary: ReturnType<typeof getPublicDictionary>["account"]["membership"],
) {
  if (params.success === "membership_activated") return { kind: "success", text: dictionary.activationSuccess };
  if (params.error === "not_enough_credit") return { kind: "error", text: dictionary.activationNotEnoughCredit };
  if (params.error === "other_membership_active") return { kind: "error", text: dictionary.activationOtherActive };
  if (params.error) return { kind: "error", text: dictionary.activationError };
  return null;
}

export default async function AccountMembershipPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/membership");
  const [cookieLocale, membershipStatus] = await Promise.all([
    getCookieLocale(),
    getReaderMembershipStatus(profile.id),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.membership;
  const tierCopy = dictionary.tiers as Record<string, MembershipTierDictionary>;
  const role = normalizeRole(profile.role);
  const isInternalRole = role === "admin" || role === "editor" || role === "member";
  const readerLayerLabel = isInternalRole ? dictionary.internalReaderLayer : dictionary.freeReader;
  const ledeSuffix = isInternalRole ? dictionary.internalLedeSuffix : dictionary.ledeSuffix;
  const isCs = locale === "cs";
  const params = (await searchParams) ?? {};
  const notice = getMembershipNotice(params, dictionary);
  const activeUntil = formatMembershipDate(membershipStatus.activeExpiresAt, locale);

  return (
    <section className="artales-account-page artales-account-membership-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">
        {dictionary.ledePrefix} <strong>{readerLayerLabel}</strong>. {ledeSuffix}
      </p>

      {notice ? (
        <div className={notice.kind === "success" ? "artales-account-notice artales-account-notice--success" : "artales-account-notice artales-account-notice--error"}>
          {notice.text}
        </div>
      ) : null}

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
              <h2 className="artales-account-tier-card__price">{priceLine}</h2>
              <p className="artales-account-muted artales-account-tier-card__standard">{standardLine}</p>
              <p>{copy.description}</p>
              <ul className="artales-account-feature-list">
                <li>{copy.unlocks}</li>
                <li>{copy.credits}</li>
                <li>{copy.prices}</li>
              </ul>
              {tierCode === "free_reader" ? null : (
                <form action={activateMembership} className="artales-membership-activation-form">
                  <input type="hidden" name="tier" value={tierCode} />
                  <button
                    className="artales-button"
                    type="submit"
                    disabled={membershipStatus.creditBalance < tier.foundingAt}
                  >
                    {dictionary.activateCta}
                  </button>
                  <p className="artales-account-muted">
                    {membershipStatus.creditBalance < tier.foundingAt
                      ? dictionary.notEnoughCreditHint
                      : dictionary.activationHint}
                  </p>
                </form>
              )}
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

      <section className="artales-account-panel artales-community-section artales-account-membership-note">
        <p className="artales-account-card__label">{dictionary.currentStateLabel}</p>
        <h2>{dictionary.currentStateTitle}</h2>
        <p>
          {dictionary.identityPrefix} <strong>{profile.email}</strong>. {dictionary.identitySuffix}
        </p>
        <div className="artales-membership-status-grid">
          <article>
            <p className="artales-account-card__label">{dictionary.currentMembershipLabel}</p>
            <h3>{membershipStatus.activeTierName ?? readerLayerLabel}</h3>
            <p>{activeUntil ? `${dictionary.activeUntilPrefix} ${activeUntil}` : dictionary.noActiveMembership}</p>
          </article>
          <article>
            <p className="artales-account-card__label">{dictionary.memberUnlockBalanceLabel}</p>
            <h3>{membershipStatus.memberUnlockBalance}</h3>
            <p>{dictionary.memberUnlockBalanceText}</p>
          </article>
          <article>
            <p className="artales-account-card__label">{dictionary.creditBalanceLabel}</p>
            <h3>{membershipStatus.creditBalance} AT</h3>
            <p>{dictionary.creditBalanceText}</p>
          </article>
        </div>
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
