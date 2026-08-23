# Moje knihovna — audit Reader progress a Poznámek v0.1

## Rozhodnutí a rozsah

Tento PR je **pouze audit a návrh**. Nemění runtime, databázi, Reader, parser,
stránkování ani veřejný detail díla. Doporučené pořadí je:

1. samostatně dodat account-backed synchronizaci pozice čtení;
2. až nad stabilním progress API složit klidný hub `Moje knihovna`;
3. deep-link pro otevření Poznámek přidat jen tehdy, až ho bude knihovna skutečně
   potřebovat.

Plný library UX teď není malý bezpečný krok. Pozice čtení je pouze v prohlížeči,
zatímco stránka knihovny je server-renderovaná. Přímé spojení by buď falešně
označilo poslední odemčení za poslední četbu, nebo by vytvořilo druhý, klientský
agregační model bez cross-device chování.

## 1. Současný stav Moje knihovna

### Route a komponenty

- Česká i anglická varianta používají tutéž chráněnou route
  **`/account/library`** (`app/account/library/page.tsx`). Nedokončený profil je
  přesměrován přes `requireCompletedAccountProfile`.
- Stránka je server component a skládá UI přímo v route. Sdílenou kartou je
  lokální `LibraryWorkCard`; obálku kreslí `WorkCoverImage`. Navigaci účtu
  poskytuje `components/account/AccountNav.tsx` z account layoutu.
- Stránka dnes obsahuje hero „Pokračovat“, statistiky, nabídku uvítacího
  odemčení, oddělené mřížky odemčených a uložených titulů, kreditní panel a
  náhled sledovaných autorů. Poznámky ani bookmarky nezobrazuje.

### Datové zdroje a význam položek

| Část | Zdroj | Co skutečně znamená |
| --- | --- | --- |
| Odemčené tituly | `getReaderUnlockedWorks` → `reader_entitlements` | Aktivní `online_read` entitlementy, seřazené podle `created_at` od nejnovějšího. |
| Uložené tituly | `getReaderSavedWorks` → `reader_library_items` | Account-backed řádky typu `saved`, podle `updated_at`, nejvýše 12. |
| Statistiky | `getReaderLibrarySummary` | Aktivní entitlementy, library items, kreditní ledger a welcome unlock stav. |
| Sledovaní autoři | `getReaderCommunitySummary` | Samostatná account/community agregace; není to čtenářský progress. |
| Hero „Pokračovat“ | `unlockedWorks[0]` | **Nejnověji vytvořený entitlement**, nikoli poslední otevřená nebo rozečtená kniha. |

Knihovna tedy ukazuje **uložená i odemčená díla**, ale jako dvě nezávislé
kolekce. Stejné dílo může být v obou. `reader_library_items` sice ve schématu
umožňuje `recent` a `last_opened_at`, aktuální Reader je však nezapisuje a stránka
je pro pořadí „Pokračovat“ nepoužívá.

### Local storage versus účet

- Nepřihlášené ukládání používá seznam slugů
  `artales.reader.savedWorks`. Přihlášené ukládání zapisuje přes server action do
  `reader_library_items`.
- `/account/library` vyžaduje účet a načítá pouze serverové `saved` řádky. Lokální
  guest seznam nečte ani při přihlášení neimportuje. Proto lokálně uložené dílo
  není automaticky položkou Moje knihovna.
- Odemčení jsou server-backed `reader_entitlements`; nejde o localStorage.

### Co knihovna ví o návratu do Readeru

- Serverová stránka nezná poslední pozici, procento, stranu, počet stran, layout
  ani `updatedAt` čtení.
- Odkazuje na `/reader/<slug>?mode=full` (odemčené) nebo bez `mode=full` na preview
  (uložené). Reader po otevření full režimu sám obnoví lokální progress pro slug.
- Knihovna neumí odkázat na konkrétní page/progress/note. Zdánlivé pokračování
  funguje jen díky následnému lokálnímu restore na **tomtéž zařízení**.
- Bookmarky a nové Poznámky nejsou do stránky ani jejích serverových dotazů
  zapojené.

## 2. Současný Reader progress

### Úložiště a datový tvar

`lib/reader/readerStorage.ts` používá jeden JSON záznam na dílo pod přesným
klíčem:

```text
artales.reader.progress:<slug>
```

Typ `ReaderProgress` obsahuje všechny požadované údaje:

