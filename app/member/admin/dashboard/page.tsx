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
          <p className="artales-admin-dashboard__eyebrow">Admin · účetní přehled</p>
          <h1>Centrální dashboard</h1>
          <p>
            Přehled návštěv, účtů, nákupního zájmu, objednávek, plateb a nároků. Teď je to analyticko-účetní základ; příjmy se začnou plnit až po reálné platební bráně.
          </p>
        </div>
        <div className="artales-admin-dashboard__actions">
          <Link className="artales-button-secondary" href={`/member/admin/dashboard?range=${oppositeRange}`}>
            {range === "month" ? "Zobrazit celkem" : "Zobrazit tento měsíc"}
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
        <StatCard label="Návštěvy" value={metrics.visits} note="měřeno od v0.9.6" />
        <StatCard label="Účty celkem" value={metrics.accountsTotal} />
        <StatCard label="Zájem o nákup" value={metrics.purchaseIntents} note="kliknutí na checkout placeholder" />
        <StatCard label="Objednávky" value={metrics.ordersTotal} />
        <StatCard label="Zaplacené objednávky" value={metrics.paidOrders} />
        <StatCard label="Přijato plateb" value={metrics.paymentsReceivedFormatted} note="zatím 0 před checkoutem" />
      </section>

      <section className="artales-admin-dashboard__columns">
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
          <h2>Zakoupené / připravené typy</h2>
          <dl className="artales-admin-metric-list">
            <div><dt>Online reads</dt><dd>{metrics.onlineReadsPurchased}</dd></div>
            <div><dt>PDF</dt><dd>{metrics.pdfsPurchased}</dd></div>
            <div><dt>EPUB</dt><dd>{metrics.epubsPurchased}</dd></div>
            <div><dt>Knihy / print</dt><dd>{metrics.booksPurchased}</dd></div>
          </dl>
        </article>

        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Aktivní nároky</h2>
          <dl className="artales-admin-metric-list">
            <div><dt>Online read</dt><dd>{metrics.entitlementsOnlineRead}</dd></div>
            <div><dt>PDF</dt><dd>{metrics.entitlementsPdf}</dd></div>
            <div><dt>EPUB</dt><dd>{metrics.entitlementsEpub}</dd></div>
          </dl>
        </article>

        <article className="artales-member-panel artales-admin-dashboard__panel">
          <h2>Další vrstva</h2>
          <p>
            Později sem přibude income/outcome, odměny za práci, náklady na produkci, Resend e-maily, platební provider a exporty pro účetnictví.
          </p>
        </article>
      </section>
    </main>
  );
}
