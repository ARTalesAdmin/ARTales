import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import {
  formatManualPaymentAmount,
  getManualQrOrderSummary,
  getManualQrPaymentConfig,
} from "@/lib/manualQrPayments";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ order?: string }>;
};

function getKindLabel(kind: string) {
  return kind === "support" ? "Podpora ARTales" : "Dobití kreditu";
}

export default async function ManualQrCheckoutPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const profile = await requireCompletedAccountProfile(
    params.order ? `/checkout/qr?order=${encodeURIComponent(params.order)}` : "/checkout/credits"
  );

  if (!params.order) notFound();

  const [order, config] = await Promise.all([
    getManualQrOrderSummary(profile.id, params.order),
    Promise.resolve(getManualQrPaymentConfig()),
  ]);

  if (!order) notFound();

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon artales-checkout-qr">
        <p className="artales-product-panel__eyebrow">QR platba</p>
        <h1>Platební pokyn je připravený</h1>
        <p>
          Naskenuj QR kód v bankovní aplikaci. Částka, variabilní symbol a zpráva pro příjemce jsou součástí QR kódu.
          Po připsání platby ji ručně zkontrolujeme a v adminu vyřídíme odpovídající krok.
        </p>

        <section className="artales-qr-payment-grid">
          <article className="artales-qr-payment-card artales-qr-payment-card--highlight">
            <p className="artales-account-card__label">Typ platby</p>
            <strong>{getKindLabel(order.kind)}</strong>
            <span>{order.item?.title ?? "ARTales platba"}</span>
          </article>

          <article className="artales-qr-payment-card">
            <p className="artales-account-card__label">Částka</p>
            <strong>{formatManualPaymentAmount(order.totalAmountCents, order.currency)}</strong>
            <span>{order.billingCountry ? `Země: ${order.billingCountry}` : "EU / OSS launch režim"}</span>
          </article>

          <article className="artales-qr-payment-card">
            <p className="artales-account-card__label">Variabilní symbol</p>
            <strong>{order.variableSymbol}</strong>
            <span>Zpráva: {order.paymentMessage}</span>
          </article>
        </section>

        <section className="artales-account-panel artales-qr-payment-panel">
          <div>
            <p className="artales-account-card__label">Platební údaje</p>
            <h2>{config.accountName}</h2>
            {config.bankName ? <p>{config.bankName}</p> : null}
            {config.accountNumber ? <p>Účet: <strong>{config.accountNumber}</strong></p> : null}
            {config.iban ? <p>IBAN: <strong>{config.iban}</strong></p> : null}
            {config.bic ? <p>BIC/SWIFT: <strong>{config.bic}</strong></p> : null}
            <p>{config.note}</p>
          </div>

          {config.isConfigured && order.qrPayload ? (
            <div className="artales-qr-payment-image">
              <Image src={order.qrImageUrl} alt="Dynamický QR kód pro platbu ARTales" width={240} height={240} unoptimized />
              <p>QR je vytvořený pro tuto konkrétní platbu. Přesto prosím v bance zkontroluj částku a variabilní symbol.</p>
            </div>
          ) : (
            <div className="artales-qr-payment-image artales-qr-payment-image--empty">
              <strong>QR zatím nelze vygenerovat</strong>
              <p>Pro dynamické QR je potřeba nastavit IBAN. Do té doby použij údaje výše ručně.</p>
            </div>
          )}
        </section>

        {!config.isConfigured ? (
          <div className="artales-account-notice artales-account-notice--error">
            Chybí platební konfigurace. Pro produkci nastav alespoň ARTALES_QR_IBAN.
          </div>
        ) : null}

        <section className="artales-account-panel">
          <p className="artales-account-card__label">Ruční kontrola</p>
          <h2>Co se stane po platbě?</h2>
          {order.kind === "support" ? (
            <p>
              Podporu po přijetí označíme v adminu jako přijatou. Neotevírá žádné konkrétní dílo ani kredit, ale pomáhá financovat ARTales.
            </p>
          ) : (
            <p>
              Kredit po připsání platby ručně připíšeme k tvému účtu. Potom ho bude možné použít v dalších placených vrstvách ARTales.
            </p>
          )}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button" href="/account/library">Moje knihovna</Link>
          <Link className="artales-button-secondary" href="/checkout/credits">Dobít další kredit</Link>
          <Link className="artales-button-secondary" href="/checkout/support">Podpořit ARTales</Link>
        </div>
      </main>
    </div>
  );
}
