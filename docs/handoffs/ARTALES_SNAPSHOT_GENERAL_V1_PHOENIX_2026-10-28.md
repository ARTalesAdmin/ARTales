# ARTales — Phoenix handoff | Snapshot general v1
**Předání: 28. 10. 2026, ráno (Europe/Prague)**  
**Repo:** `ARTalesAdmin/ARTales`  
**Záměr:** dokončit obecně použitelný, bezpečný tok **Právní check → Vytvořit Snapshot → evidence a stav v ARTales → následně Semantic Composer v2**, s komponentami oddělenými, ale propojenými.

## 1. Autoritativní stav při předání

- **PR #278:** https://github.com/ARTalesAdmin/ARTales/pull/278, OPEN / **Draft**, **nesloučený**; pracovní větev `feat/artales-snapshot-general-from-legal-20261027`.
- Poslední ověřený HEAD **před zápisem tohoto handoffu**: `9ecf8cbd7a44dead2660614704e4c80e9af9d432`. Po zápisu handoffu **vždy znovu načti HEAD a CI**; staré SHA není autorizačním podkladem pro budoucí merge.
- Produkční `main` při readbacku: `98022c11a440719527eb964c981fbe3fde86de02`. PR #276 a #277 jsou již dříve sloučené a nasazené; PR #278 zatím **není** v produkci.
- Na předchozím HEAD prošly dvě CI kontroly: GitHub Actions `40482683982` (Snapshot source checks) a `40482684334` (build / Legal checks), obě **SUCCESS**. Samotné zelené CI **nevaliduje aplikovatelnost SQL ani RLS za reálných rolí**.
- Nexus `bootstrap_work_context(project="artales")`: **project-only, selectedWork=null, žádná převzatá autorizace**. Registry manifest ukazuje staré `develop`/checkpoint URL; pro tuto etapu platí explicitní rozhodnutí Architekta pracovat v samostatných větvích založených z `main`. `develop` je jen historická reference. Staré `AGENTS.md` a `docs/WORKFLOW.md` jsou stále develop-first; neschválený Draft PR #275 řeší dočasnou dokumentační korekci. Žádný přenos autorizačních práv ani automatické vytvoření oblouku.

## 2. Co v produkci **skutečně funguje**

- **Právní screen v1:** funkční pilot; první uzamčená a schválená edice je *The Great God Pan* / Arthur Machen, Gutenberg **#389**, rozhodnutí **9**, `CZ/EU`, kandidát `98508359-bce1-4e73-b842-b69a9d1112d0`.
- **Raw Snapshot #389:** **PRODUCTION E2E PASS** (skutečný soubor, ne mock). Získáno z pevného Gutenberg mirror URL `https://gutenberg.pglaf.org/cache/epub/389/pg389.epub`; přesný EPUB má **125 934 B** a SHA-256 `2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df`.
- Ověřeno produkční aplikací a Vercel logem: úspěšný upload do soukromého Supabase bucketu, plné kontrolní stažení a shodný SHA-256. Nezávislá SQL kontrola potvrdila 1 objekt v `artales-raw-snapshots`, velikost 125 934 B a správnou content-addressed cestu:
  `gutenberg/389/sha256/2e12d981f9c916e5c6264e284f97b03c8dda52f6de720451d32967d0be8736df/original.epub`.
- Obsahuje jednu interně archivovanou obálku; **veřejné užití ilustrací je vyloučeno**. `semantic_ready=false`, `publication_authorized=false`, `content_correspondence=pending`, nezávislé ověření totožnosti a literární shody edice zůstává pending. Stejný Gutenberg titul/edice může nabídnout jiný technický formát bez opakování nezměněného Legal Checku, ale musí projít kontrolou shody.
- Historický uzavírací důkaz: https://github.com/ARTalesAdmin/ARTales/pull/277#issuecomment-6437257985
- **Čerstvý read-only DB readback 28. 10.:** 1 právní lock, 1 soukromý originál (125 934 B); tabulky `candidate_snapshot_claims` ani `candidate_snapshots` v produkci **neexistují**. Storage policies aktivní jen `artales_snapshot389_admin_insert_v1` a `artales_snapshot389_admin_readback_v1`. Žádná obecná oprávnění nejsou aktivovaná. Snapshot nepublikoval knihu ani nezměnil veřejný Reader.

## 3. Co je implementováno, ale zatím **pouze v PR #278**

