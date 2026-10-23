import Link from "next/link";
import { notFound } from "next/navigation";
import { searchGenrePage, searchThemePage, enrichAuthor, pause } from "@/lib/prescreen/openLibrary";
import { preliminaryShadowDecision } from "@/lib/prescreen/shadowPolicy";
import { PRESCREEN_GENRES, type PrescreenGenre } from "@/lib/prescreen/engine";
import { PRESCREEN_THEMES, type PrescreenTheme } from "@/lib/prescreen/themes";

type Params = { kind?: string; key?: string };
type Props = { searchParams: Promise<Params> };

/**
 * Actual Open Library search + actual EU/CZ preflight, with NO DB, auth
 * bypass, artificial catalog results, candidate creation or writes.
 * Deploys ONLY in Next.js preview/local development; production -> 404.
 */
export default async function ShadowLiveFixture({ searchParams }: Props) {
  if (process.env.VERCEL_ENV !== "preview" && process.env.NODE_ENV !== "development") {
    notFound();
  }
  const params = await searchParams;
  const isTheme = params.kind === "theme";
  const genre: PrescreenGenre = PRESCREEN_GENRES.find(g => g === params.key) ?? "prose";
  const theme: PrescreenTheme = PRESCREEN_THEMES.find(t => t === params.key) ?? "adventure";
  let entries: Awaited<ReturnType<typeof searchGenrePage>>["entries"] = [];
  let fetched = 0;
  let error: string | null = null;
  try {
    const page = isTheme ? await searchThemePage(theme, 0, 3) : await searchGenrePage(genre, 0, 3);
    fetched = page.fetchedCount;
    for (const entry of page.entries) {
      if (entries.length) await pause(1100);
      let row = entry.item;
      try { row = await enrichAuthor(row); } catch { /* date remains unknown; review, never clearance */ }
      entries.push({ ...entry, item: row });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "catalog_unavailable";
  }
  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 24, lineHeight: 1.5 }}>
      <p>ARTales · Preview / QA · žádné databázové zápisy</p>
      <h1>Prescreen · živá katalogová zkouška</h1>
      <p>
        Skutečná data z Open Library zpracovaná skutečným algoritmem EU/CZ.
        <strong> Nejde o přihlášenou administraci, právní clearance ani test persistence.</strong>
        Žádné knihy se neukládají a do kandidátů se nic nepředává.
      </p>
      <section style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <form method="get">
          <input type="hidden" name="kind" value="form" />
          <label>Literární forma{" "}
            <select name="key" defaultValue={isTheme ? "prose" : genre}>
              {PRESCREEN_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>{" "}
          <button type="submit">Ověřit skutečná díla</button>
        </form>
        <form method="get">
          <input type="hidden" name="kind" value="theme" />
          <label>Tematický žánr{" "}
            <select name="key" defaultValue={isTheme ? theme : "adventure"}>
              {PRESCREEN_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>{" "}
          <button type="submit">Ověřit téma</button>
        </form>
      </section>
      <h2>Open Library: {isTheme ? theme : genre}</h2>
      <p>Načtené zdrojové záznamy: {fetched}. Zobrazené platné bibliografické záznamy: {entries.length}.</p>
      {error && <p role="alert">Živý katalog právě není dostupný: {error}</p>}
      {!error && entries.length === 0 && <p>Pro tento dotaz nebyly dostupné použitelné záznamy.</p>}
      <div style={{ display: "grid", gap: 16 }}>
        {entries.map(({ item }) => {
          const decision = preliminaryShadowDecision(item);
          return <article key={item.workKey} style={{ border: "1px solid #aaa", borderRadius: 8, padding: 16 }}>
            <h3>{item.title}</h3>
            <p>Autor: {item.author} · forma: {item.genre}</p>
            <p>První vydání: {item.firstPublished ?? "nezjištěno"} · narození:
              {" "}{item.authorBorn ?? "nezjištěno"} · úmrtí: {item.authorDied ?? "nezjištěno"}
            </p>
            <p><strong>Úvodní výsledek: {decision.state}</strong> · {decision.reason}
              {decision.reconsiderYear ? " · přezkum od " + decision.reconsiderYear : ""}
            </p>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">Zdroj Open Library</a>
          </article>;
        })}
      </div>
      <p style={{ marginTop: 32 }}>
        <Link href="/fixture/prescreen">Starší fixture</Link>
      </p>
    </main>
  );
}
