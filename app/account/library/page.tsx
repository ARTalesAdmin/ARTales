import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getReaderLibrarySummary, getReaderUnlockedWorks } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function AccountLibraryPage() {
  const profile = await requireCompletedAccountProfile("/account/library");
  const [summary, unlockedWorks] = await Promise.all([
    getReaderLibrarySummary(profile.id),
    getReaderUnlockedWorks(profile.id),
  ]);

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">My library</p>
      <h1>Your ARTales library</h1>
      <p className="artales-account-lede">
        This page now reads from the v0.9 entitlement foundation. It is still not connected to payments, but it can already display future online unlocks, download rights, saved items and AT Credit balance.
      </p>

      <div className="artales-account-stat-grid">
        <article className="artales-account-stat-card">
          <span>Online unlocks</span>
          <strong>{summary.onlineEntitlements}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>Saved works</span>
          <strong>{summary.savedItems}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>Downloads</span>
          <strong>{summary.pdfDownloads + summary.epubDownloads}</strong>
        </article>
        <article className="artales-account-stat-card">
          <span>AT Credits</span>
          <strong>{summary.atCreditBalance}</strong>
        </article>
      </div>

      <div className="artales-account-grid">
        <article className="artales-account-card">
          <p className="artales-account-card__label">Saved works</p>
          <h2>Browser saves now, DB sync next</h2>
          <p>
            Current save-for-later behavior is still local to the browser. v0.9 prepares the database table for synchronized saved works.
          </p>
          <p className="artales-account-muted">Source now: localStorage · Target: reader_library_items</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Recently read</p>
          <h2>{summary.recentItems} synced records</h2>
          <p>
            Reader progress and bookmarks remain reader UX primitives. Account-level synchronization is now structurally prepared.
          </p>
          <p className="artales-account-muted">Prepared for synchronized progress and device handoff.</p>
        </article>

        <article className="artales-account-card">
          <p className="artales-account-card__label">Downloads</p>
          <h2>PDF / EPUB rights</h2>
          <p>
            PDF and EPUB products will use the same entitlement layer. Purchased downloads and AT Credit redemptions will appear here later.
          </p>
          <p className="artales-account-muted">PDF: {summary.pdfDownloads} · EPUB: {summary.epubDownloads}</p>
        </article>
      </div>

      <section className="artales-account-panel">
        <h2>Unlocked online titles</h2>
        {unlockedWorks.length > 0 ? (
          <div className="artales-account-list">
            {unlockedWorks.map((work) => (
              <article key={work.id} className="artales-account-list-item">
                <div>
                  <p className="artales-account-card__label">{work.entitlementSource.replaceAll("_", " ")}</p>
                  <h3>{work.title}</h3>
                  <p>{work.author?.name ?? "Unknown author"}</p>
                </div>
                <Link className="artales-button-secondary" href={`/reader/${work.slug}?mode=full`}>
                  Read online
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p>
            No online titles are unlocked yet. The first welcome unlock, subscription unlocks and purchases will appear here once v0.9 commerce logic is connected.
          </p>
        )}
      </section>

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">Browse gallery</Link>
        <Link className="artales-button-secondary" href="/account/membership">View membership plan</Link>
      </div>
    </section>
  );
}