- Obecná logika stavu `lib/ingest/generalSnapshotAction.ts`: ready, blocked, archiving, archived / pending QA, verified for composition; žádná publikační eskalace.
- Obecný návrh Gutenberg akvizice `lib/ingest/gutenbergSnapshotAcquisition.ts`: z ověřeného katalogového ID, ne z libovolné URL; zatím podporuje **EPUB** a pevný pattern oficiálně uvedeného mirror hostu (není to zaručený zdroj pro každou edici).
- Akce administrátora podle konkrétního kandidáta `app/api/member/snapshot/[candidateId]/route.ts`: nový readback Legal locku; limit formuláře, kontrola původu požadavku, explicitní soukromá archivace; omezené získání EPUBu; SHA-256; neměnný upload s následným readbackem; registrace až po úspěchu.
- `app/member/snapshot/[candidateId]/page.tsx` + odkaz z detailu Legal: stav i viditelná akce; editor vidí stav, admin může spustit. Opakovaný archivovaný kandidát má zobrazit existující receipt bez nového uploadu.
- `lib/ingest/server/getCandidateSnapshotState.ts`: předává stav z registru. `ARTALES_SNAPSHOT_GENERAL_V1=enabled` je **default OFF**, route a stránka zůstávají nezpřístupněné, dokud nebudou migrace a oprávnění bezpečně ověřeny.
- **Připravené, NEAPLIKOVANÉ SQL:** `supabase/migrations/20261028110000_artales_snapshot_general_v1.sql` (neměnné claims/receipts, vazba claimu na přesný SHA-256, RLS, úzký multi-title private Storage grant); `supabase/migrations/20261028111000_artales_snapshot389_register.sql` (evidence-backed jednorázové převzetí již uloženého #389 **bez nového stažení či nahrání**).
- Zelené zdrojové testy a build **nejsou důkazem funkční obecné produkční pipeline**. Pro jiný právně schválený a uzamčený titul dosud není E2E.
- Podrobný průběžný dokument: `docs/handoffs/ARTALES_SNAPSHOT_GENERALIZATION_2026-10-27.md`.

## 4. Kritické bezpečnostní hranice při převzetí

1. **Neprovádět merge PR #278, APPLY migrací, RLS grant, Vercel env enable, nový produkční ingest ani publikaci bez čerstvého explicitního rozhodnutí Architekta.** Příprava PR nic z toho automaticky nepovoluje.
2. Nejdřív **izolovaná databázová validace obou SQL migrací**: přesné typy/constraints/FK, politiky při admin/editor/anon přístupech, RLS na Storage, vazba candidate → source → decision → SHA256, readback objektu, fail-closed path, opakované/souběžné spuštění, částečný zápis a nepřepisování originálu. Dosud **neproběhla**. Po validaci potřebuje implementace revizi případných chyb a nové CI.
3. Opatrně u **jednorázových claimů**: pokud import po claimu selže, nesmí vzniknout falešný success ani automatické neomezené opakování. Reconciliace musí být auditovatelná, bez DB DELETE/globálních UPDATE.
4. **Převzetí #389** aplikovat až po čerstvém ověření původního objektu, právní edice, owner identity a exact SHA; nesmí dojít k druhému nahrání či přepsání původního EPUBu.
5. I po případné produkční aktivaci **nejprve ověřit #389 jako již archivovaný (bez nové kopie)**; poté samostatně právně uzamknout další odlišný titul a provést jeho skutečný E2E s nezávislým Supabase readbackem.
6. Není dovoleno napojovat Snapshot na **starý produkční Reader**. Cílem je nový `artales.semantic-text.v2` / sémantický Blokový Editor a nový Reader QA; staré knihy migrovat jednotlivě až po archivaci/diffu a zachování původních příspěvků editorů.
7. Role Editor vs Admin, interní uchování vložených obrázků vs právo na jejich veřejné použití a technická volba formátu vs právní identita edice zůstávají **oddělenými branami**.

## 5. Doporučený bezprostřední plán nového vlákna

- Načti Nexus STARTUP-01, AGENTS/WORKFLOW, Continuity/Phoenix, právní closure a **tento handoff**; čerstvě ověř PR #278 HEAD/CI, produkční DB, předchozí #389 receipt a existující autorizace. Pokud není vybraný ARTales Continuity arc, **nevytvářej jej automaticky**.
- Jako první proveď read-only architektonický audit dvou SQL souborů; připrav izolovaný databázový test a označ jakékoliv problémy v RLS/idempotenci. Neprováděj produkční APPLY.
- Po opravách spusť přesné CI, přijmi pravidla jen v rámci samostatně schváleného rozhodnutí. Pak postupné production gates: (1) schválená DB/RLS migrace, (2) evidence-backed #389 register, (3) schválený merge + Vercel READY, (4) explicitní flag enable, (5) #389 no-duplicate, (6) jiný schválený titul E2E.
- **Předávej průběžné Phoenix checkpointy**; žádné domýšlení oprávnění z minulého vlákna.

## Krátká startovní zpráva pro nové vlákno

> Pokračujeme v ARTales Snapshot general v1. Načti Nexus STARTUP-01/AGENTS, Continuity/Phoenix, ARTales AGENTS/WORKFLOW a `docs/handoffs/ARTALES_SNAPSHOT_GENERAL_V1_PHOENIX_2026-10-28.md` z Draft PR #278. Ověř `main`, HEAD/CI PR #278 a produkční archiv #389. Další úkol: izolovaná validace neaplikovaných SQL migrací pro registr claims/receipts a historické převzetí #389, revize RLS/idempotence a příprava skutečně použitelného Legal → Snapshot toku. Neprováděj merge, produkční APPLY, grants, env enable ani publikaci bez mého samostatného rozhodnutí; develop jen referenčně, pracujeme v izolovaných větvích z main.
