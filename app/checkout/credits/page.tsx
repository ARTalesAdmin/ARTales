import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import {
  CREDIT_TOPUP_PACKAGES,
  MANUAL_QR_COUNTRIES,
  formatManualPaymentAmount,
} from "@/lib/manualQrPayments";
import { createCreditTopupOrder } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function getCheckoutError(error: string | undefined) {
  switch (error) {
    case "invalid_package":
      return "Vybraný balíček kreditu se nepodařilo načíst.";
    case "unsupported_country":
      return "Pro launch zatím přijímáme QR platby pouze od zákazníků z EU / OSS režimu.";
    case "intent_failed":
    case "order_failed":
    case "item_failed":
      return "Platební pokyn se nepodařilo vytvořit. Zkus to prosím znovu, nebo nás kontaktuj.";
    default:
      return null;
  }
}

export default async function CreditTopupPage({ searchParams }: PageProps) {
  await requireCompletedAccountProfile("/checkout/credits");
  const params = (await searchParams) ?? {};
  const error = getCheckoutError(params.error);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon artales-checkout-qr artales-credit-checkout">
        <p className="artales-product-panel__eyebrow">Čtenářský kredit</p>
        <h1>Dobít kredit ARTales</h1>
        <p>
          Dobij si kredit jednou QR platbou a používej ho později na online čtení, edice, členství nebo další služby ARTales.
          V launch fázi platbu ručně zkontrolujeme a kredit připíšeme k tvému účtu.
        </p>

        {error ? <div className="artales-account-notice artales-account-notice--error">{error}</div> : null}

        <section className="artales-account-panel artales-qr-eu-note">
          <p className="artales-account-card__label">Launch omezení</p>
          <h2>Zatím EU / OSS režim</h2>
          <p>
            Kvůli jednoduchému účetnímu a daňovému startu zatím přijímáme ruční QR platby jen od zákazníků z EU.
            Země se uloží k objednávce jako podklad pro budoucí účetní export.
          </p>
        </section>

        <section className="artales-credit-package-grid" aria-label="Balíčky kreditu">
          {CREDIT_TOPUP_PACKAGES.map((item) => (
            <article key={item.code} className="artales-credit-package-card">
              {item.badge ? <p className="artales-credit-package-card__badge">{item.badge}</p> : null}
              <p className="artales-account-card__label">{item.creditAmount} kreditů</p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{formatManualPaymentAmount(item.amountCents, "EUR")}</strong>
              <form action={createCreditTopupOrder} className="artales-credit-package-card__form">
                <input type="hidden" name="package_code" value={item.code} />
                <label>
                  Země zákazníka
                  <select name="billing_country" defaultValue="CZ" required>
                    {MANUAL_QR_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </label>
                <button className="artales-button" type="submit">Dobít tento kredit</button>
              </form>
            </article>
          ))}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button-secondary" href="/checkout/support">Chci raději podpořit ARTales</Link>
          <Link className="artales-button-secondary" href="/account/library">Moje knihovna</Link>
        </div>
      </main>
    </div>
  );
}
