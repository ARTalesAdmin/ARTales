import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getFeedbackTypeLabel, getReaderCommunitySummary } from "@/lib/community";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { unfollowAuthorFromAccountAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ follow?: string }>;
};

export default async function AccountCommunityPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/community");
  const [summary, cookieLocale] = await Promise.all([
    getReaderCommunitySummary(profile.id),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.community;
  const { follow } = await searchParams;

  return (
    <section className="artales-account-page artales-account-community-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {follow === "removed" ? <p className="artales-account-success">{dictionary.followRemoved}</p> : null}
      {follow === "error" ? <p className="artales-account-alert">{dictionary.followError}</p> : null}

      <div className="artales-account-stat-grid artales-account-community-stats">
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.followedAuthors}</span>
          <strong>{summary.followedAuthorCount}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.signalsSent}</span>
          <strong>{summary.feedbackCount}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.editorialLayer}</span>
          <strong>{dictionary.stats.editorialLayerValue}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>{dictionary.stats.rolePath}</span>
          <strong>{dictionary.stats.rolePathValue}</strong>
        </article>
      </div>

      <section className="artales-account-panel artales-community-section">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">{dictionary.followedAuthorsLabel}</p>
            <h2>{dictionary.followedAuthorsTitle}</h2>
            <p>{dictionary.followedAuthorsText}</p>
          </div>
          <Link className="artales-button-secondary" href="/authors">
            {dictionary.findAuthors}
          </Link>
        </div>
        {summary.followedAuthors.length === 0 ? (
          <div className="artales-account-empty-state">
            <h3>{dictionary.noFollowedAuthorsTitle}</h3>
            <p>{dictionary.noFollowedAuthorsText}</p>
            <Link className="artales-button" href="/authors">{dictionary.findAuthors}</Link>
          </div>
        ) : (
          <div className="artales-community-list">
            {summary.followedAuthors.map((author) => (
              <article key={author.id} className="artales-community-row">
                <div>
                  <h3>{author.name}</h3>
                  <p>{dictionary.notifications}: {author.notificationLevel.replaceAll("_", " ")}</p>
                </div>
                <div className="artales-community-actions">
                  <Link className="artales-button-secondary" href={`/author/${author.slug}`}>
                    {dictionary.openAuthor}
                  </Link>
                  <form action={unfollowAuthorFromAccountAction}>
                    <input type="hidden" name="follow_id" value={author.id} />
                    <input type="hidden" name="author_id" value={author.authorId} />
                    <button className="artales-button-secondary artales-button-secondary--danger" type="submit">
                      {dictionary.unfollow}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="artales-account-panel artales-community-section artales-account-community-membrane">
        <p className="artales-account-card__label">{dictionary.readerSignalsLabel}</p>
        <h2>{dictionary.readerSignalsTitle}</h2>
        <p>{dictionary.readerSignalsText}</p>
        <div className="artales-account-actions artales-account-actions--left">
          <Link className="artales-button" href="/gallery">{dictionary.browseWorks}</Link>
          <Link className="artales-button-secondary" href="/account/library">{dictionary.openLibrary}</Link>
        </div>
      </section>

      <section className="artales-account-panel artales-community-section">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">{dictionary.privateSignalsLabel}</p>
            <h2>{dictionary.privateSignalsTitle}</h2>
            <p>{dictionary.privateSignalsText}</p>
          </div>
        </div>
        {summary.feedbackItems.length === 0 ? (
          <p>{dictionary.noSignals}</p>
        ) : (
          <div className="artales-community-list">
            {summary.feedbackItems.map((item) => (
              <article key={item.id} className="artales-community-row artales-community-row--stacked">
                <div>
                  <p className="artales-community-card__eyebrow">
                    {getFeedbackTypeLabel(item.feedbackType, locale)} · {item.status}
                  </p>
                  <h3>{item.workTitle}</h3>
                  <p>{item.body}</p>
                </div>
                {item.workSlug ? (
                  <Link className="artales-button-secondary" href={`/work/${item.workSlug}`}>
                    {dictionary.openWork}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="artales-account-panel artales-community-section">
        <p className="artales-account-card__label">{dictionary.futurePathsLabel}</p>
        <h2>{dictionary.futurePathsTitle}</h2>
        <p>{dictionary.futurePathsText}</p>
        <div className="artales-account-roadmap-grid">
          {dictionary.futurePaths.map((path) => (
            <article key={path.label} className="artales-account-card artales-account-roadmap-card">
              <span>{path.status}</span>
              <h3>{path.label}</h3>
              <p>{path.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="artales-account-panel artales-community-section artales-account-role-path">
        <p className="artales-account-card__label">{dictionary.rolePathLabel}</p>
        <h2>{dictionary.rolePathTitle}</h2>
        <div className="artales-account-role-steps" aria-label={dictionary.rolePathTitle}>
          {dictionary.roleSteps.map((step) => (
            <article key={step.title}>
              <span>{step.index}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
