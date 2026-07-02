import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {
  SUPPORT_PACKAGES,
  formatManualPaymentAmount,
  getManualQrCountries,
} from "@/lib/manualQrPayments";
import { createSupportOrder } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const copy = {
  cs: {
    eyebrow: "Podpora ARTales",
    title: "Podpořit literární prostor ARTales",
    intro:
      "Podpora není nákup konkrétního díla. Pomáhá s provozem, obálkami, ediční prací, vývojem readeru a přípravou dalších vrstev platformy.",
    noFulfillmentLabel: "Podpora projektu",
    noFulfillmentTitle: "Příspěvek pro rozvoj ARTales",
    noFulfillmentText:
      "Podpora je dobrovolný příspěvek na literární prostor ARTales. Nejde o nákup konkrétního titulu; po připsání platby ji zaevidujeme jako podporu projektu.",
    country: "Země podporovatele",
    submit: "Podpořit touto částkou",
    credit: "Chci dobít kredit",
    library: "Moje knihovna",
    supportLabel: "Podpora",
    priceNote: "Pro Česko se platba na další stránce převede do CZK QR platby.",
    errors: {
      invalid_package: "Vybraný příspěvek se nepodařilo načíst.",
      unsupported_country: "QR platby jsou teď dostupné pro podporované země v rámci EHP.",
      fallback: "Platební pokyn se nepodařilo vytvořit. Zkus to prosím znovu, nebo nás kontaktuj.",
    },
  },
  en: {
    eyebrow: "Support ARTales",
    title: "Support the ARTales literary space",
    intro:
      "Support is not a purchase of a specific work. It helps cover operations, covers, editorial work, reader development, and the next layers of the platform.",
    noFulfillmentLabel: "Project support",
    noFulfillmentTitle: "A contribution to ARTales",
    noFulfillmentText:
      "Support is a voluntary contribution to the ARTales literary space. It is not a purchase of a specific title; after the payment arrives, we record it as project support.",
    country: "Supporter country",
    submit: "Support with this amount",
    credit: "I want to top up credit",
    library: "My library",
    supportLabel: "Support",
    priceNote: "For Czechia, the next page converts the payment into a CZK Czech QR payment.",
    errors: {
      invalid_package: "The selected support amount could not be loaded.",
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

export default async function SupportArtalesPage({ searchParams }: PageProps) {
  const [profile, cookieLocale] = await Promise.all([
    requireCompletedAccountProfile("/checkout/support"),
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
          <p className="artales-account-card__label">{t.noFulfillmentLabel}</p>
          <h2>{t.noFulfillmentTitle}</h2>
          <p>{t.noFulfillmentText}</p>
        </section>

        <section className="artales-credit-package-grid" aria-label={t.eyebrow}>
          {SUPPORT_PACKAGES.map((item) => (
            <article key={item.code} className="artales-credit-package-card">
              {item.badge ? <p className="artales-credit-package-card__badge">{item.badge}</p> : null}
              <p className="artales-account-card__label">{t.supportLabel}</p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{formatManualPaymentAmount(item.amountCents, "EUR")}</strong>
              <p className="artales-member-muted">{t.priceNote}</p>
              <form action={createSupportOrder} className="artales-credit-package-card__form">
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
          <Link className="artales-button-secondary" href="/checkout/credits">{t.credit}</Link>
          <Link className="artales-button-secondary" href="/account/library">{t.library}</Link>
        </div>
      </main>
    </div>
  );
}
