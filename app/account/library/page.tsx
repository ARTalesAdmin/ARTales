import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getReaderLibrarySummary, getReaderUnlockedWorks } from "@/lib/entitlements";
import { getReaderCommunitySummary } from "@/lib/community";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function pickLabel<T extends Record<string, string>>(labels: T, value: string | null | undefined) {
  if (value && value in labels) return labels[value as keyof T];
  return labels.unknown ?? String(value ?? "unknown");
}

export default async function AccountLibraryPage() {
  const profile = await requireCompletedAccountProfile("/account/library");
  const [summary, unlockedWorks, communitySummary, cookieLocale] = await Promise.all([
    getReaderLibrarySummary(profile.id),
    getReaderUnlockedWorks(profile.id),
    getReaderCommunitySummary(profile.id),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.library;
  const accountDictionary = getPublicDictionary(locale).account;

  return (
    <section className="artales-account-page artales-account-library-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      <div className="artales-account-stat-grid">
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.online}</span>
          <strong>{summary.onlineEntitlements}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.saved}</span>
          <strong>{summary.savedItems}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.downloads}</span>
          <strong>{summary.pdfDownloads + summary.epubDownloads}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.credits}</span>
          <strong>{summary.atCreditBalance}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.welcome}</span>
          <strong>{summary.welcomeUnlockAvailable ? "1" : "0"}</strong>
        </article>
      </div>

      {summary.welcomeUnlockAvailable ? (
        <section className="artales-account-promo-panel">
          <p className="artales-account-card__label">{dictionary.welcomeAvailableLabel}</p>
          <h2>{dictionary.welcomeAvailableTitle}</h2>
          <p>{dictionary.welcomeAvailableText}</p>
          <Link className="artales-button" href="/gallery">{dictionary.chooseTitle}</Link>
        </section>
      ) : summary.welcomeUnlockUsed ? (
        <section className="artales-account-panel artales-account-panel--spaced">
          <p className="artales-account-card__label">{dictionary.welcomeUsedLabel}</p>
          <h2>{dictionary.welcomeUsedTitle}</h2>
          <p>{dictionary.welcomeUsedText}</p>
        </section>
      ) : null}


      <section className="artales-account-panel artales-account-delivery-panel">
        <p className="artales-account-card__label">{dictionary.deliveryLabel}</p>
        <h2>{dictionary.deliveryTitle}</h2>
        <p>{dictionary.deliveryText}</p>
        <div className="artales-account-model-grid">
          {dictionary.deliveryItems.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="artales-account-grid artales-account-library-tools">
        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.savedLabel}</p>
          <h2>{dictionary.savedTitle}</h2>
          <p>{dictionary.savedText}</p>
          <p className="artales-account-muted">{dictionary.savedMeta}</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.recentLabel}</p>
          <h2>{summary.recentItems} {dictionary.recentTitleSuffix}</h2>
          <p>{dictionary.recentText}</p>
          <p className="artales-account-muted">{dictionary.recentMeta}</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">{dictionary.downloadsLabel}</p>
          <h2>{dictionary.downloadsTitle}</h2>
          <p>{dictionary.downloadsText}</p>
          <p className="artales-account-muted">PDF: {summary.pdfDownloads} · EPUB: {summary.epubDownloads}</p>
        </article>

        <article className="artales-account-card artales-account-card--compact-cta">
          <p className="artales-account-card__label">{dictionary.readerSettings}</p>
          <h2>{dictionary.openSettings}</h2>
          <p>{dictionary.readerSettingsText}</p>
          <Link href="/account/settings">{dictionary.openSettings}</Link>
        </article>
      </div>

      <section className="artales-account-panel artales-community-section artales-account-library-watchlist">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">{dictionary.followedAuthorsLabel}</p>
            <h2>{dictionary.followedAuthorsTitle}</h2>
          </div>
          <Link className="artales-button-secondary" href="/account/community">{dictionary.manageFollows}</Link>
        </div>
        {communitySummary.followedAuthors.length === 0 ? (
          <p>{dictionary.noFollowedAuthors}</p>
        ) : (
          <div className="artales-community-follow-preview">
            {communitySummary.followedAuthors.slice(0, 4).map((author) => (
              <Link key={author.id} className="artales-community-follow-pill" href={`/author/${author.slug}`}>
                {author.name}
              </Link>
            ))}
            {communitySummary.followedAuthors.length > 4 ? (
              <Link className="artales-community-follow-pill" href="/account/community">
                +{communitySummary.followedAuthors.length - 4} {dictionary.more}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="artales-account-panel artales-account-library-unlocked">
        <h2>{dictionary.unlockedTitle}</h2>
        {unlockedWorks.length > 0 ? (
          <div className="artales-account-library-card-grid">
            {unlockedWorks.map((work) => (
              <article key={work.id} className="artales-account-library-card">
                <div>
                  <p className="artales-account-card__label">
                    {pickLabel(accountDictionary.entitlementSources, work.entitlementSource)}
                  </p>
                  <h3>{work.title}</h3>
                  <p className="artales-account-muted">{work.author?.name ?? dictionary.unknownAuthor}</p>
                  <div className="artales-account-library-badges" aria-label={dictionary.sourceLabel}>
                    <span>{dictionary.accessOnline}</span>
                  </div>
                </div>
                <div className="artales-account-library-card__actions">
                  <Link className="artales-button" href={`/reader/${work.slug}?mode=full`}>
                    {dictionary.readOnline}
                  </Link>
                  <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                    {dictionary.openDetail}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{dictionary.noUnlockedWorks}</p>
        )}
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">{dictionary.browseGallery}</Link>
        <Link className="artales-button-secondary" href="/account/membership">{dictionary.viewMembership}</Link>
      </div>
    </section>
  );
}
