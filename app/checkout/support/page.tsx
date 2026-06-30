import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { requireCompletedAccountProfile } from "@/lib/account";
import {
  MANUAL_QR_COUNTRIES,
  SUPPORT_PACKAGES,
  formatManualPaymentAmount,
} from "@/lib/manualQrPayments";
import { createSupportOrder } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function getCheckoutError(error: string | undefined) {
  switch (error) {
    case "invalid_package":
      return "Vybraný příspěvek se nepodařilo načíst.";
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

export default async function SupportArtalesPage({ searchParams }: PageProps) {
  await requireCompletedAccountProfile("/checkout/support");
  const params = (await searchParams) ?? {};
  const error = getCheckoutError(params.error);

  return (
    <div className="artales-public-shell">
      <PublicHeader active="gallery" />
      <main className="artales-checkout-coming-soon artales-checkout-qr artales-credit-checkout">
        <p className="artales-product-panel__eyebrow">Podpora ARTales</p>
        <h1>Podpořit literární prostor ARTales</h1>
        <p>
          Podpora není nákup konkrétního díla. Pomáhá s provozem, obálkami, ediční prací, vývojem readeru a přípravou dalších vrstev platformy.
        </p>

        {error ? <div className="artales-account-notice artales-account-notice--error">{error}</div> : null}

        <section className="artales-account-panel artales-qr-eu-note">
          <p className="artales-account-card__label">Bez fulfillmentu</p>
          <h2>Podpora nic automaticky neodemkne</h2>
          <p>
            Platbu v adminu označíme jako přijatou, ale systém k ní nebude vytvářet nárok na dílo. Díky tomu se podpora neplete s objednávkami a kredity.
          </p>
        </section>

        <section className="artales-credit-package-grid" aria-label="Balíčky podpory">
          {SUPPORT_PACKAGES.map((item) => (
            <article key={item.code} className="artales-credit-package-card">
              {item.badge ? <p className="artales-credit-package-card__badge">{item.badge}</p> : null}
              <p className="artales-account-card__label">Podpora</p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{formatManualPaymentAmount(item.amountCents, "EUR")}</strong>
              <form action={createSupportOrder} className="artales-credit-package-card__form">
                <input type="hidden" name="package_code" value={item.code} />
                <label>
                  Země podporovatele
                  <select name="billing_country" defaultValue="CZ" required>
                    {MANUAL_QR_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </label>
                <button className="artales-button" type="submit">Podpořit touto částkou</button>
              </form>
            </article>
          ))}
        </section>

        <div className="artales-account-actions">
          <Link className="artales-button-secondary" href="/checkout/credits">Chci dobít kredit</Link>
          <Link className="artales-button-secondary" href="/account/library">Moje knihovna</Link>
        </div>
      </main>
    </div>
  );
}
