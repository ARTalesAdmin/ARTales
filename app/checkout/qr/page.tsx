import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {
  formatManualPaymentAmount,
  getManualQrOrderSummary,
  getManualQrPaymentConfig,
} from "@/lib/manualQrPayments";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ order?: string }>;
};

const copy = {
  cs: {
    eyebrow: "QR platba",
    title: "Platební pokyn je připravený",
    intro:
      "Naskenuj QR kód v bankovní aplikaci. Částka, variabilní symbol a zpráva pro příjemce jsou součástí QR kódu. Po připsání platby ji ručně zkontrolujeme a v adminu vyřídíme odpovídající krok.",
    type: "Typ platby",
    amount: "Částka",
    country: "Země",
    launch: "EU / OSS launch režim",
    vs: "Variabilní symbol",
    message: "Zpráva",
    paymentDetails: "Platební údaje",
    account: "Účet",
    iban: "IBAN",
    qrAlt: "Dynamický QR kód pro platbu ARTales",
    qrReady: "QR je vytvořený pro tuto konkrétní platbu. Přesto prosím v bance zkontroluj částku a variabilní symbol.",
    qrMissingTitle: "QR zatím nelze vygenerovat",
    qrMissingText: "Pro dynamické QR je potřeba nastavit IBAN. Do té doby použij údaje výše ručně.",
    configMissing: "Chybí platební konfigurace. Pro produkci nastav alespoň ARTALES_QR_IBAN.",
    manualCheck: "Ruční kontrola",
    whatNext: "Co se stane po platbě?",
    supportNext:
      "Podporu po přijetí označíme v adminu jako přijatou. Neotevírá žádné konkrétní dílo ani kredit, ale pomáhá financovat ARTales.",
    creditNext:
      "Kredit po připsání platby ručně připíšeme k tvému účtu. Potom ho bude možné použít v dalších placených vrstvách ARTales.",
    library: "Moje knihovna",
    moreCredit: "Dobít další kredit",
    support: "Podpořit ARTales",
    railCz: "Česká QR platba · CZK",
    railSepa: "SEPA QR platba · EUR",
    railGeneric: "QR platba",
  },
  en: {
    eyebrow: "QR payment",
    title: "Your payment instruction is ready",
    intro:
      "Scan the QR code in your banking app. The amount, variable symbol, and payment message are included in the QR code. After the payment arrives, we manually check it and complete the matching admin step.",
    type: "Payment type",
    amount: "Amount",
    country: "Country",
    launch: "EU / OSS launch mode",
    vs: "Variable symbol",
    message: "Message",
    paymentDetails: "Payment details",
    account: "Account",
    iban: "IBAN",
    qrAlt: "Dynamic ARTales payment QR code",
    qrReady: "This QR code is generated for this specific payment. Please still check the amount and variable symbol in your banking app.",
    qrMissingTitle: "QR cannot be generated yet",
    qrMissingText: "Dynamic QR requires IBAN configuration. Until then, use the manual payment details above.",
    configMissing: "Payment configuration is missing. For production, set at least ARTALES_QR_IBAN.",
    manualCheck: "Manual check",
    whatNext: "What happens after payment?",
    supportNext:
      "After we receive it, support is marked as received in the admin area. It does not unlock a specific work or credit, but it helps fund ARTales.",
    creditNext:
      "After the payment arrives, we manually add credit to your account. You can then use it in future paid ARTales layers.",
    library: "My library",
    moreCredit: "Top up more credit",
    support: "Support ARTales",
    railCz: "Czech QR payment · CZK",
    railSepa: "SEPA QR payment · EUR",
    railGeneric: "QR payment",
  },
} as const;

function getKindLabel(kind: string, locale: "cs" | "en") {
  if (locale === "en") return kind === "support" ? "Support ARTales" : "Credit top-up";
  return kind === "support" ? "Podpora ARTales" : "Dobití kreditu";
}

function getPaymentRailLabel(paymentRail: string | null, locale: "cs" | "en") {
  const t = copy[locale];
  if (paymentRail === "cz_domestic_qr") return t.railCz;
  if (paymentRail === "sepa_qr") return t.railSepa;
  return t.railGeneric;
}

export default async function ManualQrCheckoutPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const [profile, cookieLocale] = await Promise.all([
    requireCompletedAccountProfile(
      params.order ? `/checkout/qr?order=${encodeURIComponent(params.order)}` : "/checkout/credits"
    ),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const t = copy[locale];

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
        <p className="artales-product-panel__eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>

        <section className="artales-qr-payment-grid">
          <article className="artales-qr-payment-card artales-qr-payment-card--highlight">
            <p className="artales-account-card__label">{t.type}</p>
            <strong>{getKindLabel(order.kind, locale)}</strong>
            <span>{order.item?.title ?? "ARTales"}</span>
          </article>

          <article className="artales-qr-payment-card">
            <p className="artales-account-card__label">{t.amount}</p>
            <strong>{formatManualPaymentAmount(order.totalAmountCents, order.currency)}</strong>
            <span>{order.billingCountry ? `${t.country}: ${order.billingCountry}` : t.launch}</span>
          </article>

          <article className="artales-qr-payment-card">
            <p className="artales-account-card__label">{getPaymentRailLabel(order.paymentRail, locale)}</p>
            <strong>{order.variableSymbol}</strong>
            <span>{t.message}: {order.paymentMessage}</span>
          </article>
        </section>

        <section className="artales-account-panel artales-qr-payment-panel">
          <div>
            <p className="artales-account-card__label">{t.paymentDetails}</p>
            <h2>{config.accountName}</h2>
            {config.bankName ? <p>{config.bankName}</p> : null}
            {config.accountNumber ? <p>{t.account}: <strong>{config.accountNumber}</strong></p> : null}
            {config.iban ? <p>{t.iban}: <strong>{config.iban}</strong></p> : null}
            {config.bic ? <p>BIC/SWIFT: <strong>{config.bic}</strong></p> : null}
            <p>{config.note}</p>
          </div>

          {config.isConfigured && order.qrPayload ? (
            <div className="artales-qr-payment-image">
              <Image src={order.qrImageUrl} alt={t.qrAlt} width={240} height={240} unoptimized />
              <p>{t.qrReady}</p>
            </div>
          ) : (
            <div className="artales-qr-payment-image artales-qr-payment-image--empty">
              <strong>{t.qrMissingTitle}</strong>
              <p>{t.qrMissingText}</p>
            </div>
          )}
        </section>

        {!config.isConfigured ? (
          <div className="artales-account-notice artales-account-notice--error">
            {t.configMissing}
          </div>
        ) : null}

        <section className="artales-account-panel">
          <p className="artales-account-card__label">{t.manualCheck}</p>
          <h2>{t.whatNext}</h2>
          {order.kind === "support" ? <p>{t.supportNext}</p> : <p>{t.creditNext}</p>}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button" href="/account/library">{t.library}</Link>
          <Link className="artales-button-secondary" href="/checkout/credits">{t.moreCredit}</Link>
          <Link className="artales-button-secondary" href="/checkout/support">{t.support}</Link>
        </div>
      </main>
    </div>
  );
}
