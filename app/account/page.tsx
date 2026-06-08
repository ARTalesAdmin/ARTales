import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getShortDisplayName } from "@/lib/displayName";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { logoutFromAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await requireCompletedAccountProfile("/account");
  const shortName = getShortDisplayName(profile);
  const cookieLocale = await getCookieLocale();
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.overview;

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.titlePrefix}, {shortName}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      <form action={logoutFromAccount} className="artales-account-logout">
        <button type="submit" className="artales-button-secondary">
          {dictionary.signOut}
        </button>
      </form>

      <div className="artales-account-grid">
        <article className="artales-account-card artales-account-card--featured">
          <p className="artales-account-card__label">{dictionary.currentRoleLabel}</p>
          <h2>{profile.role}</h2>
          <p>{dictionary.currentRoleText}</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.libraryLabel}</p>
          <h2>{dictionary.libraryTitle}</h2>
          <p>{dictionary.libraryText}</p>
          <Link href="/account/library">{dictionary.libraryCta}</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.profileLabel}</p>
          <h2>@{profile.handle}</h2>
          <p>{dictionary.profileText}</p>
          <Link href="/account/profile">{dictionary.profileCta}</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.securityLabel}</p>
          <h2>{dictionary.securityTitle}</h2>
          <p>{dictionary.securityText}</p>
          <Link href="/account/security">{dictionary.securityCta}</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.settingsLabel}</p>
          <h2>{dictionary.settingsTitle}</h2>
          <p>{dictionary.settingsText}</p>
          <Link href="/account/settings">{dictionary.settingsCta}</Link>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.communityLabel}</p>
          <h2>{dictionary.communityTitle}</h2>
          <p>{dictionary.communityText}</p>
          <Link href="/account/community">{dictionary.communityCta}</Link>
        </article>
      </div>
    </section>
  );
}
