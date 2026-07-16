import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Co se chystá · ARTales",
};

export default async function RoadmapPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";
  const courses = isCs
    ? [
        {
          title: "Personalizované knihy",
          text: "Vybrané příběhy půjde časem objednat v osobnější podobě: jako dar, pamětní edici, upravenou verzi pro konkrétního čtenáře nebo nový literární experiment nad volným dílem.",
        },
        {
          title: "Audioknihy a hlasové edice",
          text: "Vedle čtení chceme rozvíjet i poslech: komorní audioknihy, autorská čtení, hlasové ukázky a zvukové edice, které zachovají atmosféru textu.",
        },
        {
          title: "Autorská škola ARTales",
          text: "Tvůrčí dílny, konzultace, lekce psaní a ediční zpětná vazba pro začínající i pokročilé autory. Nejen návody, ale práce s konkrétním textem.",
        },
        {
          title: "Komunitní tvorba",
          text: "Čtenáři a autoři se budou moci zapojit do výzev, společných sbírek, komentovaných verzí, překladů, adaptací nebo tematických literárních projektů.",
        },
        {
          title: "Blíž autorům",
          text: "Chceme vytvořit prostor, kde bude možné sledovat vznik díla, podpořit autora, položit otázku, dostat se k pracovním poznámkám nebo být součástí tvůrčího procesu, pokud o to autor stojí.",
        },
        {
          title: "Objednávky na míru",
          text: "U volných i autorských děl si půjde časem objednat překlad, jazykovou úpravu, zkrácení, doprovodný text, výukovou verzi, alternativní konec nebo jinou podobu literární služby.",
        },
      ]
    : [
        {
          title: "Personalised books",
          text: "Selected stories may later be commissioned in a more personal form: as a gift, a commemorative edition, an adaptation for a specific reader or a new literary experiment based on a public-domain work.",
        },
        {
          title: "Audiobooks and voice editions",
          text: "Alongside reading, we want to develop listening: intimate audiobooks, author readings, voice samples and sound editions that preserve the atmosphere of the text.",
        },
        {
          title: "The ARTales author school",
          text: "Creative workshops, consultations, writing lessons and editorial feedback for emerging and experienced authors. Not just advice, but work with actual texts.",
        },
        {
          title: "Community creation",
          text: "Readers and authors will be able to join challenges, shared collections, annotated editions, translations, adaptations and themed literary projects.",
        },
        {
          title: "Closer to authors",
          text: "We want to create a space where readers can follow the making of a work, support an author, ask questions, access working notes or become part of the creative process when the author welcomes it.",
        },
        {
          title: "Custom literary services",
          text: "For public-domain and original works, readers will later be able to request translation, editing, abridgement, companion notes, learning editions, alternative endings or other literary services.",
        },
      ];

  return (
    <div className="artales-public-shell">
      <PublicHeader active="roadmap" />
      <main className="artales-public-main artales-legal-main">
        <article className="artales-legal-article">
          <p className="artales-public-kicker">{isCs ? "Ateliér ARTales" : "ARTales Atelier"}</p>
          <h1>{isCs ? "Co chystáme" : "What we are preparing"}</h1>
          <p>
            {isCs
              ? "ARTales chceme rozvíjet jako knihovnu, čtečku i literární ateliér: místo pro čtení, autory, školy, čtenářské okruhy a nové způsoby práce s textem. Tady jsou směry, které připravujeme postupně."
              : "We want ARTales to grow as a library, reader and literary atelier: a place for reading, authors, schools, reading circles and new ways of working with texts. These are the directions we are preparing step by step."}
          </p>

          <section className="artales-menu-roadmap" aria-label={isCs ? "Budoucí směry ARTales" : "Future ARTales directions"}>
            {courses.map((course) => (
              <article className="artales-account-card" key={course.title}>
                <p className="artales-account-card__label">ARTales</p>
                <h2>{course.title}</h2>
                <p>{course.text}</p>
              </article>
            ))}
          </section>

          <section className="artales-account-panel artales-roadmap-wishlist">
            <p className="artales-account-card__label">{isCs ? "Čtenářské přání" : "Reader wish"}</p>
            <h2>{isCs ? "Co byste si přáli vy?" : "What would you like to see?"}</h2>
            <p>
              {isCs
                ? "Máte vysněnou knihu, autora, překlad, alternativní konec, audioverzi, tvůrčí kurz nebo službu, kterou by podle vás ARTales mělo nabídnout? Napište nám. Nejlepší přání pomáhají určovat, čemu dáme přednost."
                : "Do you have a dream book, author, translation, alternative ending, audio edition, creative course or service you would like ARTales to offer? Tell us. The best wishes help shape what comes first."}
            </p>
            <Link className="artales-button-secondary" href="mailto:info@artales.net">
              {isCs ? "Napsat ARTales" : "Write to ARTales"}
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
