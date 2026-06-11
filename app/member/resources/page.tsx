import Link from "next/link";
import { requireEditorOrAdmin } from "@/lib/guards";
import { ARTALES_TEXT_PREPROCESSOR_PROMPT } from "@/lib/textParser";

const workCoverPrompt = `Pracujeme na coverech pro ARTales.

DŮLEŽITÉ:
Cover má být navržen jako ARTales web/book cover, ne jen volný plakát.
Musí dobře fungovat:
1) v galerii jako menší dlaždice,
2) v detailu díla jako větší cover,
3) později i jako základ pro tiskovou obálku.

TECHNICKÝ STANDARD:
- poměr coveru: 2:3
- cílový master formát: 1600 × 2400 px
- důležité prvky držet v safe zone:
  - horní okraj cca 8–10 %
  - spodní okraj cca 10–12 %
  - boční okraje cca 7–8 %
- title, author a ARTales branding nesmí být příliš u kraje
- cover musí dobře fungovat i jako menší thumbnail

KOMPOZIČNÍ PRAVIDLA:
- hlavní motiv má být čitelný i v menší velikosti
- název díla musí být dobře čitelný
- autor musí být dobře čitelný
- cover má působit literárně, elegantně a edičně, ne jako levný reklamní banner
- ARTales branding má být decentní, ne agresivní
- výsledný cover má působit jako skutečná kniha / edice

TEXTOVÝ OBSAH:
- title: [NÁZEV DÍLA]
- author: [AUTOR]
- případně subtitle / edition line: [POKUD BUDE]`;

const authorPortraitPrompt = `Vytvoř ARTales author portrait / author avatar.

ÚČEL:
Obrázek bude použit jako portrét autora v literární platformě ARTales:
- v seznamu autorů,
- v detailu autora,
- později v edičních a contributors vrstvách.

TECHNICKÝ STANDARD:
- poměr: 1:1
- master formát: 1200 × 1200 px
- důležité prvky držet ve středu
- musí fungovat i jako malá ikona
- bez textu, pokud není výslovně řečeno jinak

STYL:
- literární, elegantní, klidný
- decentní ARTales estetika
- žádný reklamní banner
- žádné agresivní barvy
- vhodné pro světlé i tmavé UI

VARIANTY:
Pokud neexistuje skutečný autorizovaný portrét autora, vytvoř symbolický portrét/avatar:
- silueta,
- starý portrétní rám,
- papír,
- pero,
- iniciály,
- atmosféra odpovídající období nebo žánru autora.

AUTOR:
[JMÉNO / KONTEXT AUTORA]`;

const collectionCoverPrompt = `Vytvoř ARTales collection cover.

ÚČEL:
Obrázek bude použit jako vizuál kolekce v literární platformě ARTales:
- v seznamu kolekcí,
- v detailu kolekce,
- jako ediční/katalogový vizuál.

TECHNICKÝ STANDARD:
- poměr: 3:2
- master formát: 1800 × 1200 px
- hlavní motiv musí být čitelný i v menší dlaždici
- důležité prvky držet ve vnitřní safe zone cca 8 %
- bez drobného textu, pokud není výslovně potřeba

STYL:
- literární, ediční, elegantní
- sjednocený ARTales vzhled
- spíše atmosférický než plakátový
- nesmí konkurovat coverům jednotlivých děl
- má působit jako „edice / regál / literární okruh“

KOLEKCE:
[NÁZEV KOLEKCE]
[ŽÁNR / TÓN / KRÁTKÝ POPIS]`;

type MaterialCardProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  specs: string[];
  prompt: string;
  relatedHref?: string;
  relatedLabel?: string;
};

