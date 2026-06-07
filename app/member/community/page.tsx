import Link from "next/link";
import { requireMemberZoneAccess } from "@/lib/guards";
import { getCommunityInbox, getFeedbackTypeLabel } from "@/lib/community";
import { acknowledgeWorkFeedbackAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ feedback?: string }>;
};

export default async function MemberCommunityPage({ searchParams }: PageProps) {
  await requireMemberZoneAccess();
  const inbox = await getCommunityInbox(80);
  const { feedback } = await searchParams;
  const newCount = inbox.filter((item) => item.status === "new").length;

  return (
    <section className="artales-member-page">
      <p className="artales-member-kicker">Komunitní procesor</p>
      <h1>Čtenářské podněty a redakční membrána</h1>
      <p className="artales-member-lede">
        Současná stránka je první triage vstupů od čtenářů. Komunitní procesor je širší budoucí vrstva pro korektury, překlady, skupiny, učení, práci a růst rolí — ne veřejná diskuze pod díly.
      </p>

      {feedback === "acknowledged" ? <p className="artales-account-success">Podnět byl označen jako vzatý na vědomí.</p> : null}
      {feedback === "error" ? <p className="artales-account-alert">Podnět se nepodařilo aktualizovat.</p> : null}

      <div className="artales-account-grid">
        <article className="artales-account-card artales-account-card--featured">
          <p className="artales-account-card__label">Nové vstupy</p>
          <h2>{newCount}</h2>
          <p>Podněty, které ještě nikdo z interní vrstvy nevzal na vědomí.</p>
        </article>
        <article className="artales-account-card">
          <p className="artales-account-card__label">Celkem v triage</p>
          <h2>{inbox.length}</h2>
          <p>Soukromé vstupy od readerů a interních účtů v posledním načteném výřezu.</p>
        </article>
      </div>

      <div className="artales-member-panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <h2>Čtenářské podněty</h2>
            <p>Editor/admin rozhoduje, co se zpracuje, co se předá autorovi a co zůstane jen interním signálem.</p>
          </div>
          <span className="artales-account-badge">{newCount} nových</span>
        </div>

        {inbox.length === 0 ? (
          <p>Zatím nemáme žádné čtenářské podněty.</p>
        ) : (
          <div className="artales-admin-table-wrap">
            <table className="artales-admin-table">
              <thead>
                <tr>
                  <th>Dílo</th>
                  <th>Typ</th>
                  <th>Autor zprávy</th>
                  <th>Status</th>
                  <th>Podnět</th>
                  <th>Datum</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((item) => (
                  <tr key={item.id} className={item.status === "new" ? "artales-community-feedback-row--new" : undefined}>
                    <td>
                      {item.workSlug ? <Link href={`/work/${item.workSlug}`}>{item.workTitle}</Link> : item.workTitle}
                    </td>
                    <td>{getFeedbackTypeLabel(item.feedbackType)}</td>
                    <td>{item.userHandle ? `@${item.userHandle}` : item.userEmail ?? "—"}</td>
                    <td>
                      <span className={item.status === "new" ? "artales-account-badge" : "artales-account-muted"}>
                        {item.status === "acknowledged" ? "acknowledged" : "new"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "normal", minWidth: "260px" }}>{item.body}</td>
                    <td>{new Date(item.createdAt).toLocaleDateString("cs-CZ")}</td>
                    <td>
                      {item.status === "new" ? (
                        <form action={acknowledgeWorkFeedbackAction}>
                          <input type="hidden" name="feedback_id" value={item.id} />
                          <button className="artales-button-secondary" type="submit">
                            Vzít na vědomí
                          </button>
                        </form>
                      ) : item.acknowledgedAt ? (
                        <span className="artales-account-muted">
                          {new Date(item.acknowledgedAt).toLocaleDateString("cs-CZ")}
                        </span>
                      ) : (
                        <span className="artales-account-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
