import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { listManualQrAdminOrders } from "@/lib/manualQrAdmin";
import {
  cancelManualQrPaymentAction,
  fulfillManualQrPaymentAction,
  markManualQrPaymentPaidAction,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePage(value: string | string[] | undefined) {
  const page = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizeStatus(value: string | string[] | undefined): "active" | "cancelled" | "all" {
  const status = firstParam(value);
  if (status === "cancelled" || status === "all") return status;
  return "active";
}

function getNotice(searchParams: Record<string, string | string[] | undefined>) {
  const success = firstParam(searchParams.success);
  const error = firstParam(searchParams.error);

  if (success === "marked_paid") return { type: "success", text: "Platba byla označena jako zaplacená. Fulfillment můžeš provést samostatně." };
  if (success === "fulfilled") return { type: "success", text: "Platba byla označena jako zaplacená a nárok byl vyřízen." };
  if (success === "already_fulfilled") return { type: "success", text: "Objednávka už byla vyřízená, nic se neduplikovalo." };
  if (success === "cancelled") return { type: "success", text: "Platební pokyn byl stornovaný. Pokud už měl připsaný kredit, systém vložil zápornou korekci." };

  if (error === "missing_order") return { type: "error", text: "Chybí objednávka." };
  if (error === "mark_paid_failed") return { type: "error", text: "Platbu se nepodařilo označit jako zaplacenou." };
  if (error === "fulfillment_failed") return { type: "error", text: "Fulfillment se nepodařilo provést. Zkontroluj typ objednávky a metadata kreditu." };
  if (error === "cancel_failed") return { type: "error", text: "Platební pokyn se nepodařilo stornovat." };

  return null;
}

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

function getPaymentRailLabel(paymentRail: string | null) {
  if (paymentRail === "cz_domestic_qr") return "CZ QR / CZK";
  if (paymentRail === "sepa_qr") return "SEPA QR / EUR";
  return "QR";
}

function getKindLabel(kind: string) {
  if (kind === "credit_topup") return "Dobití kreditu";
  if (kind === "support") return "Podpora ARTales";
  return kind || "QR platba";
}

function getStatusLabel(status: string, paymentStatus: string, fulfillmentStatus: string | null) {
  if (status === "cancelled") return "Storno";
  if (status === "refunded") return "Stornováno / korekce";
  if (status === "fulfilled" || fulfillmentStatus === "fulfilled") return "Vyřízeno";
  if (paymentStatus === "paid") return "Zaplaceno · čeká fulfillment";
  return "Čeká na platbu";
}

function statusHref(status: "active" | "cancelled" | "all") {
  return `/member/admin/payments?status=${status}`;
}

export default async function ManualQrPaymentsAdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = getNotice(resolvedSearchParams);
  const page = normalizePage(resolvedSearchParams.page);
  const status = normalizeStatus(resolvedSearchParams.status);
  const pageSize = 25;
  const { orders, total } = await listManualQrAdminOrders({ page, pageSize, status });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const pendingCount = orders.filter((order) => order.paymentStatus !== "paid" && order.status !== "fulfilled" && order.status !== "cancelled" && order.status !== "refunded").length;
  const fulfillmentCount = orders.filter((order) => order.paymentStatus === "paid" && order.fulfillmentStatus !== "fulfilled" && order.status !== "fulfilled" && order.status !== "refunded").length;

  return (
    <main className="artales-admin-dashboard">
      <div className="artales-admin-dashboard__header">
        <div>
          <p className="artales-admin-dashboard__eyebrow">Admin · ruční QR platby</p>
          <h1>Platby a fulfillment</h1>
          <p>
            Tady spáruješ QR platby podle VS. Výchozí pohled skrývá storna, aby se nemíchala do aktivního provozu a budoucích účetních podkladů.
          </p>
        </div>
        <div className="artales-admin-dashboard__actions">
          <Link className="artales-button-secondary" href="/member/admin/dashboard">Dashboard</Link>
          <Link className="artales-button-secondary" href="/checkout/credits">Dobití kreditu</Link>
        </div>
      </div>

      {notice ? (
        <div className={`artales-member-notice artales-member-notice--${notice.type}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="artales-admin-stat-grid" aria-label="Platební stav">
        <article className="artales-admin-stat-card">
          <p>Čeká na platbu</p>
          <strong>{pendingCount}</strong>
          <span>na této stránce</span>
        </article>
        <article className="artales-admin-stat-card">
          <p>Čeká fulfillment</p>
          <strong>{fulfillmentCount}</strong>
          <span>zaplaceno, ale ještě nepřipsáno</span>
        </article>
        <article className="artales-admin-stat-card">
          <p>Záznamů ve filtru</p>
          <strong>{total}</strong>
          <span>stránkováno po {pageSize}</span>
        </article>
      </section>

      <section className="artales-member-panel artales-admin-dashboard__panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header artales-admin-payments-header">
          <div>
            <h2>Ruční QR platby</h2>
            <p>
              U kreditů akce „Zaplaceno + vyřídit“ připíše kredit do ledgeru. Storno vyřízeného kreditu vytvoří zápornou korekci, ne maže historii.
            </p>
          </div>
          <div className="artales-admin-payments-tabs" aria-label="Filtr plateb">
            <Link className={status === "active" ? "is-active" : ""} href={statusHref("active")}>Aktivní</Link>
            <Link className={status === "cancelled" ? "is-active" : ""} href={statusHref("cancelled")}>Storna</Link>
            <Link className={status === "all" ? "is-active" : ""} href={statusHref("all")}>Vše</Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <p>Zatím tu nejsou žádné QR objednávky pro vybraný filtr.</p>
        ) : (
          <div className="artales-admin-payment-list">
            {orders.map((order) => {
              const isCancelled = order.status === "cancelled" || order.status === "refunded" || Boolean(order.manualCancelledAt || order.userCancelledAt);
              const isFulfilled = order.status === "fulfilled" || order.fulfillmentStatus === "fulfilled";
              const isPaid = order.paymentStatus === "paid" || isFulfilled;
              const canMarkPaid = !isPaid && !isCancelled;
              const canFulfill = !isFulfilled && !isCancelled;
              const canCancel = !isCancelled;
              const fulfillLabel = order.checkoutKind === "support"
                ? "Zaplaceno + přijmout podporu"
                : "Zaplaceno + připsat kredit";

              return (
                <article className={`artales-admin-payment-card${isCancelled ? " artales-admin-payment-card--cancelled" : ""}`} key={order.id}>
                  <div className="artales-admin-payment-card__main">
                    <div>
                      <p className="artales-member-card-label">{getKindLabel(order.checkoutKind)}</p>
                      <h3>{order.formattedAmount}</h3>
                      <p className="artales-member-muted">
                        {formatDate(order.createdAt)} · {order.billingCountry ?? "—"} · {getPaymentRailLabel(order.paymentRail)}
                      </p>
                    </div>
                    <div>
                      <p className="artales-member-card-label">Čtenář</p>
                      <strong>{order.userName ?? order.userEmail ?? "Neznámý účet"}</strong>
                      {order.userHandle ? <span>@{order.userHandle}</span> : null}
                      {order.userEmail ? <span>{order.userEmail}</span> : null}
                    </div>
                    <div>
                      <p className="artales-member-card-label">Párování</p>
                      <strong>VS {order.variableSymbol ?? "—"}</strong>
                      {order.paymentMessage ? <span>{order.paymentMessage}</span> : null}
                      {order.userReportedPaidAt ? <span className="artales-admin-payment-card__flag">Uživatel označil jako zaplaceno</span> : null}
                    </div>
                    <div>
                      <p className="artales-member-card-label">Stav</p>
                      <strong>{getStatusLabel(order.status, order.paymentStatus, order.fulfillmentStatus)}</strong>
                      {order.creditAmount ? <span>{order.creditAmount} kreditů</span> : null}
                      {order.creditReversedAt ? <span className="artales-admin-payment-card__flag">Kredit odečten korekcí</span> : null}
                    </div>
                  </div>

                  <div className="artales-admin-payment-card__actions">
                    {canMarkPaid ? (
                      <form action={markManualQrPaymentPaidAction} className="artales-member-inline-form">
                        <input type="hidden" name="order_id" value={order.id} />
                        <input name="note" placeholder="Poznámka" />
                        <button className="artales-button-secondary" type="submit">Označit jako zaplacené</button>
                      </form>
                    ) : null}
                    {canFulfill ? (
                      <form action={fulfillManualQrPaymentAction} className="artales-member-inline-form">
                        <input type="hidden" name="order_id" value={order.id} />
                        <input name="note" placeholder="Poznámka" />
                        <button className="artales-button-primary" type="submit">{fulfillLabel}</button>
                      </form>
                    ) : null}
                    {canCancel ? (
                      <form action={cancelManualQrPaymentAction} className="artales-member-inline-form">
                        <input type="hidden" name="order_id" value={order.id} />
                        <input name="note" placeholder="Důvod storna" />
                        <button className="artales-button-secondary artales-button-secondary--danger" type="submit">Stornovat</button>
                      </form>
                    ) : (
                      <span className="artales-member-muted">Stornováno</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <nav className="artales-admin-pagination" aria-label="Stránkování plateb">
          {page > 1 ? (
            <Link className="artales-button-secondary" href={`/member/admin/payments?status=${status}&page=${page - 1}`}>Předchozí</Link>
          ) : <span />}
          <span>Strana {page} / {totalPages}</span>
          {page < totalPages ? (
            <Link className="artales-button-secondary" href={`/member/admin/payments?status=${status}&page=${page + 1}`}>Další</Link>
          ) : <span />}
        </nav>
      </section>
    </main>
  );
}