- `slug`;
- `mode` (`preview` / `full`);
- `progressPercent`;
- `scrollY`;
- volitelné `pageIndex` a `pageCount`;
- volitelné `layoutMode` (`pagedFlow`, `spread`, plus legacy `scroll` / `page`);
- `updatedAt`.

Poznámka k významu: aktuální paged Reader ukládá do `scrollY` normalizovaný
`pageIndex`, nikoli pixelový offset. Pro nové API proto musí být primární
`pageIndex` + `progressPercent`; `scrollY` je kompatibilní fallback, ne spolehlivý
cross-layout souřadnicový systém.

### Save, restore a omezení

- Progress je **jen localStorage**. V repozitáři není progress tabulka, API ani
  account sync. `reader_library_items.last_opened_at` není náhradou za pozici a
  aktuálně se z Readeru neaktualizuje.
- `ReaderClient` restore provádí pouze ve full režimu, po známém `pageCount`.
  Preferuje uložený `pageIndex`, u staršího záznamu odvodí index z procenta,
  omezí ho na aktuální počet stran a ve spread režimu zarovná na dvoustranu.
- Po dokončení počátečního restore se stejný mechanismus ukládání spouští při
  změně aktivní strany, počtu stran nebo layoutu. Tím chrání starý záznam před
  přepsáním stranou 1 během prvního renderu.
- Tento save/restore je vhodné **znovu použít**, nikoli přepisovat. Sync vrstva má
  dodat výběr nejnovějšího lokálního/remote záznamu před restore a bezpečný
  upload po lokálním save.
- `ReaderWorkActions` pozná „má progress“ klientsky jen tehdy, když lokální
  záznam existuje a `scrollY > 0`. Nejde o serverovou ani cross-device znalost.

## 3. Současný stav Poznámek

### Lokální a synchronizovaná data

- Lokální fallback je kolekce `artales.reader.notes:<slug>`. Starý single
  bookmark `artales.reader.bookmark:<slug>` se jednorázově importuje do poznámek,
  ale zůstává jako záloha.
- Synchronizované poznámky používají tabulku `public.reader_notes` z migrace
  `2026-08-14_reader_synced_notes_phase4.sql` a route
  **`/api/reader/notes`**. Tabulka ukládá uživatele, `work_slug`, title/body,
  barvu, progress/page metadata a timestamps.
- RLS pro select/insert/update/delete vyžaduje `auth.uid() = user_id`. API navíc
  ověřuje session, čtení filtruje uživatelem a slugem a mazání uživatelem a ID.
- Reader při open/reload načte lokální poznámky, pro přihlášeného nahraje
  local-only položky a stáhne čerstvý remote snapshot. Výpadek serveru zachová
  lokální kolekci; realtime není potřeba ani implementováno.

### Možnost agregace pro knihovnu

- Databáze **umí** pod RLS vybrat všechny poznámky jednoho uživatele a existující
  index `(user_id, work_slug, updated_at desc)` podporuje seskupení podle díla.
- Současné GET API ale vyžaduje `slug` a vrací poznámky právě jednoho díla.
  Neexistuje endpoint ani server helper pro cross-work seznam, count per work či
  poslední preview.
- Count a nejnovější preview per work jsou z tabulky odvoditelné. Doporučená
  account agregace má vracet pouze `work_slug`, `note_count`, poslední 1–2
  omezené preview a jejich `updated_at`, ne celé zápisníky všech děl.
- `reader_notes` váže dílo textovým slugem, ne FK na `works`. Library dotaz proto
  musí počítat s přejmenovaným/neexistujícím slugem a nesmí kvůli jednomu
  osiřelému záznamu shodit stránku.
- Lokální poznámky jsou rozdělené do klíčů podle slugu. Server-renderovaná
  knihovna je nevidí; klientské procházení všech localStorage klíčů by bylo
  křehké a nevytvořilo by cross-device hub. Pro první library integraci jsou
  vhodné serverové poznámky přihlášeného uživatele, zatímco lokální fallback
  zůstává funkční uvnitř Readeru.

### Poznámka jako fallback návratu

Nejnovější poznámka může poskytnout `pageIndex`, `progressPercent`, `scrollY`,
`pageCount` a `layoutMode`. Je proto technicky použitelná jako **poslední
fallback**, když pro dílo neexistuje lokální ani synchronizovaný reading
progress. Nesmí ale přebít skutečnou pozici čtení: poznámka je záměrný návratový
bod, ne důkaz, kde čtenář skončil.

## 4. Mezery a doporučená architektura

### Kritická mezera: account-backed progress

