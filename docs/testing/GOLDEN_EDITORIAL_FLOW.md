# ARTales Golden Editorial Flow — opakovatelná kontrola

## Účel

Tato sada existuje proto, aby oprava jedné redakční funkce nerozbila sousední krok.
Zdrojové testy, databázové testy a skutečný prohlížečový E2E jsou **tři různé úrovně důkazu**. Zelené CI není samo o sobě důkazem přihlášeného průchodu webem.

**Výchozí stav:** syntetická kniha v `tests/golden/goldenBook.ts`, žádné trvalé produkční kandidáty ani uživatelské účty. Gutenberg #74 slouží pouze jako bibliografická identita testovacích metadat, vlastní EPUB text je nově vymyšlený.

## Jak spouštět

- Každý relevantní PR proti `main`: `ARTales golden editorial flow` v GitHub Actions.
- Po samostatně schváleném merge: při relevantním push do `main`, jednou denně a také přes `workflow_dispatch`.
- Ruční reprodukce zdrojového scénáře: `npx tsx --test tests/golden/goldenEditorialFlow.test.ts`.
- Databázové scénáře vyžadují **výhradně dočasný lokální PostgreSQL 17** s hostem `127.0.0.1`, databází `postgres` a portem `5432`. Jsou spouštěny v samostatných CI kontejnerech.
- Reset: pro zdrojový test nové vyhodnocení `createGoldenEpub()`, pro SQL nová testovací databáze při každém běhu. **Žádné `DELETE` ani `TRUNCATE` produkčních kandidátů.**

## Testované průchody

| Scénář | Vrstva | Rozsah |
| --- | --- | --- |
| Celý vlastní syntetický EPUB → Gutenberg RDF práva, +70 let → schválený lock → SHA-256 archivu → kompozice → QA vyřazení → Reader | `golden-pure-story` | Reálné čisté funkce aplikace, bez DB/Storage persistence |
| Právní rozhodnutí → Storage claims a RLS → archiv → sémantická revize → tři kontroly → atomické vydání | `golden-postgres-isolation` | Existující SQL fixture a migrační funkce ve zvláštní databázi |
| Uložit nahranou obálku → povolit dokončení, odmítnout chybějící soubor či neznámou osobu; propojit existujícího autora → přijmout bilingvní biografii | `golden-current-editorial-database` | **Aktuální** SQL ukládací funkce a trigger z verzovaných migrací, nikoliv jejich kopie |
| Zamítnout jinou knihu, autora, zdroj nebo zastaralý legal lock | `golden-pure-story` | Záporné právní a identitní brány |

Při červeném CI se musí opravit první neúspěšná hranice a test znovu spustit pro **přesný HEAD**. Nestačí pouze zkompilovat aplikaci.

## Co zelená kontrola ještě nedokazuje

- Neproklikává reálné stránky v přihlášené Ivině/Pavlině relaci.
- Nepřipojuje se k produkčnímu Supabase, nesdílí autentizační cookies ani neukládá soubory do živého Storage.
- Neprovádí kompletní HTTP tok právního screeningu, Snapshotu a obrázkového uploadu v jednom běžícím serveru.
- DB suite používá oddělená syntetická data; databázový end-to-end test starších snapshotových migrací není automaticky testem **každé pozdější** produkční migrace.
- Nedokazuje přístupnost, vizuální kontrast ani UX všech editorů.

Pro tyto zbývající hranice je třeba **druhá fáze**: izolovaná plná databáze se současným schématem, dočasné editor/admin identity, testovací Storage a Playwright v Preview proti téže testovací instanci. Produkční URL a produkční data nesmí být cílem resetu. Žádné zveřejnění syntetické knihy na `artales.net`.

## Provozní brány

1. Sada patří do `main` teprve po výslovném schválení přesného PR/head; samotný PR neautorizuje merge.
2. Každý relevantní runtime PR musí projít zlatou sadou a příslušným izolovaným testem.
3. Nástroj nesmí označit průchod jako produkční E2E PASS, pokud neověřil **browser → API → DB/Storage → response → UI**.
4. Pokud integrační test zjistí chybu, výsledek je FAIL s konkrétním krokem, nikoliv ruční obcházení testu u jednotlivé knihy.
5. Žádné produkční schema/Storage migrace, zákaznická data, oprávnění a Env se v této sadě nemění.

## Jak postupovat při selhání

Najdi v [GitHub Actions](https://github.com/ARTalesAdmin/ARTales/actions/workflows/artales-golden-editorial-flow.yml) poslední běh a první červený job. Jeho log obsahuje jednotlivé hraniční kontroly a v čisté vrstvě `GOLDEN_TRACE` s otisky a počty vyřazení, které umožní reprodukovat chybu. Oprava musí aktualizovat test i sdílenou implementaci, nikoliv vymazat neúspěšnou kontrolu.
