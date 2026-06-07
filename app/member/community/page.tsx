import Link from "next/link";
import { requireMemberZoneAccess } from "@/lib/guards";
import { getCommunityInbox, getFeedbackTypeLabel } from "@/lib/community";

export const dynamic = "force-dynamic";

export default async function MemberCommunityPage() {
  await requireMemberZoneAccess();
  const inbox = await getCommunityInbox(80);

  return (
    <section className="artales-member-page">
      <p className="artales-member-kicker">Komunitní procesor</p>
      <h1>Řízená komunita, práce a čtenářské signály</h1>
      <p className="artales-member-lede">
        Komunitní procesor není veřejná diskuze. Je to systémová vrstva ARTales, která má postupně převádět
        čtenáře, skupiny, korektury, překlady, předčtení, učení a komunitní práci do redakčního zpracování,
        kreditů, reputace, rolí a transparentní hodnoty.
      </p>

      <div className="artales-member-panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <h2>Co sem bude patřit</h2>
            <p>Současné podněty jsou jen první vstup. Cílově má jít o aktivní komunitní a redakční síť.</p>
          </div>
        </div>
        <div className="artales-account-grid">
          <article className="artales-account-card">
            <p className="artales-account-card__label">Čtenářské signály</p>
            <p>Korekce, formátování, překladové podněty, návrhy titulů, reakce na díla a požadavky komunity.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Práce a kredity</p>
            <p>Budoucí evidence přínosu: korektury, překlady, předčtení, komunitní správa, mentoring a AT Credits.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Růst rolí</p>
            <p>Aktivní čtenář se může postupně stát contributorem, memberem, správcem, editorem nebo mentorem.</p>
          </article>
          <article className="artales-account-card">
            <p className="artales-account-card__label">Skupiny</p>
            <p>Školy, knihovny, čtenářské kluby, autorské komunity nebo skupiny kolem konkrétních kolekcí.</p>
          </article>
        </div>
      </div>

      <div className="artales-member-panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <h2>První vstupy: čtenářské podněty</h2>
            <p>Soukromé signály od readerů a interních účtů. Editor rozhoduje, co se zpracuje a co se případně předá dál.</p>
          </div>
          <span className="artales-account-badge">{inbox.length} záznamů</span>
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
                </tr>
              </thead>
              <tbody>
                {inbox.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.workSlug ? <Link href={`/work/${item.workSlug}`}>{item.workTitle}</Link> : item.workTitle}
                    </td>
                    <td>{getFeedbackTypeLabel(item.feedbackType)}</td>
                    <td>{item.userHandle ? `@${item.userHandle}` : item.userEmail ?? "—"}</td>
                    <td>{item.status}</td>
                    <td style={{ whiteSpace: "normal", minWidth: "260px" }}>{item.body}</td>
                    <td>{new Date(item.createdAt).toLocaleDateString("cs-CZ")}</td>
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