Nejdřív doporučujeme samostatný high-risk Reader/Supabase PR pro synchronizovaný
progress. Bez něj nelze spolehlivě splnit PC → telefon ani správně seřadit
„Pokračovat“. Oddělení drží DB/RLS a konfliktní synchronizaci mimo vizuální
library změnu a dovolí otestovat ochranu lokálních pozic samostatně.

Minimální model pro následující PR:

- tabulka `reader_progress` s jedním řádkem na `(user_id, work_slug)`;
- sloupce odpovídající `ReaderProgress` (`mode`, percent, scroll/page, page count,
  layout, `updated_at`), plus serverové timestamps;
- unique `(user_id, work_slug)`, index pro `(user_id, updated_at desc)` a
  owner-only select/insert/update/delete RLS;
- cookie-based endpoint podobný notes API; jeden slug pro Reader a account
  summary/list pro knihovnu;
- localStorage zůstává zdrojem offline fallbacku a **nikdy se nemaže**;
- při open se porovná validní ISO `updatedAt`; novější záznam vyhraje. Novější
  local se upsertne, novější remote se zapíše také do lokální cache a obnoví se;
- při chybě sítě/remote se pokračuje z lokálního záznamu bez přepsání nebo
  ztráty. Reload/open sync stačí, realtime ani logout změny nejsou potřeba;
- vzdálený záznam se nesmí slepě zapsat stranou 1 před dokončením restore a
  migrace musí být nasazena před runtime kódem;
- přístup k dílu se nadále ověřuje stávající access logikou. Progress sám nikdy
  nesmí udělovat entitlement.

Před implementací je vhodné rozhodnout, zda stabilní identita má zůstat slug
(shoda s lokálními klíči a notes), nebo použít `work_id` s uloženým slugem pro
route. To je schématové rozhodnutí, ne detail library karty.

### Zdrojový model knihovny po progress MVP

Library server agregace má spojovat podle slugu/identity díla, ale zachovat
samostatné významy:

1. **Progress** určuje pořadí a cíl „Pokračovat“.
2. **Entitlement** určuje, zda je možný full Reader; progress přístup neuděluje.
3. **Saved** je wishlist/archive signál, nikoli čtenářská historie.
4. **Notes** určují zařazení do „Díla s poznámkami“ a sekundární metadata.

Pokud stejné dílo patří do více skupin, není nutné všude opakovat plnou kartu.
Continue může být kompaktní prioritní řada, zatímco uložená/odemčená sekce je
archiv a notes sekce může používat menší řádky nebo rozbalení.

## 5. Doporučená struktura a UX Moje knihovna

### A. Pokračovat ve čtení

- Nahoře nejvýše 1 výraznější karta a 2–3 kompaktní další položky, řazené podle
  nejnovějšího reading `updatedAt`, nikoli odemčení ani poslední poznámky.
- Karta: menší obálka, titul/autor, klidný progress údaj (např. „42 % · strana
  18 z 43“) a čas posledního čtení bez technických detailů.
- Primární CTA **„Pokračovat ve čtení“** otevře `/reader/<slug>?mode=full` a
  Reader vybere nejnovější synced/local progress. Pokud full přístup vypršel,
  použije stávající access cestu; karta nesmí obcházet oprávnění.
- Není-li progress, lze použít nejnovější note position, ale text akce má jasně
  říct „Přejít k poznámce“, ne předstírat pokračování. Teprve posledním fallbackem
  je začátek Readeru.
- Empty state: „Až otevřeš první titul, najdeš tady rychlý návrat ke čtení.“ s
  jediným odkazem do klidnější archive/galerie.

### B. Uložená / odemčená díla

- Jedna klidná archive sekce se segmenty/filtrem „Všechna / Odemčená / Uložená“;
  výchozí „Všechna“ deduplikuje dílo a pomocí nenápadných badge vysvětlí stav.
- Karty zachovají obálku, titul a autora. Dlouhé summary, nákupní obsah, kreditní
  statistiky a delivery vysvětlování nemají být na každé kartě.
- Odemčené: primární „Číst“; pouze uložené: „Otevřít ukázku“ a sekundární detail.
  Membership access a permanent unlock musejí zůstat vizuálně i datově
  rozlišitelné podle existující access logiky.
- Empty state pro odemčené a uložené může mít jednu větu a jedno CTA „Procházet
  galerii“. Neopakovat stejnou promo kartu v několika sekcích.

### C. Díla s poznámkami

