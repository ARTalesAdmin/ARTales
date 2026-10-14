# ARTales Phoenix — 14. 10. 2026: podepsaný E2 browser PASS, následný osobní pilot a převod Galerie

> **DURABLE HANDOFF / READ FIRST.** Dokumentační checkpoint, **nikoli** schválení merge, DB apply, cloudové branch, produkčního vydání nebo automatické publikace. Před jakoukoli akcí přečti `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, `docs/ARTALES_DURABLE_CHECKPOINT.md`, tento Phoenix a aktuální související PR; ověř živý GitHub a Supabase. Nové výslovné autorizace Architekta a živý stav mají přednost před tímto zápisem.

## 1. Krátká pravda: kam jsme se dostali

**Byl prokázán celý jeden ÚZKÝ redakční tok přes opravdový headless Chromium/Next.js a lokální podepsaný Supabase:** přihlášení syntetického admina → vyhledání archivované syntetické Alenky → vlastní editorský úkol a převzetí → první immutable semantic revize → nový load stránky → ukotvená oprava odsazení **jednoho odstavce** → child revize → další nový load → **vlastní textové QA** → auditované uzavření úkolu, zákaz dalšího zápisu; starý `works.content` a `works.status` se nezměnily. Není to obecný WYSIWYG editor, reálné archivování Alenky ani vydání do veřejné Galerie.

- **Přesný E2 kód:** [Draft PR #243](https://github.com/ARTalesAdmin/ARTales/pull/243), branch `feat/artales-alice-e2-1-signed-editor-cycle-20261014`, potvrzený head `001f2bdae51ac316b428c19d28d86ca487f14e45`. PR **OPEN / DRAFT / NOT MERGED** do `develop`; nepouštěj naslepo celý starší stack PR #223.
- **Důkaz:** [GitHub Actions run 38611909299](https://github.com/ARTalesAdmin/ARTales/actions/runs/38611909299): `local-e2` PASS, oddělený `browser-e2e` PASS; doprovodné workflow Semantic Reader Composer a candidate handoff PASS. Na přesném headu také Vercel status SUCCESS. Dvě lokální Supabase zátěže **vlastní izolované DB/seed**, po běhu `supabase stop --no-backup`.
- **Kód nepřešel do develop:** potvrzený `develop` head `ad694bc96b52fd2a172ec1805bd594c3b6ea35f9`, produkční `main` head `171df191eb54dbcef7bb015f748138c630428b2f` (obojí z readu 14. 10.). `artales.net`, `main`, veřejný Reader, publikovaná data a poznámky **nedotčené**.
- **Dosud NEPROBĚHLO:** přihlášení skutečného Architekta do cloudového preview, zachycení skutečných archivních dat Alenky do izolované DB, cloudová Supabase ephemeral branch, kompletní QA obsah+práva+Reader, první vydavatelský cutover, hromadná konverze Galerie.
- **Konec seance:** Architekt dnes končí, žádnou ephemeral branch neotevírat na posledních 30–60 minut; nenechávat běžící placené DB přes noc. Tento handoff vytvořit dokumentačně odděleně od vysokorizikového PR #243.

## 2. Úpravy / kontrakt E2-1, které jsou skutečně v PR #243

- `app/member/works/[slug]/semantic/page.tsx` a `actions.ts`: default-off neveřejný pilot, soukromý úkol navázaný na konkrétního admina, archivní výběr ze signed evidence (bez ručního UUID), sestavení a persistování konceptu, source/hash readback, výběr podporovaného odstavce a požadavek na jedno `indent_small`, aplikace child revize a zobrazení vlastního „Schválit textové QA — bez publikace“.
- `lib/semantic/indentTarget.ts`: nabízet jen povolené textové bloky, ne nadpisy. `compose.ts`, `dbAComponentBridge.ts`, `selfPilotDraft.ts`, `verifySignedReadback.ts`: přesně normalizovaná byte/source identita, pevné atomové kotvy, deterministická revize a hash.
- `supabase/ci/alice_e2_signed_draft_assembly.sql` a `alice_e2_approval_proof.sql`: **PROVISIONAL / LOCAL QA ONLY / NOT CANONICAL MIGRATIONS**. Privátní evidence, append-only, signed `auth.uid()` active-profile role checks, owner claimed task, immutable audit, návrat opravy, exact-head serializace a task completion. `publication_allowed=false` ve všech scénářích. Alice výjimka pro vlastní textové QA je pro pevnou kombinaci slug, Gutenberg origin/source/URI, přesný archiv a claimed task; **není obecný release gate**.
- `supabase/ci/alice_e2_signed_cycle.ts` pro signed GoTrue/PostgREST a negativní testy. `supabase/ci/alice_e2_browser_smoke.ts` pro skutečné otevření stránky Chromium; dvě separátní joby kvůli kolizi stejného fixture slug. Původní společný job nejprve FAIL na testovacích technikáliích, opraveno; poslední přesný head PASS.
- Schválená revize je textové QA, nikoli prokázaná právní způsobilost, čtenářské QA, obrazové QA ani autorizovaný release. Rozhraní zatím není plnohodnotný editorský pracovní stůl: jedna podporovaná typografická úprava, žádná obecná sémantická změna podle přirozeného pokynu, plné interní `editor_note` mapování či redakční bulk.
- Zvlášť hodnotit bezpečnost `SECURITY DEFINER`, RLS, `EXECUTE` a uzamčení hlavy při souběhu, než SQL dostane kanonickou migraci či lidské cloudové testovací prostředí. CI PASS nestačí jako produkční security review.

## 3. Produktová rozhodnutí Architekta — nepřepisovat starou politikou

Číst [ARTALES_EDITORIAL_RELEASE_APPROVAL_POLICY_2026-10-14.md](https://github.com/ARTalesAdmin/ARTales/blob/feat/artales-alice-e2-1-signed-editor-cycle-20261014/docs/ARTALES_EDITORIAL_RELEASE_APPROVAL_POLICY_2026-10-14.md) a `docs/ARTALES_EDITORIAL_VISUAL_QA_STYLE_POLICY_2026-10-13.md` (v develop).

1. **Odpovědný editor může sám dokončit QA běžného převzatého/migrovaného díla a schválit jeho vydání, pokud všechny checky GREEN.** Povinný druhý reviewer není default. Cross-review odložit; použít zejména u **vlastního autorského textu editora** nebo když si ho editor vyžádá/je nezbytný kvůli nejistotě. Délka sama automaticky nevyžaduje křížovou kontrolu.
2. Architekt pravděpodobně sám převede většinu starých děl. Nezatěžovat Ivanu/Pavlu znovu předěláváním již udělané redakční práce ani je nepustit na nevychytanou pilotní verzi; první skutečný tester je **Architekt**.
3. **Nejdřív prokázat průchod, potom produktivitu.** Cíl přibližně 10 minut na titul po zrání procesu je aspirace, **není změřená výkonnost**. Neobcházet právní ani vydavatelské kontroly kvůli rychlosti.
4. Ilustrace volitelné **per titul**: `text_only` (plnohodnotné vydání), `illustrated_together` (společné QA), `visuals_later` (text může být vydán bez obrazu, následná cílená obrazová QA). Zpracovat vlastní ARTales obálku, zdrojové obrázky odděleně s právním posouzením.
5. QA pinovat na `(text_revision_ref, visual_revision_ref|EMPTY, style_profile_version, renderer_layout_version)`. Respektovat stylové dědictví z legacy, bez neautorizovaných retroaktivních změn.
6. `note` (veřejná), `footnote` (veřejná) a `editor_note` (interní) jsou **tři odlišné funkce**, jejich zachování je předpokladem migrace.
7. Textové QA ≠ právní schválení ≠ nezměnitelný release manifest ≠ atomický veřejný Reader cutover. „Schválit a vydat“ může být jediné UX tlačítko **teprve** nad úplnou serverovou fail-closed branou. Automatický release je budoucí opt-in, ne dnešní funkce.

## 4. Realita produkční Galerie (read-only Supabase, 14. 10. 2026)

- Projekt `nmhdwmszbwgrgfbmlguu`, **pouze default branch `main`**; žádná ephemeral branch k úklidu. Aplikována jediná produkční migrace `20260926142755_remote_schema`. Nové evidenční/candidate/editorial/semantic SQL soubory v Git **neznamenají produkční DB tabulky**.
- `public.works`: **64 děl celkem = 49 `published` + 15 `draft`**. Z publikovaných je 49 označeno `public_domain` + `gutenberg`; u draftů 14 stejná kombinace, 1 `original` + `manual`. Označení `public_domain` v legacy poli **samo nedokazuje** vyřešená práva ke konkrétní edici/komponentám v ČR/EU.
- Všech 49 publikovaných má `source_reference` a `content_blocks` (JSON pole), **0/49** má vyplněné `edition_source_url` nebo `edition_license`. Jde o **evidenční mezeru**, ne automatický důkaz protiprávnosti.
- Velikost publikovaných děl: medián přibližně **359 506 znaků a 1 121 bloků**, maximum **2 285 843 znaků a 6 573 bloků**. Rychlý QA pilot na Alence není prokázání 10min SLA u nejdelších děl.
- `reader_notes`: 2 záznamy v jednom díle; `reader_library_items`: 0 v době dotazu. **Neztratit ani existující ani budoucí poznámky, progress, kotvy, bookmarky či čtenářské preference.** Při migraci držet stabilní `work_id`, slug a možnost rollbacku.
- Produkční Alenka: slug `alices-adventures-in-wonderland`, `published`, `source_reference=https://www.gutenberg.org/ebooks/11`, 142 715 znaků legacy `content`. Fixture `tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt` má ověřenou textovou strukturu (12 kapitol), ale **fixture v repozitáři ani deklarovaná URL samy nejsou podepsaným archivním zachycením** v budoucí preview DB.
- `docs/ARTALES_PHOENIX_2026-10-13_EDITORIAL_VISUAL.md` a `docs/ARTALES_DURABLE_CHECKPOINT.md` jsou historické, tento dokument aktualizuje technický E2 stav; není autorizací výměny veřejné čtečky.

