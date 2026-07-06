import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";
import { MEMBERSHIP_PRICEBOOK } from "@/lib/memberPricebook";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Síň ARTales · ARTales",
};

export default async function ArtalesHallPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  return (
    <div className="artales-public-shell">
      <PublicHeader active="support" />
      <main className="artales-public-main artales-legal-main">
        <article className="artales-legal-article artales-hall-article">
          <p className="artales-public-kicker">{isCs ? "Poděkování" : "Acknowledgements"}</p>
          <h1>{isCs ? "Síň ARTales" : "ARTales Hall"}</h1>
          <p>
            {isCs
              ? "Síň ARTales bude místem poděkování lidem, kteří výrazně nebo dlouhodobě podporují vznik literární knihovny. Veřejně se zde bude zobrazovat pouze zvolený nick, nikdy fakturační jméno ani e-mail."
              : "The ARTales Hall will thank people who significantly or regularly support the literary library. Only a chosen public nickname will be shown here, never billing names or email addresses."}
          </p>

          <div className="artales-account-model-grid">
            <article>
              <p className="artales-account-card__label">{isCs ? "Od" : "From"} {MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT</p>
              <h2>{isCs ? "Patroni" : "Patrons"}</h2>
              <p>
                {isCs
                  ? "Patronství je poděkování za opakovanou nebo výraznější podporu. Zápis do síně bude volitelný podle nastavení viditelnosti účtu."
                  : "Patronage thanks readers for repeated or more substantial support. Hall visibility will be optional and controlled by account settings."}
              </p>
            </article>
            <article>
              <p className="artales-account-card__label">{isCs ? "Od" : "From"} {MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT</p>
              <h2>{isCs ? "Mecenáši" : "Benefactors"}</h2>
              <p>
                {isCs
                  ? "Mecenášství je vyšší trvalý status podpory ARTales. Může být spojeno se symbolem u veřejného nicku a viditelným poděkováním."
                  : "Benefactor status is a higher lasting form of ARTales support. It can be connected with a symbol next to the public nickname and a visible acknowledgement."}
              </p>
            </article>
          </div>

          <section className="artales-account-panel artales-community-section">
            <p className="artales-account-card__label">{isCs ? "Soukromí" : "Privacy"}</p>
            <h2>{isCs ? "Viditelnost bude volitelná" : "Visibility will be optional"}</h2>
            <p>
              {isCs
                ? "Patroni a mecenáši si později zvolí, zda chtějí zůstat anonymní, být vidět jen v účtu, nebo se zobrazit ve veřejné Síni ARTales pod svým nickem."
                : "Patrons and benefactors will later choose whether to stay anonymous, be visible only in their account, or appear publicly in the ARTales Hall under their nickname."}
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
