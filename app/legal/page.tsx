import Link from "next/link";
import PublicHeader from "@/components/public/PublicHeader";
import { getCookieLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Info · ARTales",
};

export default async function LegalIndexPage() {
  const locale = await getCookieLocale();
  const isCs = locale === "cs";

  const items = isCs
    ? [
        {
          href: "/legal/editions",
          title: "O edicích a veřejné doméně",
          text: "Jak ARTales pracuje s veřejnou doménou, edičními úpravami, překlady a zdroji.",
        },
        {
          href: "/legal/terms",
          title: "Podmínky užití",
          text: "Základní pravidla používání platformy, čtenářských účtů a dostupných digitálních edic.",
        },
        {
          href: "/legal/privacy",
          title: "Soukromí",
          text: "Jaké údaje platforma používá a k čemu slouží.",
        },
        {
          href: "/legal/contact",
          title: "Kontakt",
          text: "Kam psát kvůli dotazům, opravám, právům k textům nebo technickým problémům.",
        },
      ]
    : [
        {
          href: "/legal/editions",
          title: "Editions and public domain",
          text: "How ARTales works with public-domain texts, editorial work, translations and sources.",
        },
        {
          href: "/legal/terms",
          title: "Terms of use",
          text: "Basic rules for using the platform, reader accounts and available digital editions.",
        },
        {
          href: "/legal/privacy",
          title: "Privacy",
          text: "What data the platform uses and why.",
        },
        {
          href: "/legal/contact",
          title: "Contact",
          text: "Where to write about questions, corrections, rights issues or technical problems.",
        },
      ];

  return (
    <div className="artales-public-shell">
      <PublicHeader active="legal" />

      <main className="artales-public-main artales-legal-main">
        <section className="artales-legal-hero">
          <p className="artales-public-kicker">ARTales</p>
          <h1>{isCs ? "Informace a právní minimum" : "Information and legal minimum"}</h1>
          <p>
            {isCs
              ? "Základní veřejné informace k používání platformy, edicím, soukromí a kontaktu."
              : "Basic public information about using the platform, editions, privacy and contact."}
          </p>
        </section>

        <section className="artales-legal-grid" aria-label={isCs ? "Informační stránky" : "Information pages"}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="artales-legal-card">
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
