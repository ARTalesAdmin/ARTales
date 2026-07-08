import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import {
  getReaderLibrarySummary,
  getReaderSavedWorks,
  getReaderUnlockedWorks,
  type ReaderUnlockedWork,
} from "@/lib/entitlements";
import { getReaderCommunitySummary } from "@/lib/community";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { pickLocalizedText } from "@/lib/localizedContent";
import WorkCoverImage from "@/components/work/WorkCoverImage";

export const dynamic = "force-dynamic";

type LibraryDictionary = ReturnType<
  typeof getPublicDictionary
>["account"]["library"];

function pickLabel<T extends Record<string, string>>(
  labels: T,
  value: string | null | undefined,
) {
  if (value && value in labels) return labels[value as keyof T];
  return labels.unknown ?? String(value ?? "unknown");
}

function getDisplayTitle(locale: "cs" | "en", work: ReaderUnlockedWork) {
  return (
    pickLocalizedText(locale, {
      cs: work.title_cs,
      en: work.title_en,
      fallback: work.title,
    }) ?? work.title
  );
}

function getDisplaySummary(locale: "cs" | "en", work: ReaderUnlockedWork) {
  return (
    pickLocalizedText(locale, {
      cs: work.summary_cs,
      en: work.summary_en,
      fallback: work.summary,
    }) ?? work.summary
  );
}

function getDisplayAuthorName(locale: "cs" | "en", work: ReaderUnlockedWork) {
  if (!work.author) return null;

  return (
    pickLocalizedText(locale, {
      cs: work.author.name_cs ?? null,
      en: work.author.name_en ?? null,
      fallback: work.author.name,
    }) ?? work.author.name
  );
}