## 5. Související PR a oddělené streamy

- [#243](https://github.com/ARTalesAdmin/ARTales/pull/243): aktuální WIP signed Alice E2 + browser full-loop — **Draft, high risk, nevymergovaný**; začít jeho review před jakýmkoli pokračováním.
- [#223](https://github.com/ARTalesAdmin/ARTales/pull/223): starší integrovaný E1/E2 stack — **Draft**, historický; nelze bezhlavě mergovat ani předpokládat stejné kontrakty.
- [#213](https://github.com/ARTalesAdmin/ARTales/pull/213): signed real source intake — **Draft**, bez kanonické migrace a produkčního apply.
- [#214](https://github.com/ARTalesAdmin/ARTales/pull/214): evidence/legal triage všech 64 děl — **Draft**, práva neopravovat odhadem.
- [#237](https://github.com/ARTalesAdmin/ARTales/pull/237): autorizovaný Alice illustration Storage capture endpoint — **Draft**, default-off, bez prokázaného reálného uploadu; na text-only první pilot nečekat.
- #229 migration planner a #230 Reader shadow/rights-to-gallery syntetický integrační důkaz jsou **merged v develop**, ale jsou to **pure/planning/dry-run** vrstvy, nikoli reálná transakce přepnutí veřejné čtečky.
- Budoucí migrace musí propojit současný editor s již existujícími aktivitami, ne zavést další izolovaný plánovač nebo nekompatibilní autorské evidence.

## 6. Co skutečně zbývá k osobnímu QA a prvnímu převedenému titulu

### A. Příští aktivní testovací okno — nejbližší priorita

1. Read/rehydrate, ověř HEAD a CI PR #243; po potřebném bezpečnostním review rozhodnout o oddělení bezpečných částí a připravenosti pro `develop`. Bez automatického merge.
2. Nejdřív ověřit **aktuální cenu** dočasné Supabase branch; vyžádat od Architekta konkrétní cost approval a dostupné testovací okno. Branch nevytvářet dopředu či přes noc.
3. Připravit kompatibilní aplikační schema v dočasné branch po **čistém replay historických migrací** + pouze potřebné kanonické/dev SQL. Nespoléhat na produkci, neaplikovat přímé `supabase/ci` důkazní skripty do prod.
4. **Reálná izolovaná preview identita a login.** `lib/supabase/connectionIsolation.ts` v preview fail-closed, vyžaduje přesný ephemeral ref; `lib/supabase/admin.ts` momentálně úmyslně **odmítá service-role admin operace proti ephemeral**. Zprovoznění profilu/loginu proto potřebuje bezpečný branch-scoped provisioning; **nikdy nepoužít prod service-role key**. `ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID` je server-only exact-user opt-in, ne `NEXT_PUBLIC_`.
5. Zachytit skutečné, ověřené a právně rozlišené byte snapshoty Alenky podle konkrétní Gutenberg edice v izolované DB; nezkopírovat slepě produkční reader DB ani považovat syntetický source URI za ověřené provenience. Teprve poté připojit Vercel preview k **téže** branch a skutečné identitě.
6. Architekt osobně otevře dílo v browseru, převezme svůj úkol, zkontroluje blok, provede jednu opravu, Save → hard reload → vlastní text QA → kontrola neměnné auditní historie. Vydávání zůstává OFF. Po session smazat ephemeral DB a zapsat cleanup+náklady.

**Nepřipravené podmínky = stop/fail closed.** Vyhnout se pseudo-testu, kdy web vypadá funkčně, ale čte syntetiku, lokální storage, nebo chybně produkční DB.

### B. Poté první bezpečný Reader cutover (jeden titul, samostatné gate)

- Uzavřít real source/edition provenance, komponentní rights pro CZ/EU, původní zdroj vs výsledná verze a připojit QA manifest.
- Dokončit plné mapování `note`, `footnote`, `editor_note`, vizuální režim `EMPTY`, verzi stylu, důkazy o čtenářských kotvách/progress/notes.
- Udělat **reálný shadow Reader**, manuální kontrolu browser renderu (stránky/scroll/spread) a porovnání původního/nového zdroje; `lib/publication/readerCutoverDryRun.ts` už počítá blokátory a dry-run, ale **neprovádí přepnutí**.
- Navrhnout a nezávisle otestovat **atomický, auditovaný per-work release/cutover** s immutable manifestem, verzí díla, idempotencí, legacy rollbackem a výslovným prod DB/main schválením; nevyužít prostou změnu `works.status` nebo funkci vracející `publication_allowed=false`.
- Povolit pouze selektivní titul; po zeleném prvním cutoveru teprve vystavět bezpečnou batch frontu pro 49 publikovaných (a drafty řešit zvlášť), bez opakování staré redakce.

## 7. Prognóza počtu seancí — orientační, nikoli příslib

**Seance = jeden souvislý vývojově/testovací průchod zakončený ověřitelným výsledkem (CI, PR, QA nebo rozhodnutím), nikoli fixní hodina či kalendářní den.** Před osobním pilotem jde o nejlepší technický odhad, s vysokou nejistotou kvůli právům, množství typů bloků, migraci notes a dlouhým knihám. Seance se mohou překrývat, nejsou to počty pracovních dnů.

| Milník | Kumulativně od teď | Hlavní neznámé |
| --- | ---: | --- |
| Architekt poprvé provede skutečné textové QA Alenky v izolovaném preview | **2–4 seance** | replay DB migrací, testovací identita, autentický source capture, cena/cleanup |
| První bezpečně převedená **jedna publikovaná** kniha do Semantic Readeru | **5–9 seancí** | právní/ediční evidence, notes/Reader mapping, release/rollback gate a schválení |
| Opakovatelný migrační mechanismus pro více děl | **8–13 seancí** | automatizovaný triage, zdroje/bloky, batch QA, dlouhé knihy a výjimky |
| **49 dnes publikovaných** titulů převedených po dávkách | **14–25+ seancí** | ruční redakční QA, práva konkrétních edic, některé problematické formáty |

Zbývajících **15 draftů** tvoří jinou frontu a přidávají další práci podle práv a míry skutečné redakční nedokončenosti; nejsou v odhadu 49 převedených publikovaných titulů. Prognózu přepočítat empiricky po **prvních třech reálných knihách**. Pokud některé tituly právně nebo sémanticky neprojdou, mají **zůstat ve starém Readeru/HOLD** a nelze slibovat datum úplného dokončení.

**Nezaměňovat** aspiraci „10 minut na titul“ za důkaz 49×10 min: produkční medián má >1 000 bloků, extrémy >6 000 a většina edic nemá hotový nový rights dossier.

## 8. Nezapomenout na hranice a schválení

- `main` a produkční Supabase nechat beze změny. `develop` sloučit až po splnění samostatné integrační brány a explicitní autorizaci Architekta; produkční release/DB apply má zcela separátní autorizační krok.
- Nezakládat permanentní staging jen kvůli pohodlí. Cena ephemeral je samostatné rozhodnutí; žádná ephemeral branch nebyla vytvořena během dnešního E2 browser CI.
- Zelené Vercel build ≠ preview skutečně připojené ke správné DB; kontrolovat ref, env, role a testovacím účtem.
- Chráníme pozice čtenářů, poznámky, identitu díla, práva, schválené historické úpravy a editorovu práci. Neslibovat po zveřejnění automatický release bez auditního kontraktu.
- Případné další úpravy PR #243 udržet na stejné pracovní větvi; v paralelních vláknech nekolidovat. Phoenix jako docs-only checkpoint může být zpracován samostatně bez tažení rozpracovaného E2 kódu.

## 9. Připravený úvodní prompt pro příští hlavní vlákno

> Navazujeme na **ARTales Phoenix `docs/ARTALES_PHOENIX_2026-10-14_E2_BROWSER_MIGRATION.md`**. Nejdřív načti `AGENTS.md`, `docs/WORKFLOW.md`, `docs/RELEASE_POLICY.md`, `docs/ARTALES_DURABLE_CHECKPOINT.md`, Phoenix 13. i 14. 10., obě editorial QA politiky a aktuální PR [#243](https://github.com/ARTalesAdmin/ARTales/pull/243). Ověř GitHub HEAD/CI, Supabase migrace a branch list. Poslední známý PR #243 head `001f2bdae51ac316b428c19d28d86ca487f14e45`, Draft; signed local GoTrue+Chrome browser E2E 38611909299 PASS, žádný human/cloud QA. Architekt chce převést starou Galerii, ale NECHCE předčasný druhý editor ani automatickou publikaci. První reálný test provede sám, jedno dílo Alenka, jedna typografická oprava, Save/reload/QA; text-only vydání je povoleno **až** po splnění nezávislých rights/Reader/release checks. Vyřeš plán krátkodobé izolované testovací DB včetně ceny, canonical migration replay, skutečného zdroje, bezpečného preview loginu (pozor `createAdminClient` odmítá ephemeral) a cleanupu. Nevytvářej cloud ephemeral, dokud Architekt nepotvrdí cenu a reálné testovací okno. Neměň produkci/main, nepouštěj blanket migraci, nemerguj PR #223/#243 naslepo. Potom navrhni co nejkratší faktický krok k tomu, aby Architekt mohl QA otevřít v ARTales, bez dalších odboček.

---
Checkpoint vytvořen jen kvůli durable kontinuitě. **Nikdy z něj neodvozovat implicitní autorizační grant.**