- Samostatná sekce až za continue/archive; poznámky jsou sekundární k četbě.
- Jeden kompaktní řádek/karta na dílo: obálka nebo miniatura, titul, badge
  **„3 poznámky“**, datum poslední úpravy a sekundární CTA **„Poznámky“**.
- Výchozí stav bez dlouhých textů. Nejnovější 1 preview zobrazit jen na širším
  displeji nebo po explicitním rozbalení; maximálně 2, oba zkrácené na 2 řádky.
  Nikdy nerenderovat celý obsah ani všechny poznámky na library stránce.
- Empty state: „Poznámky, které si přidáš ve čtečce, se zobrazí u příslušného
  díla.“ Bez CTA, pokud už sekce Pokračovat nabízí další krok.
- Osamocené note slugy nezobrazovat jako rozbité karty; zachovat data a případně
  je později nabídnout v bezpečné správě poznámek.

### Jak udržet klid a mobilní chování

- Nad přehybem pouze nadpis a Continue; současné account statistiky, welcome,
  kreditní a community panely přesunout pod čtenářská data nebo na jejich
  existující account routes. Knihovna nemá být druhý account dashboard.
- Používat progressive disclosure: počáteční limit, „Zobrazit vše“, segment a
  rozbalení preview. Žádné horizontální karusely vyžadující přesné gesto.
- Na telefonu jeden sloupec, kompaktní miniatura, CTA pod sebou nebo přes celou
  šířku, progress text místo širokého grafu. Note body ve výchozím stavu skrýt.
- Badge count musí mít lokalizované jednotné/množné číslo a nesmí být jediným
  nositelem významu; CTA i headings zůstávají čitelné pro screen reader.

## 6. Reader deep-link audit a doporučení

| Cíl | Stav dnes |
| --- | --- |
| `mode` query | Podporováno: pouze přesná hodnota `full`, jinak preview. |
| page target | Nepodporováno routou ani `ReaderClient` props. |
| progress target | Nepodporováno query; pouze lokální restore podle slugu ve full režimu. |
| note target | Nepodporováno query; výběr a navigace fungují pouze uvnitř již otevřeného Readeru. |
| notes panel open | Nepodporováno query. |

Bezpečný první krok je **nepřidávat page/progress do URL**. Standardní library
odkaz zůstane `/reader/<slug>?mode=full`; Reader při open synchronizuje progress,
porovná `updatedAt` a obnoví vítěznou pozici. URL tak nekopíruje nestabilní page
index závislý na layoutu/fontu a nemění parser ani slicing.

Po progress MVP lze pro sekundární CTA navrhnout úzký kontrakt, například
`?mode=full&panel=notes` a případně opaque `note=<uuid>`. Reader ho smí použít až
po načtení vlastních poznámek, note ID musí patřit přihlášenému uživateli i
aktuálnímu slugu a chybějící note bezpečně spadne na běžné otevření. Samotné
`page` nebo procento v URL kvůli library integraci nyní není potřeba.

## 7. Rozdělení implementace

### PR A — synced reader progress (doporučený další krok)

DB/RLS, progress API, latest-wins open/reload sync, zachování localStorage a
cílené Reader testy. Bez library redesignu, notes agregace, parseru či slicing
změn. **Risk: high**, protože se dotýká Readeru a Supabase.

### PR B — klidný library hub

Account server agregace progress + entitlements + saved + note counts, UI tří
sekcí a lokalizované empty states. Nejprve bez note body preview a bez deep-linku;
preview přidat až po ověření hustoty. **Risk: medium** (account UX a více zdrojů),
DB může být `no`, pokud PR A dodá vhodný read model/API.

### PR C — volitelné Notes otevření

Pouze pokud preview potvrdí potřebu: `panel=notes`, volitelný owner-checked note
target a mobilní/accessibility testy. Bez veřejného sdílení. **Risk: high** kvůli
Reader navigaci; oddělení dovolí snadný rollback.

## 8. Rizika a ochrany

- **Ztráta novější lokální pozice:** nikdy nemaž localStorage; validuj timestamps,
  latest wins a při remote chybě nic lokálně nepřepisuj.
- **Race při prvním renderu:** neuploadovat stranu 1 před dokončením remote/local
  restore; sdílet existující `progressRestoreReady` princip.
- **Změna počtu stran/layoutu:** page index clampnout; percent použít jako
  fallback. Progress není stabilní kotva do obsahu.
- **Únik soukromých dat:** owner-only RLS, ověřená session, explicitní user filter,
  žádné service-role čtení v browseru a žádné note texty v logu/analytics.