function LibraryWorkCard({
  work,
  locale,
  dictionary,
  badge,
  primaryHref,
  primaryLabel,
}: {
  work: ReaderUnlockedWork;
  locale: "cs" | "en";
  dictionary: LibraryDictionary;
  badge: string;
  primaryHref: string;
  primaryLabel: string;
}) {
  const title = getDisplayTitle(locale, work);
  const summary = getDisplaySummary(locale, work);
  const authorName = getDisplayAuthorName(locale, work);

  return (
    <article className="artales-account-book-card">
      <Link
        className="artales-account-book-card__cover"
        href={primaryHref}
        aria-label={`${primaryLabel}: ${title}`}
      >
        <WorkCoverImage
          title={title}
          imagePath={work.cover_image_path}
          alt={work.cover_image_alt}
          caption={work.cover_image_caption}
          variant="card"
        />
      </Link>
      <div className="artales-account-book-card__body">
        <p className="artales-account-card__label">{badge}</p>
        <h3>
          <Link href={`/work/${work.slug}`}>{title}</Link>
        </h3>
        <p className="artales-account-muted">
          {authorName ?? dictionary.unknownAuthor}
        </p>
        <p className="artales-account-book-card__summary">{summary}</p>
        <div className="artales-account-book-card__actions">
          <Link className="artales-button" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link
            className="artales-button-secondary"
            href={`/work/${work.slug}`}
          >
            {dictionary.openDetail}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function AccountLibraryPage() {
  const profile = await requireCompletedAccountProfile("/account/library");
  const [summary, unlockedWorks, savedWorks, communitySummary, cookieLocale] =
    await Promise.all([
      getReaderLibrarySummary(profile.id),
      getReaderUnlockedWorks(profile.id),
      getReaderSavedWorks(profile.id),
      getReaderCommunitySummary(profile.id),
      getCookieLocale(),
    ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.library;
  const accountDictionary = getPublicDictionary(locale).account;
  const continueWork = unlockedWorks[0] ?? null;

  return (
    <section className="artales-account-page artales-account-library-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {continueWork ? (
        <section className="artales-account-library-hero">
          <div className="artales-account-library-hero__copy">
            <p className="artales-account-card__label">
              {dictionary.continueLabel}
            </p>
            <h2>{getDisplayTitle(locale, continueWork)}</h2>
            <p>{dictionary.continueText}</p>
            <div className="artales-account-actions artales-account-actions--inline">
              <Link
                className="artales-button"
                href={`/reader/${continueWork.slug}?mode=full`}
              >
                {dictionary.continueCta}
              </Link>
              <Link
                className="artales-button-secondary"
                href={`/work/${continueWork.slug}`}
              >
                {dictionary.openDetail}
              </Link>
            </div>
          </div>
          <Link
            className="artales-account-library-hero__cover"
            href={`/reader/${continueWork.slug}?mode=full`}
          >
            <WorkCoverImage
              title={getDisplayTitle(locale, continueWork)}
              imagePath={continueWork.cover_image_path}
              alt={continueWork.cover_image_alt}
              caption={continueWork.cover_image_caption}
              variant="card"
            />
          </Link>
        </section>
      ) : null}

      <div className="artales-account-stat-grid artales-account-stat-grid--library">
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.online}</span>
          <strong>{summary.onlineEntitlements}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.saved}</span>
          <strong>{summary.savedItems}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.credits}</span>
          <strong>{summary.atCreditBalance}</strong>
        </article>
      </div>

      {summary.welcomeUnlockAvailable ? (
        <section className="artales-account-promo-panel">
          <p className="artales-account-card__label">
            {dictionary.welcomeAvailableLabel}
          </p>
          <h2>{dictionary.welcomeAvailableTitle}</h2>
          <p>{dictionary.welcomeAvailableText}</p>
          <Link className="artales-button" href="/gallery">
            {dictionary.chooseTitle}
          </Link>
        </section>
      ) : null}

      <section className="artales-account-panel artales-account-library-unlocked">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">
              {dictionary.unlockedLabel}
            </p>
            <h2>{dictionary.unlockedTitle}</h2>
          </div>
          <Link className="artales-button-secondary" href="/gallery">
            {dictionary.browseGallery}
          </Link>
        </div>
        {unlockedWorks.length > 0 ? (
          <div className="artales-account-book-grid">
            {unlockedWorks.map((work) => (
              <LibraryWorkCard
                key={work.id}
                work={work}
                locale={locale}
                dictionary={dictionary}
                badge={pickLabel(
                  accountDictionary.entitlementSources,
                  work.entitlementSource,
                )}
                primaryHref={`/reader/${work.slug}?mode=full`}
                primaryLabel={dictionary.readOnline}
              />
            ))}
          </div>
        ) : (
          <div className="artales-account-empty-state">
            <h3>{dictionary.noUnlockedWorksTitle}</h3>
            <p>{dictionary.noUnlockedWorks}</p>
            <Link className="artales-button" href="/gallery">
              {dictionary.browseGallery}
            </Link>
          </div>
        )}
      </section>

      <section className="artales-account-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">
              {dictionary.savedLabel}
            </p>
            <h2>{dictionary.savedTitle}</h2>
          </div>
          <Link className="artales-button-secondary" href="/gallery">
            {dictionary.findMore}
          </Link>
        </div>
        {savedWorks.length > 0 ? (
          <div className="artales-account-book-grid artales-account-book-grid--saved">
            {savedWorks.map((work) => (
              <LibraryWorkCard
                key={work.id}
                work={work}
                locale={locale}
                dictionary={dictionary}
                badge={dictionary.savedBadge}
                primaryHref={`/reader/${work.slug}`}
                primaryLabel={dictionary.readPreview}
              />
            ))}
          </div>
        ) : (
          <p className="artales-account-muted">{dictionary.noSavedWorks}</p>
        )}
      </section>

      <section className="artales-account-panel artales-credit-library-panel">
        <div>
          <p className="artales-account-card__label">
            {dictionary.creditPanelLabel}
          </p>
          <h2>{dictionary.creditPanelTitle}</h2>
          <p>{dictionary.creditPanelText}</p>
        </div>
        <div className="artales-account-actions artales-account-actions--inline">
          <Link className="artales-button" href="/checkout/credits">
            {dictionary.topUpCredits}
          </Link>
          <Link className="artales-button-secondary" href="/checkout/support">
            {dictionary.supportArtales}
          </Link>
        </div>
      </section>

      <section className="artales-account-panel artales-community-section artales-account-library-watchlist">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">
              {dictionary.followedAuthorsLabel}
            </p>
            <h2>{dictionary.followedAuthorsTitle}</h2>
          </div>
          <Link className="artales-button-secondary" href="/account/community">
            {dictionary.manageFollows}
          </Link>
        </div>
        {communitySummary.followedAuthors.length === 0 ? (
          <p>{dictionary.noFollowedAuthors}</p>
        ) : (
          <div className="artales-community-follow-preview">
            {communitySummary.followedAuthors.slice(0, 4).map((author) => (
              <Link
                key={author.id}
                className="artales-community-follow-pill"
                href={`/author/${author.slug}`}
              >
                {author.name}
              </Link>
            ))}
            {communitySummary.followedAuthors.length > 4 ? (
              <Link
                className="artales-community-follow-pill"
                href="/account/community"
              >
                +{communitySummary.followedAuthors.length - 4} {dictionary.more}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">
          {dictionary.browseGallery}
        </Link>
        <Link className="artales-button-secondary" href="/account/credits">
          {dictionary.openCredits}
        </Link>
      </div>
    </section>
  );
}
