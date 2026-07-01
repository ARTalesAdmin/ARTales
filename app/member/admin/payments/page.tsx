import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { listManualQrAdminOrders } from "@/lib/manualQrAdmin";
import { fulfillManualQrPaymentAction, markManualQrPaymentPaidAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNotice(searchParams: Record<string, string | string[] | undefined>) {
  const success = firstParam(searchParams.success);
  const error = firstParam(searchParams.error);

  if (success === "marked_paid") return { type: "success", text: "Platba byla označena jako zaplacená. Fulfillment můžeš provést samostatně." };
  if (success === "fulfilled") return { type: "success", text: "Platba byla označena jako zaplacená a nárok byl vyřízen." };
  if (success === "already_fulfilled") return { type: "success", text: "Objednávka už byla vyřízená, nic se neduplikovalo." };

  if (error === "missing_order") return { type: "error", text: "Chybí objednávka." };
  if (error === "mark_paid_failed") return { type: "error", text: "Platbu se nepodařilo označit jako zaplacenou." };
  if (error === "fulfillment_failed") return { type: "error", text: "Fulfillment se nepodařilo provést. Zkontroluj typ objednávky a metadata kreditu." };

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
  if (status === "fulfilled" || fulfillmentStatus === "fulfilled") return "Vyřízeno";
  if (paymentStatus === "paid") return "Zaplaceno · čeká fulfillment";
  return "Čeká na platbu";
}

export default async function ManualQrPaymentsAdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = getNotice(resolvedSearchParams);
  const orders = await listManualQrAdminOrders();
  const pendingCount = orders.filter((order) => order.paymentStatus !== "paid" && order.status !== "fulfilled").length;
  const fulfillmentCount = orders.filter((order) => order.paymentStatus === "paid" && order.fulfillmentStatus !== "fulfilled" && order.status !== "fulfilled").length;

  return (
    <main className="artales-admin-dashboard">
      <div className="artales-admin-dashboard__header">
        <div>
          <p className="artales-admin-dashboard__eyebrow">Admin · ruční QR platby</p>
          <h1>Platby a fulfillment</h1>
          <p>
            Tady spáruješ QR platby podle VS a po kontrole v bance připíšeš kredit nebo označíš podporu jako přijatou.
            Tato stránka je launch mezivrstva před platební bránou.
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
          <span>spárovat v bance podle VS</span>
        </article>
        <article className="artales-admin-stat-card">
          <p>Čeká fulfillment</p>
          <strong>{fulfillmentCount}</strong>
          <span>zaplaceno, ale ještě nepřipsáno</span>
        </article>
        <article className="artales-admin-stat-card">
          <p>Posledních záznamů</p>
          <strong>{orders.length}</strong>
          <span>limit 100 QR objednávek</span>
        </article>
      </section>

      <section className="artales-member-panel artales-admin-dashboard__panel artales-admin-dashboard__wide-panel">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <h2>Ruční QR platby</h2>
            <p>
              Akce „Zaplaceno + vyřídit“ u kreditu připíše kredit do ledgeru. U podpory pouze označí platbu jako přijatou bez čtenářského nároku.
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <p>Zatím nejsou žádné ruční QR objednávky.</p>
        ) : (
          <div className="artales-admin-table-wrap">
            <table className="artales-admin-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Čtenář</th>
                  <th>Platba</th>
                  <th>VS</th>
                  <th>Stav</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isFulfilled = order.status === "fulfilled" || order.fulfillmentStatus === "fulfilled";
                  const isPaid = order.paymentStatus === "paid" || isFulfilled;
                  const canMarkPaid = !isPaid;
                  const canFulfill = !isFulfilled;
                  const fulfillLabel = order.checkoutKind === "support"
                    ? "Zaplaceno + přijmout podporu"
                    : "Zaplaceno + připsat kredit";

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{formatDate(order.createdAt)}</strong>
                        <br />
                        <span className="artales-member-muted">{order.billingCountry ?? "—"} · {getPaymentRailLabel(order.paymentRail)}</span>
                      </td>
                      <td>
                        <strong>{order.userName ?? order.userEmail ?? "Neznámý účet"}</strong>
                        {order.userHandle ? <><br /><span className="artales-member-muted">@{order.userHandle}</span></> : null}
                        {order.userEmail ? <><br /><span className="artales-member-muted">{order.userEmail}</span></> : null}
                      </td>
                      <td>
                        <strong>{order.formattedAmount}</strong>
                        <br />
                        <span>{getKindLabel(order.checkoutKind)}</span>
                        {order.creditAmount ? <><br /><span className="artales-member-muted">{order.creditAmount} kreditů</span></> : null}
                      </td>
                      <td>
                        <strong>{order.variableSymbol ?? "—"}</strong>
                        {order.paymentMessage ? <><br /><span className="artales-member-muted">{order.paymentMessage}</span></> : null}
                      </td>
                      <td>{getStatusLabel(order.status, order.paymentStatus, order.fulfillmentStatus)}</td>
                      <td>
                        <div className="artales-member-list-actions">
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
                          ) : (
                            <span className="artales-member-muted">Hotovo</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
