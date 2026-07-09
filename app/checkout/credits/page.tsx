import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {
  CREDIT_TOPUP_PACKAGES,
  getManualQrCountries,
} from "@/lib/manualQrPayments";
import { createCreditTopupOrder } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const copy = {
  cs: {
    eyebrow: "Čtenářský kredit",
    title: "Dobít kredit ARTales",
    intro:
      "Dobij si AT kredity do čtenářské peněženky a používej je postupně pro online čtení, ediční soubory, členství i podporu ARTales. Produkty a členství se pak platí přehledně ze zůstatku účtu.",
    launchLabel: "Platební cesta",
    launchTitle: "QR převod jako dostupná alternativa",
    launchText:
      "Dobití teď probíhá přes QR / bankovní převod. Platební bránu připravíme později jako pohodlnější způsob dobíjení, ale princip zůstane stejný: nejdřív AT peněženka, potom čtení a edice.",
    country: "Země zákazníka",
    submit: "Dobít tento kredit",
    support: "Chci raději podpořit ARTales",
    library: "Moje knihovna",
    credits: "kreditů",
    priceNote: "Částka se podle země připraví na další stránce jako QR / převodní pokyn.",
    errors: {
      invalid_package: "Vybraný balíček kreditu se nepodařilo načíst.",
      unsupported_country: "QR platby jsou teď dostupné pro podporované země v rámci EHP.",
      fallback: "Platební pokyn se nepodařilo vytvořit. Zkus to prosím znovu, nebo nás kontaktuj.",
    },
  },
  en: {
    eyebrow: "Reader credit",
    title: "Top up ARTales credit",
    intro:
      "Top up AT Credits into the reader wallet and use them gradually for online reading, editions, membership and ARTales support. Products and membership are then paid clearly from the account balance.",
    launchLabel: "Payment path",
    launchTitle: "QR transfer as an available alternative",
    launchText:
      "Top-up currently uses QR / bank transfer. A payment gateway can later become the more convenient top-up method, but the principle remains the same: AT wallet first, then reading and editions.",
    country: "Customer country",
    submit: "Top up this credit",
    support: "I would rather support ARTales",
    library: "My library",
    credits: "credits",
    priceNote: "The amount is prepared on the next page as a QR / transfer instruction based on country.",
    errors: {
      invalid_package: "The selected credit package could not be loaded.",
      unsupported_country: "QR payments are currently available for supported countries within the EEA.",
      fallback: "The payment instruction could not be created. Please try again or contact us.",
    },
  },
} as const;

function getCheckoutError(error: string | undefined, locale: "cs" | "en") {
  const t = copy[locale].errors;
  switch (error) {
    case "invalid_package":
      return t.invalid_package;
    case "unsupported_country":
      return t.unsupported_country;
    case "intent_failed":
    case "order_failed":
    case "item_failed":
      return t.fallback;
    default:
      return null;
  }
}

export default async function CreditTopupPage({ searchParams }: PageProps) {
  const [profile, cookieLocale] = await Promise.all([
    requireCompletedAccountProfile("/checkout/credits"),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const t = copy[locale];
  const countries = getManualQrCountries(locale);
  const params = (await searchParams) ?? {};
  const error = getCheckoutError(params.error, locale);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon artales-checkout-qr artales-credit-checkout">
        <p className="artales-product-panel__eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>

        {error ? <div className="artales-account-notice artales-account-notice--error">{error}</div> : null}

        <section className="artales-account-panel artales-qr-eu-note">
          <p className="artales-account-card__label">{t.launchLabel}</p>
          <h2>{t.launchTitle}</h2>
          <p>{t.launchText}</p>
        </section>

        <section className="artales-credit-package-grid" aria-label={t.eyebrow}>
          {CREDIT_TOPUP_PACKAGES.map((item) => (
            <article key={item.code} className="artales-credit-package-card">
              {item.badge ? <p className="artales-credit-package-card__badge">{item.badge}</p> : null}
              <p className="artales-account-card__label">{item.creditAmount} {t.credits}</p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{item.creditAmount} {t.credits}</strong>
              <p className="artales-member-muted">{t.priceNote}</p>
              <form action={createCreditTopupOrder} className="artales-credit-package-card__form">
                <input type="hidden" name="package_code" value={item.code} />
                <label>
                  {t.country}
                  <select name="billing_country" defaultValue="CZ" required>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </label>
                <button className="artales-button" type="submit">{t.submit}</button>
              </form>
            </article>
          ))}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button-secondary" href="/credits">{locale === "cs" ? "Jak fungují AT kredity" : "How AT Credits work"}</Link>
          <Link className="artales-button-secondary" href="/checkout/support">{t.support}</Link>
          <Link className="artales-button-secondary" href="/account/library">{t.library}</Link>
        </div>
      </main>
    </div>
  );
}
