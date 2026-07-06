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
          label: "Číst",
          title: "Kredit pro klidný výběr",
          text: "Dobiješ si čtenářskou hodnotu a používáš ji postupně. Nemusíš při každém titulu znovu řešit platbu — vybereš si dílo, edici nebo členství podle nálady a potřeby.",
        },
        {
          label: "Sbírat",
          title: "Jedno dílo, více podob",
          text: "Trvalé online odemčení zůstává u účtu. Pokud si k témuž titulu později doplníš PDF nebo EPUB, získáš vlastnickou cenu jako čtenář, který už má text odemčený.",
        },
        {
          label: "Podporovat",
          title: "Knihovna vzniká i díky čtenářům",
          text: `Darované AT kredity se počítají do mecenášské stopy. Patron ARTales začíná od ${MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT celkové podpory, Mecenáš od ${MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT.`,
        },
      ]
    : [
        {
          label: "Read",
          title: "Credit for calm choice",
          text: "Top up reader value and use it gradually. You do not need to handle a new payment for every title — choose a work, edition or membership when it makes sense.",
        },
        {
          label: "Collect",
          title: "One work, several forms",
          text: "A permanent online unlock stays with your account. If you later add PDF or EPUB for the same work, you receive an owner price because the text is already unlocked.",
        },
        {
          label: "Support",
          title: "The library is built with readers",
          text: `Gifted AT Credits count toward the patronage trail. ARTales Patron begins at ${MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT of total support; Benefactor begins at ${MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT.`,
        },
      ];

  return (
    <div className="artales-public-shell">
      <PublicHeader active="credits" />
      <main className="artales-public-main artales-legal-main">
        <article className="artales-legal-article artales-credits-story">
          <p className="artales-public-kicker">ARTales Credits</p>
          <h1>{isCs ? "AT kredity" : "AT Credits"}</h1>
          <p>
            {isCs
              ? "AT kredity jsou čtenářská hodnota uvnitř ARTales. Pomáhají držet čtení, edice, členství i podporu knihovny v jednom přehledném účtu. Dobiješ je jednou a používáš je vlastním tempem."
              : "AT Credits are reader value inside ARTales. They keep reading, editions, membership and library support in one clear account. Top up once and use them at your own pace."}
          </p>

          <div className="artales-account-model-grid artales-credits-story-grid">
            {cards.map((card) => (
              <article key={card.label}>
                <p className="artales-account-card__label">{card.label}</p>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </article>
            ))}
          </div>

          <section className="artales-account-panel artales-credits-pricebook-note">
            <p className="artales-account-card__label">{isCs ? "Vlastnická cena" : "Owner price"}</p>
            <h2>{isCs ? "Neplatíš dvakrát za stejný text" : "You do not pay twice for the same text"}</h2>
            <p>
              {isCs
                ? "Online odemčení stojí 1 AT. PDF nebo EPUB běžně stojí 2 AT, ale po trvalém online odemčení téhož titulu stojí 1 AT. Balíček PDF + EPUB stojí po online odemčení 2 AT místo 3 AT."
                : "Online unlock costs 1 AT. PDF or EPUB normally costs 2 AT, but after a permanent online unlock for the same title, it costs 1 AT. The PDF + EPUB bundle costs 2 AT after online unlock instead of 3 AT."}
            </p>
          </section>

          <section className="artales-account-panel artales-credits-patronage-note">
            <p className="artales-account-card__label">{isCs ? "Patronství" : "Patronage"}</p>
            <h2>{isCs ? "Podpora nemusí být velká najednou" : "Support does not have to be large at once"}</h2>
            <p>
              {isCs
                ? "Když věnuješ část svého kreditu ARTales, počítá se postupně. Jednorázový dar i pravidelná drobná podpora mají stejnou stopu v účtu. Viditelnost v Síni ARTales bude vždy dobrovolná a navázaná jen na zvolený nick."
                : "When you gift part of your credit to ARTales, it counts over time. A single larger gift and regular small support share the same account trail. Hall visibility will always be voluntary and tied only to a chosen nickname."}
            </p>
          </section>

          <div className="artales-account-actions">
            <Link className="artales-button" href="/checkout/credits">
              {isCs ? "Dobít AT kredity" : "Top up AT Credits"}
            </Link>
            <Link className="artales-button-secondary" href="/account/credits#support">
              {isCs ? "Darovat z kreditu" : "Gift from credit"}
            </Link>
            <Link className="artales-button-secondary" href="/account/membership">
              {isCs ? "Zobrazit členství" : "View membership"}
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
