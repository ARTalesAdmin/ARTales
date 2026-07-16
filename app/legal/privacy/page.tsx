import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy · ARTales",
};

export default async function PrivacyPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  return (
    <div className="artales-public-shell">
      <PublicHeader active="legal" />

      <main className="artales-public-main artales-legal-main">
        <p className="artales-legal-back"><Link href="/legal">{isCs ? "← Zpět na informace" : "← Back to information"}</Link></p>

        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales</p>
          <h1>{isCs ? "Soukromí" : "Privacy"}</h1>

          {isCs ? (
            <>
              <p>
                ARTales používá pouze takové údaje, které jsou potřebné pro provoz platformy, čtenářských účtů, přístupů,
                bezpečnosti a základní analytiky.
              </p>
              <h2>Údaje účtu</h2>
              <p>
                Pokud si vytvoříte účet, platforma může zpracovávat e-mail, profilové údaje, roli účtu, čtenářská oprávnění,
                uložená díla, historii přístupů a technické údaje potřebné k zabezpečení.
              </p>
              <h2>Analytika a provoz</h2>
              <p>
                Platforma může zaznamenávat technické události, návštěvy stránek a chyby, aby bylo možné zlepšovat výkon,
                čitelnost a stabilitu služby.
              </p>
              <h2>Prodej dat</h2>
              <p>
                ARTales neprodává osobní údaje inzerentům. Data používáme pro provoz a rozvoj vlastní služby.
              </p>
              <h2>Kontakt k údajům</h2>
              <p>
                Kvůli dotazům, opravě nebo odstranění údajů nám napište na info@artales.net nebo přes kontaktní stránku.
              </p>
            </>
          ) : (
            <>
              <p>
                ARTales uses only the data needed to operate the platform, reader accounts, access rights, security and basic
                analytics.
              </p>
              <h2>Account data</h2>
              <p>
                If you create an account, the platform may process your email, profile details, account role, reader
                permissions, saved works, access history and technical data needed for security.
              </p>
              <h2>Analytics and operation</h2>
              <p>
                The platform may record technical events, page visits and errors to improve performance, readability and
                service stability.
              </p>
              <h2>Data sale</h2>
              <p>
                ARTales does not sell personal data to advertisers. Data is used to operate and improve the service.
              </p>
              <h2>Data contact</h2>
              <p>
                For questions, corrections or deletion requests, write to info@artales.net or use the contact page.
              </p>
            </>
          )}
        </article>
      </main>
    </div>
  );
}
