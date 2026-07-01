import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { getAdminDashboardMetrics } from "@/lib/purchases";

type PageProps = {
  searchParams?: Promise<{ range?: string }>;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <article className="artales-admin-stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {note ? <span>{note}</span> : null}
    </article>
  );
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const range = params?.range === "all" ? "all" : "month";
  const metrics = await getAdminDashboardMetrics(range);
  const oppositeRange = range === "month" ? "all" : "month";

  return (
    <main className="artales-admin-dashboard">
      <div className="artales-admin-dashboard__header">
        <div>
          <p className="artales-admin-dashboard__eyebrow">Admin · analytika a účetní přehled</p>
          <h1>Centrální dashboard</h1>
          <p>
            Raw eventy zůstávají jako hrubý puls systému. Nad nimi se teď ukazují sessions, prostředí, čtení děl, nákupní zájem a základy budoucích autorských KPI.
          </p>
        </div>
        <div className="artales-admin-dashboard__actions">
          <Link className="artales-button-secondary" href={`/member/admin/dashboard?range=${oppositeRange}`}>
            {range === "month" ? "Zobrazit celkem" : "Zobrazit tento měsíc"}
          </Link>
          <Link className="artales-button-secondary" href="/member/admin/payments">
            QR platby
          </Link>
          <Link className="artales-button" href={`/member/admin/dashboard/export?range=${range}`}>
            Stáhnout CSV
          </Link>
        </div>
      </div>

      <div className="artales-admin-dashboard__range">
        <strong>{metrics.rangeLabel}</strong>
        <span>Vygenerováno: {formatDate(metrics.generatedAt)}</span>
      </div>

      <section className="artales-admin-stat-grid" aria-label="Hlavní metriky">
        <StatCard label="Raw page views" value={metrics.rawPageViews} note="všechny page eventy" />
        <StatCard label="Unique sessions" value={metrics.uniqueSessions} note="orientační návštěvy" />
        <StatCard label="Aktivní přihlášení" value={metrics.activeSignedInUsers} note="unikátní user_id" />
        <StatCard label="Veřejné views" value={metrics.publicViews} />
        <StatCard label="Reader opens" value={metrics.readerOpens} note="otevření readeru" />
        <StatCard label="Zájem o nákup" value={metrics.purchaseIntents} note="kliknutí na checkout/product CTA" />
        <StatCard label="Objednávky" value={metrics.ordersTotal} />
        <StatCard label="Přijato plateb" value={metrics.paymentsReceivedFormatted} note="zatím 0 před checkoutem" />
      </section>

      <section className="artales-admin-dashboard__columns">
        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Aktivita podle prostředí</h2>
          {metrics.environmentCounts.length === 0 ? (
            <p>Zatím nejsou žádná data.</p>
          ) : (
            <dl className="artales-admin-metric-list">
              {metrics.environmentCounts.map((item) => (
                <div key={item.environment}>
                  <dt>{item.label}</dt>
                  <dd>{item.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>

        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Účty podle rolí</h2>
          {metrics.accountsByRole.length === 0 ? (
            <p>Zatím nejsou žádná data.</p>
          ) : (
            <dl className="artales-admin-metric-list">
              {metrics.accountsByRole.map((item) => (
                <div key={item.role}>
                  <dt>{item.role}</dt>
                  <dd>{item.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>

        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Zájem podle produktů</h2>
          {metrics.productInterest.length === 0 ? (
            <p>Zatím nejsou zachycené žádné produktové kliky.</p>
          ) : (
            <dl className="artales-admin-metric-list">
              {metrics.productInterest.map((item) => (
                <div key={item.productType}>
                  <dt>{item.productType}</dt>
                  <dd>{item.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>

        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Aktivní nároky</h2>
          <dl className="artales-admin-metric-list">
            <div><dt>Online read</dt><dd>{metrics.entitlementsOnlineRead}</dd></div>
            <div><dt>PDF</dt><dd>{metrics.entitlementsPdf}</dd></div>
            <div><dt>EPUB</dt><dd>{metrics.entitlementsEpub}</dd></div>
          </dl>
        </article>
      </section>

      <section className="artales-member-panel artales-admin-dashboard__panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <h2>Nejaktivnější díla</h2>
            <p>
              Základ pro budoucí autorské přehledy: detail, otevření readeru, unikátní sessions, unlocky a nákupní zájem.
            </p>
          </div>
        </div>

        {metrics.topWorks.length === 0 ? (
          <p>Zatím nejsou work-level data. Otevři detail díla a reader, aby se začala plnit.</p>
        ) : (
          <div className="artales-admin-table-wrap">
            <table className="artales-admin-table">
              <thead>
                <tr>
                  <th>Dílo</th>
                  <th>Autor</th>
                  <th>Detail</th>
                  <th>Reader</th>
                  <th>Sessions</th>
                  <th>Unlocks</th>
                  <th>Zájem</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topWorks.map((work) => (
                  <tr key={work.slug}>
                    <td>
                      <Link href={`/work/${work.slug}`}>{work.title}</Link>
                    </td>
                    <td>{work.authorName ?? "—"}</td>
                    <td>{work.detailViews}</td>
                    <td>{work.readerOpens}</td>
                    <td>{work.uniqueSessions}</td>
                    <td>{work.unlocks}</td>
                    <td>{work.purchaseIntents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="artales-member-panel artales-admin-dashboard__panel artales-admin-dashboard__wide-panel">
        <h2>Interpretace metrik</h2>
        <p>
          Raw page views jsou hrubý signál aktivity, ne přesný počet čtenářů. Reader opens lépe ukazují čtenářský záměr, ale ne čas strávený čtením. Přesný čas, heartbeat, autor dashboard a provizní KPI patří do další analytické vrstvy.
        </p>
      </section>
    </main>
  );
}
