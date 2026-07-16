import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms of use · ARTales",
};

export default async function TermsPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  return (
    <div className="artales-public-shell">
      <PublicHeader active="legal" />

      <main className="artales-public-main artales-legal-main">
        <p className="artales-legal-back"><Link href="/legal">{isCs ? "← Zpět na informace" : "← Back to information"}</Link></p>

        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales</p>
          <h1>{isCs ? "Podmínky užití" : "Terms of use"}</h1>

          {isCs ? (
            <>
              <p>Tyto podmínky jsou základním provozním minimem pro používání platformy ARTales.</p>
              <h2>Používání platformy</h2>
              <p>
                Platformu používejte způsobem, který nepoškozuje její provoz, ostatní uživatele, autory ani dostupný obsah.
                Není dovoleno obcházet přístupová omezení, zneužívat účty nebo automatizovaně stahovat obsah mimo běžné
                čtenářské použití.
              </p>
              <h2>Obsah a dostupnost</h2>
              <p>
                ARTales může obsah upravovat, přesouvat, dočasně skrýt nebo stáhnout, zejména kvůli opravám, licenčním
                otázkám, technickým problémům nebo edičnímu vývoji.
              </p>
              <h2>Čtenářské účty</h2>
              <p>
                U účtů a čtenářských oprávnění se mohou lišit dostupné funkce, délka přístupu a typ obsahu. Přístup k
                vybranému obsahu není převoditelný na jiné osoby.
              </p>
              <h2>Bez záruky úplnosti</h2>
              <p>
                ARTales připravuje a zpřístupňuje obsah průběžně. Pokud narazíte na chybu, nejasné metadata nebo problém se zdrojem, napište nám na info@artales.net. Platforma neposkytuje právní, akademickou ani archivní garanci úplnosti.
              </p>
            </>
          ) : (
            <>
              <p>These terms are a basic operational minimum for using the ARTales platform.</p>
              <h2>Use of the platform</h2>
              <p>
                Use the platform in a way that does not harm its operation, other users, authors or available content. Do
                not bypass access restrictions, misuse accounts or automatically download content beyond ordinary reader use.
              </p>
              <h2>Content and availability</h2>
              <p>
                ARTales may edit, move, temporarily hide or remove content, especially because of corrections, rights issues,
                technical problems or editorial development.
              </p>
              <h2>Reader accounts</h2>
              <p>
                Account features and reader permissions may differ by access type, duration and content. Access to selected
                content is not transferable to other people.
              </p>
              <h2>No completeness guarantee</h2>
              <p>
                ARTales prepares and publishes content continuously. If you notice an error, unclear metadata or a source issue, write to info@artales.net. The platform does not provide legal, academic or archival guarantees of completeness.
              </p>
            </>
          )}
        </article>
      </main>
    </div>
  );
}
