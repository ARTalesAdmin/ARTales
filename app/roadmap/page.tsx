import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What’s next · ARTales",
};

export default async function RoadmapPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";
  const courses = isCs
    ? [
        { title: "Čtenářská knihovna", text: "Pohodlnější návrat ke čtení, jasnější kredit, uložené tituly a osobní nastavení." },
        { title: "Ediční soubory", text: "Oficiální PDF a EPUB verze pro tituly, kde bude připravený kvalitní export." },
        { title: "Kurátorské cesty", text: "Kolekce, tematické výběry a čtenářské trasy napříč atmosférami, obdobími a autory." },
        { title: "Podpora a autoři", text: "Možnost směrovat podporu nejen ARTales, ale později také autorům, překladům a konkrétním edicím." },
      ]
    : [
        { title: "Reader library", text: "A better return to reading, clearer credit, saved titles and personal reader settings." },
        { title: "Edition files", text: "Official PDF and EPUB versions for titles with a prepared high-quality export." },
        { title: "Curated paths", text: "Collections, themed selections and reading routes across moods, periods and authors." },
        { title: "Support and authors", text: "Support can later be directed not only to ARTales, but also to authors, translations and specific editions." },
      ];

  return (
    <div className="artales-public-shell">
      <PublicHeader active="roadmap" />
      <main className="artales-public-main artales-legal-main">
        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales menu</p>
          <h1>{isCs ? "Co se chystá" : "What’s next"}</h1>
          <p>
            {isCs
              ? "ARTales stavíme jako literární prostor, ne jako seznam souborů. Tady je rámcový pohled na vrstvy, které chceme rozvíjet — bez slibování přesných dat."
              : "ARTales is being built as a literary space, not a file list. This is a broad view of the layers we want to develop, without promising exact dates."}
          </p>

          <section className="artales-menu-roadmap">
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
            <h2>{isCs ? "Co byste si přáli?" : "What would you like to see?"}</h2>
            <p>
              {isCs
                ? "Máte tip na autora, edici, funkci nebo čtenářskou cestu? Napište nám. Nejlepší podněty pomáhají určovat, co má dostat přednost."
                : "Have a suggestion for an author, edition, feature or reading path? Tell us. The best suggestions help shape what should come first."}
            </p>
            <Link className="artales-button-secondary" href="mailto:artales@seznam.cz">
              {isCs ? "Napsat ARTales" : "Write to ARTales"}
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
