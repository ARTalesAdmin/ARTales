import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";
import { MEMBERSHIP_PRICEBOOK } from "@/lib/memberPricebook";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AT Credits · ARTales",
};

export default async function CreditsInfoPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  const cards = isCs
    ? [
        {
          label: "01",
          title: "Dobiješ jednou, používáš postupně",
          text: "AT kredit je univerzální hodnota účtu. Hodí se pro trvalá online odemčení, PDF/EPUB edice, členství, podporu ARTales a pozdější služby.",
        },
        {
          label: "02",
          title: "Online přístup zlevní další formáty",
          text: "Když máš titul trvale odemčený online, navazující PDF nebo EPUB téhož díla stojí 1 AT místo 2 AT. Balíček PDF + EPUB stojí 2 AT místo 3 AT.",
        },
        {
          label: "03",
          title: "Podpora má vlastní stopu",
          text: `Libovolná podpora se započítává do mecenášské stopy účtu. Patron začíná od ${MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT celkové podpory, Mecenáš od ${MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT.`,
        },
      ]
    : [
        {
          label: "01",
          title: "Top up once, use gradually",
          text: "AT Credit is the universal value in your account. Use it for permanent online unlocks, PDF/EPUB editions, membership, ARTales support, and later services.",
        },
        {
          label: "02",
          title: "Online access lowers edition prices",
          text: "When you permanently unlock a title online, the related PDF or EPUB edition costs 1 AT instead of 2 AT. The PDF + EPUB bundle costs 2 AT instead of 3 AT.",
        },
        {
          label: "03",
          title: "Support has its own trail",
          text: `Any support contributes to the account's patronage trail. Patron begins at ${MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT of total support; Benefactor begins at ${MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT.`,
        },
      ];

  return (
    <div className="artales-public-shell">
      <PublicHeader active="credits" />
      <main className="artales-public-main artales-legal-main">
        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales Credits</p>
          <h1>{isCs ? "AT kredity" : "AT Credits"}</h1>
          <p>
            {isCs
              ? "AT kredity jsou jednoduchý způsob, jak v ARTales platit za čtenářský přístup, doplňkové edice, členství a podporu projektu. Jsou navázané na účet a mají přehlednou historii."
              : "AT Credits are a simple way to pay for reader access, related editions, membership, and project support in ARTales. They are tied to your account and have a clear history."}
          </p>

          <div className="artales-account-model-grid">
            {cards.map((card) => (
              <article key={card.label}>
                <p className="artales-account-card__label">{card.label}</p>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </article>
            ))}
          </div>

          <h2>{isCs ? "Základní ceník" : "Base pricebook"}</h2>
          <ul>
            <li>{isCs ? "trvalé online odemčení titulu — 1 AT," : "permanent online unlock — 1 AT,"}</li>
            <li>{isCs ? "PDF nebo EPUB edice — 2 AT," : "PDF or EPUB edition — 2 AT,"}</li>
            <li>{isCs ? "PDF + EPUB balíček — 3 AT," : "PDF + EPUB bundle — 3 AT,"}</li>
            <li>{isCs ? "po trvalém online odemčení stojí PDF/EPUB téhož díla výhodněji." : "after a permanent online unlock, PDF/EPUB for the same work costs less."}</li>
          </ul>

          <h2>{isCs ? "Členství a podpora" : "Membership and support"}</h2>
          <p>
            {isCs
              ? "Členství bude používat AT kredity, ale členská online odemčení nejsou běžné kredity. Bonusové AT kredity ze členství naopak běžnými kredity jsou. Podpora ARTales je oddělená a počítá se do patronátní stopy účtu."
              : "Membership will use AT Credits, but member online unlocks are not regular credit. Bonus AT Credits granted by membership are regular credit. ARTales support is separate and contributes to the account's patronage trail."}
          </p>

          <div className="artales-account-actions">
            <Link className="artales-button" href="/checkout/credits">
              {isCs ? "Dobít AT kredity" : "Top up AT Credits"}
            </Link>
            <Link className="artales-button-secondary" href="/account/membership">
              {isCs ? "Zobrazit členství" : "View membership"}
            </Link>
            <Link className="artales-button-secondary" href="/checkout/support">
              {isCs ? "Podpořit ARTales" : "Support ARTales"}
            </Link>
            <Link className="artales-button-secondary" href="/hall">
              {isCs ? "Síň ARTales" : "ARTales Hall"}
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
