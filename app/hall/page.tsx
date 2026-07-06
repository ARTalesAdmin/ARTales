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
              ? "Síň ARTales bude místem tichého poděkování čtenářům, kteří výrazně nebo dlouhodobě podporují vznik knihovny. Zatím připravujeme dvě vrstvy: Patrony a Mecenáše."
              : "The ARTales Hall will quietly thank readers who significantly or steadily support the creation of the library. For now, we are preparing two layers: Patrons and Benefactors."}
          </p>

          <div className="artales-account-model-grid">
            <article>
              <p className="artales-account-card__label">{isCs ? "Od" : "From"} {MEMBERSHIP_PRICEBOOK.patronage.patronAt} AT</p>
              <h2>{isCs ? "Patroni" : "Patrons"}</h2>
              <p>
                {isCs
                  ? "Patronství vzniká postupně z podpory ARTales. Může jít o jeden větší dar nebo mnoho menších příspěvků v čase. V účtu bude vidět jako trvalé poděkování."
                  : "Patronage grows from ARTales support over time. It can come from one larger gift or many smaller contributions. In the account, it becomes a lasting acknowledgement."}
              </p>
            </article>
            <article>
              <p className="artales-account-card__label">{isCs ? "Od" : "From"} {MEMBERSHIP_PRICEBOOK.patronage.mecenatAt} AT</p>
              <h2>{isCs ? "Mecenáši" : "Benefactors"}</h2>
              <p>
                {isCs
                  ? "Mecenášství je vyšší status podpory ARTales. Po spuštění viditelnosti může být spojeno se zvoleným veřejným nickem a jemným symbolem u jména."
                  : "Benefactor status is a higher ARTales support status. Once visibility settings are enabled, it can be tied to a chosen public nickname and a subtle symbol next to the name."}
              </p>
            </article>
          </div>

          <section className="artales-account-panel artales-community-section">
            <p className="artales-account-card__label">{isCs ? "Soukromí" : "Privacy"}</p>
            <h2>{isCs ? "Viditelnost bude vždy volitelná" : "Visibility will always be optional"}</h2>
            <p>
              {isCs
                ? "Veřejně se nikdy nezobrazí fakturační jméno, e-mail ani interní role. Až bude nastavení viditelnosti aktivní, Patron nebo Mecenáš si zvolí, zda chce zůstat anonymní, být vidět jen v účtu, nebo se zobrazit ve veřejné Síni ARTales pod svým nickem."
                : "Billing name, email address and internal role will never be shown publicly. Once visibility settings are active, a Patron or Benefactor will choose whether to stay anonymous, remain visible only in the account, or appear publicly in the ARTales Hall under a nickname."}
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
