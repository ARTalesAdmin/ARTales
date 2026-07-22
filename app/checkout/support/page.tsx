import { randomUUID } from "crypto";
import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import {
  SUPPORT_PACKAGES,
  formatManualPaymentAmount,
  getManualQrCountries,
} from "@/lib/manualQrPayments";
import SubmitOnceButton from "@/components/checkout/SubmitOnceButton";
import { createSupportOrder } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const copy = {
  cs: {
    eyebrow: "Přímá podpora ARTales",
    title: "Podpořit ARTales přímo",
    intro:
      "Tato stránka je pro čtenáře, kteří chtějí poslat podporu přímo, bez převodu už dobitého kreditu. Pokud už máš AT kredity na účtu, čistší cesta je darovat část z nich v účtu kreditu.",
    noFulfillmentLabel: "Dobrovolná podpora",
    noFulfillmentTitle: "Nejde o nákup titulu ani členství",
    noFulfillmentText:
      "Přímá podpora pomáhá financovat ediční práci, obálky, čtečku a další vrstvy ARTales. Po potvrzení se započítá do mecenášské stopy účtu stejně jako darovaný kredit.",
    country: "Země podporovatele",
    submit: "Vytvořit QR pokyn",
    submitPending: "Připravuji QR pokyn…",
    credit: "Raději dobít kredit",
    library: "Moje knihovna",
    supportLabel: "Přímá podpora",
    priceNote: "Pro Česko se platba na další stránce převede do CZK QR platby.",
    errors: {
      invalid_package: "Vybraný příspěvek se nepodařilo načíst.",
      unsupported_country: "QR platby jsou teď dostupné pro podporované země v rámci EHP.",
      fallback: "Platební pokyn se nepodařilo vytvořit. Zkus to prosím znovu, nebo nás kontaktuj.",
    },
  },
  en: {
    eyebrow: "Direct ARTales support",
    title: "Support ARTales directly",
    intro:
      "This page is for readers who want to send support directly, without gifting already topped-up credit. If you already have AT Credits in your account, the cleaner path is gifting part of them from the credit account.",
    noFulfillmentLabel: "Voluntary support",
    noFulfillmentTitle: "Not a title purchase or membership",
    noFulfillmentText:
      "Direct support helps fund editorial work, covers, reader development and the next ARTales layers. Once confirmed, it counts toward the account patronage trail just like gifted credit.",
    country: "Supporter country",
    submit: "Create QR instruction",
    submitPending: "Preparing QR instruction…",
    credit: "Top up credit instead",
    library: "My library",
    supportLabel: "Direct support",
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
                <input type="hidden" name="submission_key" value={`${item.code}-${randomUUID()}`} />
                <label>
                  {t.country}
                  <select name="billing_country" defaultValue="CZ" required>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </label>
                <SubmitOnceButton pendingLabel={t.submitPending}>{t.submit}</SubmitOnceButton>
              </form>
            </article>
          ))}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button-secondary" href="/account/credits#support">{locale === "cs" ? "Darovat z kreditu" : "Gift from credit"}</Link>
          <Link className="artales-button-secondary" href="/checkout/credits">{t.credit}</Link>
          <Link className="artales-button-secondary" href="/credits">{locale === "cs" ? "Jak fungují AT kredity" : "How AT Credits work"}</Link>
          <Link className="artales-button-secondary" href="/account/library">{t.library}</Link>
        </div>
      </main>
    </div>
  );
}
