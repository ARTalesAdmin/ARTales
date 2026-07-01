import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getShortDisplayName } from "@/lib/displayName";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { getReaderLibrarySummary } from "@/lib/entitlements";
import { logoutFromAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await requireCompletedAccountProfile("/account");
  const [summary, cookieLocale] = await Promise.all([
    getReaderLibrarySummary(profile.id),
    getCookieLocale(),
  ]);
  const shortName = getShortDisplayName(profile);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.overview;

  return (
    <section className="artales-account-page artales-account-overview-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>
        {dictionary.titlePrefix}, {shortName}
      </h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      <form action={logoutFromAccount} className="artales-account-logout">
        <button type="submit" className="artales-button-secondary">
          {dictionary.signOut}
        </button>
      </form>

      <section className="artales-account-overview-hero">
        <div>
          <p className="artales-account-card__label">
            {dictionary.primaryLabel}
          </p>
          <h2>{dictionary.primaryTitle}</h2>
          <p>{dictionary.primaryText}</p>
          <div className="artales-account-actions artales-account-actions--inline">
            <Link className="artales-button" href="/account/library">
              {dictionary.libraryCta}
            </Link>
            <Link className="artales-button-secondary" href="/gallery">
              {dictionary.browseCta}
            </Link>
          </div>
        </div>
        <div
          className="artales-account-overview-hero__stats"
          aria-label={dictionary.quickStatsLabel}
        >
          <article>
            <span>{dictionary.onlineCountLabel}</span>
            <strong>{summary.onlineEntitlements}</strong>
          </article>
          <article>
            <span>{dictionary.savedCountLabel}</span>
            <strong>{summary.savedItems}</strong>
          </article>
          <article>
            <span>{dictionary.creditCountLabel}</span>
            <strong>{summary.atCreditBalance}</strong>
          </article>
        </div>
      </section>

      <div className="artales-account-grid artales-account-grid--focused">
        <article className="artales-account-card">
          <p className="artales-account-card__label">
            {dictionary.creditsLabel}
          </p>
          <h2>{dictionary.creditsTitle}</h2>
          <p>{dictionary.creditsText}</p>
          <div className="artales-account-card__links">
            <Link href="/account/credits">{dictionary.creditsCta}</Link>
            <Link href="/checkout/credits">{dictionary.topUpCta}</Link>
          </div>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">
            {dictionary.supportLabel}
          </p>
          <h2>{dictionary.supportTitle}</h2>
          <p>{dictionary.supportText}</p>
          <Link href="/checkout/support">{dictionary.supportCta}</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">
            {dictionary.settingsLabel}
          </p>
          <h2>{dictionary.settingsTitle}</h2>
          <p>{dictionary.settingsText}</p>
          <Link href="/account/settings">{dictionary.settingsCta}</Link>
        </article>

        <article className="artales-account-card artales-account-card--quiet">
          <p className="artales-account-card__label">
            {dictionary.profileLabel}
          </p>
          <h2>@{profile.handle}</h2>
          <p>{dictionary.profileText}</p>
          <div className="artales-account-card__links">
            <Link href="/account/profile">{dictionary.profileCta}</Link>
            <Link href="/account/security">{dictionary.securityCta}</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
