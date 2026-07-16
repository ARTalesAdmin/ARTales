import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editions and public domain · ARTales",
};

export default async function EditionsInfoPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  return (
    <div className="artales-public-shell">
      <PublicHeader active="legal" />

      <main className="artales-public-main artales-legal-main">
        <p className="artales-legal-back"><Link href="/legal">{isCs ? "← Zpět na informace" : "← Back to information"}</Link></p>

        <article className="artales-legal-article">
          <p className="artales-public-kicker">ARTales Editions</p>
          <h1>{isCs ? "O edicích a veřejné doméně" : "Editions and public domain"}</h1>

          {isCs ? (
            <>
              <p>
                ARTales zpřístupňuje literární díla v ediční a čtenářské podobě. Část textů vychází z veřejné domény,
                část může být původní, překladová, kurátorská nebo jinak licenčně vymezená.
              </p>
              <h2>Veřejná doména</h2>
              <p>
                U děl označených jako veřejná doména pracujeme s texty, u nichž je podle dostupných informací možné
                veřejné zpřístupnění. Právní stav se ale může lišit podle země, konkrétní edice, překladu nebo zdrojového
                souboru.
              </p>
              <h2>Ediční práce</h2>
              <p>
                ARTales může doplňovat metadata, čtenářské členění, obálky, kurátorské zařazení, poznámky, opravy a další
                ediční vrstvu. Tyto prvky mohou být samostatnou prací ARTales i tehdy, když samotný původní text vychází
                z veřejné domény.
              </p>
              <h2>Jazykové verze</h2>
              <p>
                Jedno literární dílo může mít na ARTales více jazykových verzí. Originální jazyková verze je chápána jako
                výchozí text díla; překlady a další ediční varianty jsou samostatné jazykové edice navázané na totéž dílo.
                Na detailu edice proto rozlišujeme jazyk této edice a původní jazyk díla.
              </p>
              <h2>Opravy a připomínky</h2>
              <p>
                Pokud narazíte na chybu v textu, metadatech, autorství, zdroji nebo právním zařazení, napište nám na info@artales.net nebo přes
                kontaktní stránku. Cílem je držet edice přesné, čitelné a poctivě označené.
              </p>
            </>
          ) : (
            <>
              <p>
                ARTales makes literary works available in an editorial and reader-friendly form. Some texts are based on
                the public domain, while others may be original, translated, curated or otherwise licensed.
              </p>
              <h2>Public domain</h2>
              <p>
                Works marked as public domain are based on texts that appear to be available for public use according to
                currently available information. Legal status can differ by country, edition, translation or source file.
              </p>
              <h2>Editorial work</h2>
              <p>
                ARTales may add metadata, reader structure, covers, curated placement, notes, corrections and other
                editorial layers. These elements may be independent ARTales work even when the underlying text is in the
                public domain.
              </p>
              <h2>Language versions</h2>
              <p>
                A single literary work may have more than one language version on ARTales. The original-language version is
                treated as the source version of the work; translations and other editorial variants are separate language
                editions connected to the same work. Work detail pages therefore distinguish the language of this edition
                from the original language of the work.
              </p>
              <h2>Corrections and notices</h2>
              <p>
                If you notice an issue with text, metadata, authorship, source attribution or legal classification, please
                write to info@artales.net or contact us. The goal is to keep editions accurate, readable and clearly described.
              </p>
            </>
          )}
        </article>
      </main>
    </div>
  );
}
