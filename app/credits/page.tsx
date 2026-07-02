import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

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
          title: "Jedna hodnota v účtu",
          text: "AT kredit je čtenářská hodnota ARTales. Dobiješ ho jednou a potom ho používáš pro přístup k titulům, edicím, členství nebo podporu projektu.",
        },
        {
          label: "02",
          title: "Méně mikroplateb",
          text: "Místo drobných plateb u každého kroku máš kreditový zůstatek. Je přehlednější pro čtenáře i pro provoz platformy.",
        },
        {
          label: "03",
          title: "Podpora má vlastní stopu",
          text: "Kredit můžeš věnovat ARTales jako podporu projektu. Později na něj může navázat také podpora autorů, překladů nebo konkrétních edic.",
        },
      ]
    : [
        {
          label: "01",
          title: "One value in your account",
          text: "AT Credit is a reader value inside ARTales. Top it up once and then use it for titles, editions, membership or project support.",
        },
        {
          label: "02",
          title: "Fewer tiny payments",
          text: "Instead of paying for every small step, you keep a credit balance. It is clearer for readers and easier for the platform to operate.",
        },
        {
          label: "03",
          title: "Support has a clear trail",
          text: "You can gift credit to ARTales as project support. Later, credit can also connect to authors, translations or specific editions.",
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
              ? "AT kredity jsou jednoduchý způsob, jak v ARTales platit za čtenářský přístup a zároveň podporovat vznik dalších edic. Nejde o anonymní body; jsou navázané na tvůj účet a mají jasnou historii."
              : "AT Credits are a simple way to pay for reader access in ARTales while supporting future editions. They are not anonymous points; they are connected to your account and have a clear history."}
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

          <h2>{isCs ? "K čemu se budou hodit" : "What they are for"}</h2>
          <ul>
            <li>{isCs ? "online odemčení vybraných titulů," : "online unlocks for selected titles,"}</li>
            <li>{isCs ? "oficiální PDF/EPUB edice tam, kde jsou dostupné," : "official PDF/EPUB editions where available,"}</li>
            <li>{isCs ? "členství a čtenářské výhody," : "membership and reader benefits,"}</li>
            <li>{isCs ? "podpora ARTales a později i autorů nebo kurátorských edic." : "support for ARTales and later also authors or curated editions."}</li>
          </ul>

          <div className="artales-account-actions">
            <Link className="artales-button" href="/checkout/credits">
              {isCs ? "Dobít AT kredity" : "Top up AT Credits"}
            </Link>
            <Link className="artales-button-secondary" href="/checkout/support">
              {isCs ? "Podpořit ARTales" : "Support ARTales"}
            </Link>
            <Link className="artales-button-secondary" href="/account/credits">
              {isCs ? "Můj kredit" : "My credit"}
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