function MaterialCard({
  id,
  eyebrow,
  title,
  description,
  specs,
  prompt,
  relatedHref,
  relatedLabel,
}: MaterialCardProps) {
  return (
    <article id={id} className="artales-member-panel artales-resource-card">
      <div className="artales-resource-card__header">
        <p className="artales-resource-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <ul className="artales-resource-specs">
        {specs.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <pre className="artales-resource-prompt"><code>{prompt}</code></pre>

      {relatedHref && relatedLabel ? (
        <Link className="artales-button-secondary" href={relatedHref}>
          {relatedLabel}
        </Link>
      ) : null}
    </article>
  );
}

export default async function MemberResourcesPage() {
  await requireEditorOrAdmin();

  return (
    <main className="artales-resource-page">
      <p className="artales-resource-eyebrow">ARTales · editor materials</p>
      <div className="artales-resource-hero">
        <div>
          <h1>Materiály a prompty</h1>
          <p>
            Interní opora pro editory a produkční tým. Cílem je, aby obálky,
            portréty, kolekce a parser výstupy vznikaly konzistentně, i když je
            připravují různí lidé.
          </p>
        </div>
        <div className="artales-resource-hero__actions">
          <Link className="artales-button-secondary" href="/member/works/new">
            Nové dílo
          </Link>
          <Link className="artales-button-secondary" href="/member/authors/new">
            Nový autor
          </Link>
          <Link className="artales-button-secondary" href="/member/collections/new">
            Nová kolekce
          </Link>
        </div>
      </div>

      <section className="artales-member-panel artales-resource-index">
        <h2>Rychlý rozcestník</h2>
        <div>
          <a href="#work-cover">Cover díla</a>
          <a href="#author-portrait">Portrét autora</a>
          <a href="#collection-cover">Cover kolekce</a>
          <a href="#parser">Parser textu</a>
        </div>
      </section>

      <MaterialCard
        id="work-cover"
        eyebrow="Cover díla"
        title="ARTales book cover"
        description="Hlavní obálka díla. Má působit jako skutečná kniha a musí dobře fungovat v galerii, detailu díla i později jako základ pro tisk."
        specs={[
          "Poměr 2:3",
          "Master 1600 × 2400 px",
          "Safe zone: horní 8–10 %, spodní 10–12 %, boky 7–8 %",
          "Jedna primární obálka na dílo; varianty až později",
        ]}
        prompt={workCoverPrompt}
        relatedHref="/member/works/new"
        relatedLabel="Použít u nového díla"
      />

      <MaterialCard
        id="author-portrait"
        eyebrow="Autor"
        title="Author portrait / avatar"
        description="Portrét nebo symbolický avatar autora. Nemá konkurovat obálkám děl; má být klidný, literární a čitelný i jako malá ikona."
        specs={[
          "Poměr 1:1",
          "Master 1200 × 1200 px",
          "Bez textu, pokud není výslovně potřeba",
          "U historických autorů používat jen legálně čisté/public domain zdroje nebo vlastní symbolický avatar",
        ]}
        prompt={authorPortraitPrompt}
        relatedHref="/member/authors/new"
        relatedLabel="Použít u nového autora"
      />

      <MaterialCard
        id="collection-cover"
        eyebrow="Kolekce"
        title="Collection cover"
        description="Ediční/katalogový vizuál kolekce. Má působit jako literární okruh nebo regál, ne jako obálka konkrétní knihy."
        specs={[
          "Poměr 3:2",
          "Master 1800 × 1200 px",
          "Hlavní motiv čitelný i v menší dlaždici",
          "Bez drobného textu; kolekce nesmí přebíjet jednotlivá díla",
        ]}
        prompt={collectionCoverPrompt}
        relatedHref="/member/collections/new"
        relatedLabel="Použít u nové kolekce"
      />

      <article id="parser" className="artales-member-panel artales-resource-card">
        <div className="artales-resource-card__header">
          <p className="artales-resource-eyebrow">Parser</p>
          <h2>AI předzpracování textu</h2>
          <p>
            Parser má šetřit produkční práci, ale nesmí měnit obsah díla. AI má
            připravit značky a zachovat důležité formátování; editor výsledek
            vždy kontroluje před uložením.
          </p>
        </div>

        <ul className="artales-resource-specs">
          <li>Běžná přímá řeč/dialog zůstává odstavec, ne citace.</li>
          <li>Quote použít jen pro skutečné vyčleněné citace, motta nebo epigrafy.</li>
          <li>Kurzívu zachovat jako inline <code>{"<em>... </em>"}</code>.</li>
          <li>Obrázky označit jako image placeholder; asset doplní editor.</li>
        </ul>

        <pre className="artales-resource-prompt"><code>{ARTALES_TEXT_PREPROCESSOR_PROMPT}</code></pre>

        <Link className="artales-button-secondary" href="/member/works/new#raw_text_parser">
          Otevřít parser v editoru díla
        </Link>
      </article>
    </main>
  );
}
