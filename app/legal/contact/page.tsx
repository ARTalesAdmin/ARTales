import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact · ARTales",
};

export default async function ContactPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  return (
    <div className="artales-public-shell">
      <PublicHeader active="legal" />

      <main className="artales-public-main artales-legal-main">
        <p className="artales-legal-back"><Link href="/legal">{isCs ? "← Zpět na informace" : "← Back to information"}</Link></p>

        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales</p>
          <h1>{isCs ? "Kontakt" : "Contact"}</h1>

          {isCs ? (
            <>
              <p>
                Pro běžné dotazy, náměty na tituly, opravy metadat, upozornění na chyby, právní připomínky nebo spolupráci použijte tento kontaktní e-mail:
              </p>
              <p className="artales-legal-contact">
                <a href="mailto:info@artales.net">info@artales.net</a>
              </p>
              <h2>Co prosím přiložit</h2>
              <p>
                U opravy díla ideálně pošlete název díla, odkaz na stránku, popis problému a případný zdroj nebo doporučenou opravu. U námětu na nový titul stačí napsat autora, název a proč by podle vás měl být v knihovně ARTales.
              </p>
            </>
          ) : (
            <>
              <p>
                For general questions, title requests, metadata corrections, error reports, rights notices or collaboration, use this contact e-mail:
              </p>
              <p className="artales-legal-contact">
                <a href="mailto:info@artales.net">info@artales.net</a>
              </p>
              <h2>What to include</h2>
              <p>
                For work corrections, please include the work title, page link, issue description and, if available, a source or suggested correction. For a new title request, the author, title and reason why it belongs in ARTales are enough.
              </p>
            </>
          )}
        </article>
      </main>
    </div>
  );
}