- **Access záměna:** progress ani poznámka neudělují plný přístup. Continue vždy
  prochází existujícím `canOpenFullReader` rozhodnutím.
- **Duplicitní a přeplněné karty:** deduplikovat identity a omezit počty/previews;
  saved, entitlement, progress a notes neslévat do jedné neurčité vlastnosti.
- **Slug drift a orphan notes:** tolerantní join, zachování soukromých dat,
  žádné automatické destruktivní cleanupy.
- **N+1 / velký payload:** agregovat count/latest serverově, stránkovat archive a
  neposílat všechna těla poznámek do knihovny.
- **Časové konflikty:** klientské `updatedAt` je pro MVP přijatelné, ale musí být
  validní ISO a omezené API validací; později lze přidat server revision.

## 9. Develop preview checklist

### Tento audit-only PR

- [ ] Ověřit, že diff obsahuje pouze tento dokument.
- [ ] Ověřit `git diff --check`.
- [ ] Potvrdit, že se nezměnil public work detail CTA, parser, slicing, platby,
  access logika, DB, env ani package soubory.
- [ ] Product review: potvrdit tři sekce, prioritu progress před note a rozdělení
  do samostatných PR.

### Checklist pro budoucí progress/library preview

- [ ] Anonymně: starý localStorage progress se obnoví a při výpadku zůstane.
- [ ] Přihlášeně: PC → telefon i telefon → PC po open/reload obnoví novější pozici.
- [ ] Offline lokální změna se po návratu sítě bezpečně nahraje; starší remote ji
  nesmaže.
- [ ] Dva účty nevidí ani nemění vzájemný progress/notes (RLS + API test).
- [ ] Continue řadí podle reading progress, nikoli entitlementu nebo note data.
- [ ] Bez progress použije note pouze jako jasně označený fallback.
- [ ] Saved-only, unlocked-only, obojí, membership access a expirovaný access mají
  správné CTA bez obcházení oprávnění.
- [ ] Note count, 0/1/many lokalizace, zkrácení preview a orphan slug jsou bezpečné.
- [ ] Empty, loading, remote error a částečný výpadek nezpůsobí prázdnou stránku.
- [ ] Desktop a telefon zůstávají klidné, bez overflow a s ovladatelnou klávesnicí.
- [ ] Parser, page slicing, Reader notes navigace a Phase 3 preferences regresně
  fungují beze změny.

## 10. Rollback

U tohoto PR stačí revert dokumentačního commitu; nejsou data, runtime ani
nevratné kroky.

Pro budoucí progress PR: nejprve revertovat runtime/API používání a ponechat
localStorage i aditivní DB tabulku s daty. Tabulku nedropovat v běžném rollbacku;
její archivace nebo odstranění vyžaduje samostatné výslovné schválení a zálohu.
Po rollbacku ověřit lokální restore ve full Readeru. Library PR lze revertovat
samostatně zpět na současné entitlement/saved zobrazení.

## 11. Budoucí community-processor cesta (mimo rozsah)

Soukromé progress a poznámky mají zůstat osobním reader modelem. Případný
community processor později nesmí automaticky číst ani publikovat note body.
Bezpečná cesta je samostatný, výslovný opt-in „odeslat výňatek/podnět“, který
vytvoří nový moderovatelný community objekt s vlastní provenance, consentem a
možností odvolání. Zdrojová poznámka zůstane soukromá a její smazání či změna se
nesmí tiše tvářit jako veřejná editace. Implementace processoru, public sharing,
komentářů a komunitních anotací do této ani navazující library práce nepatří.

## Metadata patche

- **Summary:** audit současné knihovny, progress a Poznámek; návrh pořadí sync →
  library hub → volitelný notes deep-link.
- **Changed files:** pouze
  `docs/ARTALES_LIBRARY_READER_PROGRESS_NOTES_AUDIT_V0_1.md`.
- **Risk:** `low` — pouze dokumentace, bez runtime a dat.
- **Target:** `develop first`.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback notes:** revert dokumentačního commitu.
- **Test checklist:** `git diff --check`, kontrola rozsahu a product review v
  develop PR; runtime testy nejsou pro docs-only patch relevantní.

## Stav navazující implementace (v0.1)

Synchronizovaný Reader progress byl implementován jako technický předpoklad
budoucího hubu Moje knihovna. Moje knihovna ani její výběrová pravidla se v tomto
kroku nemění; jejich realizace zůstává samostatným budoucím PR po ověření progress
syncu v develop preview. Progress je signál historie čtení, nikoli trvalé
odemknutí díla.
