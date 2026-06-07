import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getFeedbackTypeLabel, getReaderCommunitySummary } from "@/lib/community";
import { unfollowAuthorFromAccountAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ follow?: string }>;
};

export default async function AccountCommunityPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/community");
  const summary = await getReaderCommunitySummary(profile.id);
  const { follow } = await searchParams;

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">Community processor</p>
      <h1>Your ARTales participation</h1>
      <p className="artales-account-lede">
        Manage your followed authors and private reader signals. ARTales community is not a public comment stream; useful inputs pass through the editorial layer first.
      </p>

      {follow === "removed" ? <p className="artales-account-success">Author removed from your followed list.</p> : null}
      {follow === "error" ? <p className="artales-account-alert">Author follow could not be updated.</p> : null}

      <div className="artales-account-grid">
        <article className="artales-account-card artales-account-card--featured">
          <p className="artales-account-card__label">Followed authors</p>
          <h2>{summary.followedAuthorCount}</h2>
          <p>Authors you follow will later power new-release notifications, author demand signals and community hubs.</p>
        </article>
        <article className="artales-account-card">
          <p className="artales-account-card__label">Signals sent</p>
          <h2>{summary.feedbackCount}</h2>
          <p>Private signals sent to the ARTales editorial layer. Useful contributions may later feed credits and reputation.</p>
        </article>
      </div>

      <section className="artales-account-panel artales-community-section">
        <h2>Followed authors</h2>
        {summary.followedAuthors.length === 0 ? (
          <p>You are not following any authors yet. Open an author profile and use Follow author.</p>
        ) : (
          <div className="artales-community-list">
            {summary.followedAuthors.map((author) => (
              <article key={author.id} className="artales-community-row">
                <div>
                  <h3>{author.name}</h3>
                  <p>Notifications: {author.notificationLevel.replaceAll("_", " ")}</p>
                </div>
                <div className="artales-community-actions">
                  <Link className="artales-button-secondary" href={`/author/${author.slug}`}>
                    Open author
                  </Link>
                  <form action={unfollowAuthorFromAccountAction}>
                    <input type="hidden" name="follow_id" value={author.id} />
                    <input type="hidden" name="author_id" value={author.authorId} />
                    <button className="artales-button-muted" type="submit">
                      Unfollow
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="artales-account-panel artales-community-section">
        <h2>Your private signals</h2>
        {summary.feedbackItems.length === 0 ? (
          <p>No signals submitted yet.</p>
        ) : (
          <div className="artales-community-list">
            {summary.feedbackItems.map((item) => (
              <article key={item.id} className="artales-community-row artales-community-row--stacked">
                <div>
                  <p className="artales-community-card__eyebrow">{getFeedbackTypeLabel(item.feedbackType)} · {item.status}</p>
                  <h3>{item.workTitle}</h3>
                  <p>{item.body}</p>
                </div>
                {item.workSlug ? (
                  <Link className="artales-button-secondary" href={`/work/${item.workSlug}`}>
                    Open work
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="artales-account-panel artales-community-section">
        <h2>Future participation paths</h2>
        <div className="artales-account-grid">
          <article className="artales-account-card">
            <p className="artales-account-card__label">Corrections</p>
            <p>Help improve texts, formatting and reader quality through reviewed editorial signals.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Translations</p>
            <p>Request, validate or help prepare translations once translation workflows are opened.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Groups</p>
            <p>Future reading groups, schools, libraries and author communities can work through ARTales.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Credits and roles</p>
            <p>Valuable participation can later connect to AT Credits, contributor records and higher ARTales roles.</p>
          </article>
        </div>
      </section>
    </section>
  );
}
