# ARTales — audit navigace a vyhledávání děl v0.1

**Stav:** dokumentační audit, bez implementace

**Cíl:** `develop first`

**Riziko tohoto PR:** `low`

**DB:** `no`

**Env:** `no`

## 1. Shrnutí a rozhodnutí

Repozitář už má funkční editorový seznam všech děl na `/member/works`, vytvoření na `/member/works/new` a editaci na `/member/works/[slug]/edit`. Seznam je serverová stránka chráněná rolí editor/admin a jedním Supabase dotazem načítá díla bez omezení na status; z pohledu aplikačního kódu tedy zahrnuje `draft`, `review`, `published` i `archived`. Nemá hledání, filtry, záložky, stránkování ani query parametry a řadí pouze podle `title` vzestupně.

**Doporučené MVP:** přidat nad seznam děl interní typeahead „Najít dílo“, který po zadání alespoň 2 znaků serverově hledá pouze díla dostupná přihlášenému editorovi/adminovi podle názvu (včetně `title_cs` a `title_en`), autora a slugu. Přesná shoda UUID může být podporovaná jako interní identifikátor. Výsledek ukáže název, autora, status, slug a poslední úpravu; výběr přejde rovnou na `/member/works/[slug]/edit`. MVP nemá používat tagy, nemá měnit veřejnou Galerii a nemá načítat všechna neveřejná metadata do klienta.

Před implementací je nutné v cílovém Supabase prostředí ověřit policies tabulky `works`. Jejich definice není v dostupné historii migrací repozitáře. Guard stránky je důležitý, ale nenahrazuje RLS. Nový vyhledávací server action/route musí guard i uživatelský Supabase klient použít znovu.

## 2. Rozsah auditu a metoda

Audit je založen na statickém průchodu současného `develop` snapshotu: App Router stránkách, členské navigaci, guardech a rolích, `dbWorks`/`dbTags`, formuláři a server actions pro díla a tagy, veřejné Galerii a verzovaných Supabase migracích. Nebyla připojena ani dotazována živá databáze, takže skutečný počet děl, naplněnost tagů a aktuálně nasazené policies nelze z repozitáře potvrdit.

### Důležité hranice jistoty

- Kód potvrzuje hodnoty statusu a zamýšlený datový tok; nepotvrzuje distribuci produkčních dat.
- Aplikace zapisuje na `works` auditní pole `created_by`, `updated_by`, `published_by` a `published_at`, ale základní migrace vytvářející `works` ani její RLS policies v repozitáři nejsou. Je proto nutné ověření v sandboxu/Supabase dashboardu před návrhem vlastnických pohledů.
- Neexistuje doložené pole `owner_id`, `editor_id`, `submitted_by` ani marker „hotovo“. `member_submissions.submitted_by_user_id` patří k příspěvkům, ne k vlastnictví díla.
- Audit neobnovuje zrušený patch **v0.10.15k — Table Pagination & Generated Header Fix**. Nenavrhuje změnu tabulek, parseru ani stránkování readeru.

## 3. Mapa současné implementace

### 3.1 Interní trasy a navigace

| Účel | Trasa | Implementace | Ochrana | Data / chování |
|---|---|---|---|---|
| Členský shell | všechny `/member/*` | `app/member/layout.tsx`, `components/member/MemberZoneNav.tsx` | `requireMemberZoneAccess` (`admin`, `editor`, `member`) | Sidebar má odkazy Díla, Autoři, Kolekce, Tagy aj.; nemá globální hledání. |
| Seznam děl | `/member/works` | `app/member/works/page.tsx` | navíc `requireEditorOrAdmin` | Server component volá `getWorksForMember`; karty; řazení podle title; odkazy na veřejný detail a editaci. |
| Nové dílo | `/member/works/new` | `app/member/works/new/page.tsx`, `components/editor/WorkEditorForm.tsx` | `requireEditorOrAdmin` | Serverově načte autory, kolekce, tagy a číselníky; výchozí status `draft`. |
| Editace díla | `/member/works/[slug]/edit` | `app/member/works/[slug]/edit/page.tsx`, `WorkEditorForm` | `requireEditorOrAdmin` | `getWorkForEditBySlug`; editace metadat a bloků, výběr tagů; success/error query parametry. |
| Veřejný detail (CZ alias) | `/dilo/[slug]` | alias pod `app/dilo/[slug]` | veřejná cesta | Ze seznamu se odkaz zobrazuje bez ohledu na status; skutečnou dostupnost musí vynutit veřejný dotaz/RLS. |
| Veřejný detail | `/work/[slug]` | `app/work/[slug]/page.tsx` | veřejná cesta | `getWorkBySlug` explicitně filtruje `status = published`. |
| Veřejná Galerie | `/gallery` (`/galerie` je lokalizovaná cesta/alias) | `app/gallery/page.tsx`, `getWorksForGallery` | veřejná | Dynamická serverová stránka, pouze `published`, nejnovější `published_at` první; bez hledání a filtrů. |
| Správa tagů | `/member/tags`, `/member/tags/new`, `/member/tags/[slug]/edit` | příslušné stránky, `lib/dbTags.ts`, `lib/actions/tags.ts` | `requireEditorOrAdmin` | CRUD základ, typy, kanonická vazba a veřejná viditelnost. |

`/member/works` dnes nepřijímá žádné `searchParams`. Nejsou zde filtry, tabs, stránkování ani search input. Data se načtou na serveru přes cookie-aware Supabase klienta a do HTML se vyrenderuje celý povolený výsledek. Stránka není „moje díla“: aplikační dotaz nefiltruje `created_by` ani `updated_by`.

### 3.2 Přirozené umístění hledání

První implementace patří **nad seznam/karty na `/member/works`, pod nadpis a primární akci „Nové dílo“**. Je to nejčitelnější kontext, nejmenší rozsah a nezatěžuje globální sidebar složitým interaktivním prvkem. Výsledek má po výběru navigovat přímo na editaci, protože hlavní případ užití je rychle pokračovat v konkrétní redakční práci. Klávesa Enter může otevřít aktivní výsledek; samostatná akce „Zobrazit výsledky v seznamu“ je vhodný fallback.

Globální interní navigace je až další etapa: znamenala by rozhodnout rozsah napříč díly, autory, kolekcemi a oprávněními a změnit komponentu použitou na všech interních stránkách.

### 3.3 Současný datový tok seznamu

1. `MemberLayout` ověří obecný vstup do zóny.
2. `MemberWorksPage` znovu vyžádá `requireEditorOrAdmin()`.
3. `getWorksForMember()` vytvoří serverový Supabase client s anonymním klíčem a session cookies.
4. Jeden dotaz na `works` vybere ID, legacy i lokalizované názvy/subtitles/summaries, slug, jazyk, status, origin, cover metadata a vložené relace primárního autora a legacy primární kolekce.
5. Dotaz nemá `.eq("status", ...)`, ownership podmínku, limit ani range; `.order("title")` vrací všechny řádky, které dovolí RLS.
6. Stránka z odpovědi používá název, podnázev, autora, jazyk, status a kolekci. UUID ani časové údaje nezobrazuje.

Veřejný `getWorksForGallery()` je naopak vytvořen nad veřejným Supabase klientem, explicitně přidává `.eq("status", "published")` a řadí podle `published_at` sestupně. Toto oddělení je správný precedent: interní a veřejné hledání musí mít oddělené query funkce.

## 4. Datový model díla relevantní pro hledání

### 4.1 Potvrzená pole a význam

| Oblast | Potvrzená pole / relace | Poznámka pro search |
|---|---|---|
| Identita | `works.id` (vazby ho používají jako UUID), unikátní `slug` | UUID je bezpečný interní label až po autorizaci; slug je vhodný k partial search i navigaci. |
| Název | `title`, `title_cs`, `title_en`; dále subtitle varianty | Hledat ve všech názvových variantách. `title` je legacy/fallback, ne generovaný header. |
| Autor | `primary_author_id -> authors(id, name, name_cs, name_en, slug)` | Pro label použít lokalizované/fallback jméno; MVP může hledat jméno. PostgREST hledání přes relaci je třeba implementačně ověřit. |
| Stav | `draft`, `review`, `published`, `archived` | Není samostatné visibility pole na `works`; publikovatelnost je v současném kódu odvozena od statusu. |
| Publikace | `published_at`, `published_by` se nastaví pouze při publikování a jinak se nulují | Veřejné dotazy musí vždy explicitně vyžadovat `published`. |
| Audit | `created_by`, `updated_by` se zapisují; `created_at`/`updated_at` jsou používány jako konvence schématu | Seznam je nyní nevybírá. Před tabs „Moje…“ ověřit jejich typy, backfill a spolehlivost v DB. |
| Zařazení | legacy `collection_id`, junction `work_collections`; `work_tags` | Kolekce je možný budoucí veřejný facet. Tagy nejsou nutné pro quick-find. |
| Obsah / edice | summary, jazyk, origin, edition a interní poznámky, bloky | Nenačítat do autocomplete; jde o zbytečná nebo citlivá metadata. |

V repozitáři není nalezeno pole pro „generated title/header“. Lokalizované názvy nejsou generované hlavičky. Search nemá odvozovat názvy z content blocks a nemá se dotknout reader/parser logiky.

### 4.2 Nejbezpečnější result projection

Interní autocomplete má vracet pouze:

- `id` (celé UUID lze zobrazit až jako sekundární interní údaj; v běžném řádku stačí krátká vizuální podoba),
- `slug`,
- `title`, `title_cs`, `title_en` pro správný fallback,
- `status`,
- `updated_at`,
- primárního autora: `id`, relevantní name varianty a případně slug.

Nemá vracet summary, content/content_blocks, interní ediční poznámky, cover request/path ani tagy. Cílové URL se skládá serverem/komponentou jako `/member/works/${slug}/edit`; neakceptovat libovolnou URL z výsledku.

### 4.3 Drafty, vlastnictví a dokončení

- `getWorksForMember()` nemá status filtr, takže aplikační dotaz je připraven zahrnout drafty, review, published i archived. Skutečně vrácené řádky nadále určuje RLS.
- Interní stránka i create/edit actions jsou dostupné jen aktivním rolím `admin` a `editor`. Role `member` vidí shell, ale guard seznamu ji přesměruje.
- „Moje“ nelze spolehlivě definovat z UI. `created_by` znamená zakladatele a `updated_by` posledního editora, ne vlastníka; primární autor není editor. Bez produktového rozhodnutí se nemá žádné z nich vydávat za ownership.
- „Rozpracované“ lze pragmaticky mapovat na `draft` + `review`, „hotové“ nejvýše na `published` (případně `archived` odděleně). To je workflow interpretace, nikoli uložený completion marker, a musí být před implementací potvrzena.

## 5. Stav tagového základu

### Co už existuje

- Schéma `tags` podporuje český/anglický label a popis, slug, typ, kanonický tag, `is_public_visible`, pořadí a auditní pole.
- Junction `work_tags` je many-to-many, má pořadí a auditní pole; indexy jsou podle `(work_id, sort_order)` a `(tag_id, sort_order)`.
- Interní editor umí tag vytvořit/upravit a v `WorkEditorForm` vybírat více tagů seskupených podle typu. Create/update díla vazby synchronizují.
- Detail díla umí načíst veřejně viditelné tagy připojené k publikovanému dílu a zobrazit je. Existuje helper pro seznam veřejně viditelných tagů.
- RLS migrace povoluje veřejnosti jen viditelné tagy a tagové vazby publikovaných děl; editorům/adminům dovoluje správu.

### Co pro discovery chybí

- Galerie tagy nenačítá ani podle nich nefiltruje a nemá facets/search UI.
- Interní seznam děl tagy nenačítá ani nefiltruje.
- Repozitář neobsahuje metriku pokrytí, kurátorský slovník s pravidly použití, synonymní vyhledávání, kontrolu osiřelých/duplicitních tagů ani důkaz smysluplného naplnění děl.
- `is_public_visible` řeší viditelnost taxonomie, ne kvalitu nebo úplnost klasifikace.

**Verdikt:** technická relace a editor existují, ale tagy nejsou dnes bezpečný primární mechanismus quick-find. První implementace je má vynechat. Později jsou pro discovery potřeba schválená taxonomie (typy/žánry/témata), pravidla a odpovědnost za kuraci, backfill, měření pokrytí, synonym/canonical chování, public-only query testy a návrh facets s počty. To má být samostatný úkol; tento PR tagy nemění.

## 6. Porovnání interních variant

### A. Jednoduché hledání v načteném seznamu

- **Složitost:** nízká. Client component s inputem a normalizovaným filtrem nad props.
- **Pravděpodobné soubory:** `app/member/works/page.tsx`, nová komponenta např. `components/member/WorksListSearch.tsx`; případně test.
- **DB/query dopad:** žádný nový dotaz; současný dotaz by mohl doplnit `updated_at`.
- **Permission riziko:** nízké pouze pokud stránku a data stále chrání guard + RLS. Problém je, že všechna dostupná díla a jejich metadata jsou odeslána klientu před filtrováním.
- **UX hodnota:** dobrá pro desítky děl, okamžitá odezva; není to skutečný autocomplete napříč větším datasetem.
- **Před launchem:** ano, pokud je seznam malý a projekce minimální. Neškáluje a nesmí se zobecnit na veřejný klient.

### B. Interní typeahead/autocomplete

- **Složitost:** střední. Debounce, loading/empty/error stav, klávesnice a ARIA combobox, serverová validační a query vrstva, limit výsledků a navigace.
- **Pravděpodobné soubory:** `app/member/works/page.tsx`, nová reusable UI komponenta, `lib/dbWorks.ts`, nový interní server action nebo route pod `/api/member/works/search`; testy. `MemberWorkListItem` se nemá rozšiřovat o obsah.
- **DB/query dopad:** read-only parametrizovaný dotaz s minimální projekcí a limitem (např. 8–10). Bez migrace pro MVP, pokud současný objem a case-insensitive prefix/contains hledání vyhoví. Autorova relace může vyžadovat dvoukrokový dotaz nebo bezpečný DB helper; neimprovizovat neomezený client join.
- **Permission riziko:** střední a řiditelné. Endpoint/action musí volat `requireEditorOrAdmin`, používat session Supabase client a spoléhat i na ověřené RLS. Rate/length limit, escape PostgREST filter syntax a nevracet skrytá pole.
- **UX hodnota:** nejvyšší pro konkrétní editorový úkol; funguje napříč všemi povolenými statusy a vede přímo do editace.
- **Před launchem:** ano po auth/RLS a accessibility testech. Doporučené MVP.

### C. Segmentované interní pohledy

- **Složitost:** nízká až střední pro status tabs; střední až vysoká pro pravé „Moje“.
- **Pravděpodobné soubory:** works page, `lib/dbWorks.ts`, případně malá tabs/filter komponenta a interní copy.
- **DB/query dopad:** status query parametr nebo serverové skupiny; „nedávno upravené“ vyžaduje vybrat/řadit `updated_at`. „Moje“ vyžaduje potvrdit ownership semantiku a data.
- **Permission riziko:** nízké, pokud filtr jen zužuje už RLS-povolené řádky; vysoké, pokud UI mylně považuje `created_by` za autorizaci.
- **UX hodnota:** dobrý doplněk. Doporučené pořadí po MVP: „Všechna“, „Rozpracovaná“ (`draft`/`review` po potvrzení), „Publikovaná“, „Archiv“; „Nedávno upravené“ spíš sort/preset. „Moje“ odložit.
- **Před launchem:** status tabs ano, ale nejsou náhradou hledání a nemají blokovat MVP.

### D. Globální interní command/search

- **Složitost:** vysoká. Shell-level UI, více entit, sjednocené výsledky, shortcut/focus management a pravidla rolí.
- **Pravděpodobné soubory:** member layout/nav, sdílený command component, samostatné query vrstvy pro works/authors/collections a testy.
- **DB/query dopad:** více omezených dotazů nebo nový agregující endpoint; později indexy.
- **Permission riziko:** vyšší kvůli smíchání entit a rozdílným oprávněním.
- **UX hodnota:** vysoká až s širším interním obsahem a častým cross-entity workflow.
- **Před launchem:** nedoporučeno jako první krok; příliš široký scope.

## 7. Doporučené MVP: interní autocomplete rychlé navigace

### Funkční rozsah

1. Umístit input na `/member/works` nad seznam, ne do globálního navu.
2. Začít dotaz od 2 znaků, debounce přibližně 200–300 ms, limit 8–10 výsledků.
3. Hledat case-insensitive v `title`, `title_cs`, `title_en`, `slug`; autora hledat podle dostupných variant `name`, `name_cs`, `name_en` (a volitelně author slug). Pokud vstup validuje jako celé UUID, přidat přesnou shodu `works.id` — nikoli `ILIKE` nad UUID.
4. Neomezovat podle statusu; vrátit všechny statusy, které dovolí přihlášená role a RLS.
5. Výsledek: lokalizovaný/fallback název jako primary; autor, interní status, poslední změna a slug jako secondary. UUID zobrazit jen při UUID dotazu nebo jako nenápadný interní detail.
6. Klik/Enter naviguje přímo na `/member/works/[slug]/edit`. Nabídnout odkaz na seznam/filtrovaný výsledek, ne automatické otevření prvního výsledku během psaní.
7. Stavy: nápověda před hledáním, loading, bez výsledků, chyba bez úniku DB textu; správná klávesnice, focus a screen-reader oznámení.

### Doporučená query hranice

Preferovaná varianta je server action nebo interní route, která:

- nejdřív volá `requireEditorOrAdmin()`;
- normalizuje délku vstupu (např. max. 100 znaků) a bezpečně sestaví PostgREST filtr;
- používá `createClient()` se session cookies, nikdy service-role klienta;
- vybírá jen result projection a aplikuje hard limit;
- zachová RLS jako druhou autorizační vrstvu;
- neposílá cache/shared response s interními daty (`private`/`no-store` podle zvoleného transportu).

Hledání autora přes embedded relation nemusí fungovat stejně jako hledání sloupců `works`. Bez DB migrace jsou bezpečné dvě možnosti: (1) nejprve omezeně najít author IDs podle jména a pak hledat `works.primary_author_id IN (...)`, nebo (2) paralelně spojit omezené výsledky z názvu/slugu a autora na serveru, deduplikovat a limitovat. Konkrétní PostgREST chování se má ověřit integračním testem proti sandboxu.

### Proč ne pouze filtrovat současný seznam

Client-side filter je rozumný fallback pro malý dataset, ale současná karta načítá více metadat než autocomplete potřebuje a seznam nemá limit. Serverový typeahead lépe odpovídá růstu a nevytváří zvyk posílat všechny neveřejné názvy do klienta. Lze přitom zachovat současný seznam pod ním beze změny jako browsing fallback.

### Volitelné tabs

Do stejného MVP je nepřidávat, pokud není uživatelsky nutné. Následný malý krok může přidat status tabs. „Moje rozpracované“ a „Moje hotové“ nezařazovat, dokud není schválena definice vlastnictví a „hotovo“.

## 8. Bezpečnost a oprávnění

### Povinné podmínky interního hledání

- Guard na stránce nestačí: každý endpoint/action musí samostatně ověřit aktivní editor/admin roli.
- Query musí běžet s přihlášenou session a policies tabulky `works` musí být ověřeny v sandboxu pro select draft/review/published/archived i pro zamítnuté role.
- Neautorizovaný/odhlášený request nesmí rozlišit „dílo existuje“ od „dílo není dostupné“ a nesmí vrátit title, slug, UUID ani počet výsledků.
- Nepoužívat service-role key, veřejný statický JSON, shared cache ani client-side preload všech děl.
- Výsledek musí být minimální. Zvlášť nevystavovat content, summary, interní ediční poznámky, source reference, cover request/path nebo draft title mimo interní autorizovanou odpověď.
- Filtr nesmí umožnit injekci PostgREST `.or(...)` syntaxe. Vstup validovat/escapovat a používat builder, kde je to možné.
- Navigace do editoru má znovu projít existujícím guardem a RLS; autocomplete výsledek není autorizační token.

### Povinné podmínky veřejného hledání

- Použít samostatnou public query/API, která **vždy** explicitně filtruje `status = published`, a zároveň RLS omezuje public select na published.
- Neznovupoužívat interní endpoint ani jeho DTO. Sdílet lze pouze prezentační primitiva (input/result row), nikoli permission/query logiku.
- Nevracet interní UUID, auditní uživatele, statusy jiných než published, interní poznámky ani existenci draft slugů/titles.
- Testovat přímé API dotazy jako anon i authenticated reader/member, nejen skrytí UI.

## 9. Výkon a indexy

Repozitář neobsahuje aktuální počet děl ani telemetry doby dotazu. Proto nelze tvrdit, že client filter je dnes dostatečný. Praktický práh:

- do několika desítek až nízkých stovek minimálních řádků může client filtering subjektivně fungovat, ale stále zvětšuje payload a bezpečnostní dosah;
- od stovek děl nebo při měřitelném pomalém payloadu použít serverový search (doporučený už nyní);
- při tisících děl a `%term%` přes více lokalizovaných polí vyhodnotit `EXPLAIN ANALYZE`, reálné p95 a až poté indexy.

MVP má použít minimální select, limit, debounce a zrušení/stale-response ochranu. Přesný slug/UUID a prefix match mohou využít běžnější indexové strategie; nekontrolované contains `ILIKE '%x%'` může skončit sekvenčním scanem. PostgreSQL trigram (`pg_trgm`) nebo full-text search může být budoucí optimalizace pro diakritiku, překlepy a relevance, ale je pro první krok pravděpodobně nadbytečný. Žádná migrace nemá vzniknout bez měření a samostatného výslovného zadání. Případná budoucí práce má vyhodnotit indexy na normalizovaných title/slug a author name polích, nikoli je přidat naslepo.

## 10. Budoucí veřejné hledání v Galerii (koncept)

Veřejné discovery má být samostatná etapa po interním quick-find:

1. Public-only query nad `published` díly; žádný sdílený interní endpoint.
2. První rozsah: název, autor, veřejně viditelná kolekce; lokalizovaný fallback a relevance/empty state.
3. Samostatná veřejná URL/query parametry pro sdílení výsledku a serverové vykreslení; zvolený formát až podle UX návrhu.
4. Tagy/žánry až po kuraci, naplnění a kontrole veřejné viditelnosti.
5. Pozdější facets: autor, kolekce, žánr/tag, dostupnost/access, jazyk, délka/forma. Některá pole (délka/forma/access) dnes nemají v auditovaném modelu potvrzenou připravenou search reprezentaci.
6. UI input/result row lze sdílet s interním hledáním jako bezstavové primitivum. DTO, query, cache a authorization se sdílet nemají.

Veřejný search nesmí nikdy nabídnout draft, unpublished/review/archived záznam ani interní metadata, a to ani přes counts, facets, suggestion endpoint, slug probe nebo cache.

## 11. Non-goals tohoto auditu a budoucího MVP

- Žádná změna app code, komponent, CSS, routes, i18n, balíčků, assets, Env, schématu nebo migrací v tomto PR.
- Žádná implementace hledání v tomto PR.
- Žádná veřejná Galerie změna v interním MVP.
- Žádná implementace nebo backfill tagů; tagy nejsou závislost MVP.
- Žádné full-text/trigram indexy bez měření a výslovného DB zadání.
- Žádné tvrzení, že `created_by` znamená vlastnictví, ani tabs „Moje“ bez produktové definice.
- Žádná změna readeru, editorového parseru, tabulkového stránkování nebo zrušeného v0.10.15k patchsetu.

## 12. Rizika a mitigace

| Riziko | Dopad | Mitigace |
|---|---|---|
| Neověřené `works` RLS v repozitáři | únik draftů nebo nefunkční výsledky | Před kódem auditovat nasazené policies v sandboxu; testovat role i anon přímým requestem. |
| Autor search přes relation | neúplné nebo drahé dotazy | Integračně ověřit; případně bezpečný dvoukrokový serverový dotaz. |
| `ILIKE` filter syntax / široký term | injection-like změna filtru, drahé dotazy | length limit, escapování, hard result limit, debounce; nikdy nevkládat syrový výraz do `.or`. |
| Závody odpovědí | starší dotaz přepíše novější | AbortController/request sequence a jasný loading state. |
| Slug se během editace změní | starý výsledek vede na 404 | Výsledky necacheovat dlouhodobě; po selectu navigovat aktuálním slugem, edit route dál autorizuje. |
| Nejasné „moje/hotové“ | zavádějící segmentace | Odložit; schválit ownership a completion semantics. |
| Přehnaná DB optimalizace | zbytečná migrace a provozní riziko | Nejdřív měřit; indexy jako samostatný budoucí úkol. |

## 13. Navržený follow-up implementační úkol

### Název

**Implement internal works autocomplete quick navigation**

### Scope

- Přidat přístupný typeahead nad `/member/works` a zachovat současný seznam jako fallback.
- Serverově hledat v povolených dílech podle `title`, `title_cs`, `title_en`, autora a work slugu; přesné UUID volitelně po validaci.
- Zahrnout `draft`, `review`, `published`, `archived`, ale pouze pokud je aktuální editor/admin smí číst.
- Řádek výsledku: display title, autor, interní status, slug, `updated_at`; selection otevře `/member/works/[slug]/edit`.
- Bez veřejné Galerie, tagů, tabs „Moje“, schématu a migrací.

### Pravděpodobné soubory

- `app/member/works/page.tsx` — placement a integrace;
- nový `components/member/WorksAutocomplete.tsx` (název k potvrzení) — combobox UX;
- `lib/dbWorks.ts` — samostatný minimální interní search query/type;
- nový interní server action nebo `app/api/member/works/search/route.ts` — auth boundary a vstup;
- cílené unit/integration/E2E testy podle současné testovací infrastruktury.

**DB migration:** ne pro MVP. Pokud sandbox měření prokáže potřebu indexu, otevřít oddělený explicitně schválený DB úkol.

### Permission checks

1. Route/action volá `requireEditorOrAdmin` při každém requestu.
2. Používá session Supabase client a ověřené `works` RLS; nepoužívá service role.
3. Vrací jen minimální DTO, max. 8–10 řádků, bez cache sdílené mezi uživateli.
4. Anon, reader a member nedostanou draft metadata; inactive editor je odmítnut.
5. Cílová edit route nadále nezávisle ověřuje oprávnění.

## 14. Preview/test checklist pro follow-up

### Funkce a UX

- [ ] Input je na `/member/works` nad seznamem, má label/instrukci a neblokuje „Nové dílo“.
- [ ] 0–1 znak neodesílá dotaz; 2+ znaky jsou debounced a výsledek je omezený.
- [ ] Najde legacy, český i anglický název, work slug a autora; přesné UUID, pokud bylo zahrnuto.
- [ ] Výsledky zahrnou dostupné draft/review/published/archived položky.
- [ ] Každý řádek ukáže správný fallback title, autora, status, slug a poslední úpravu.
- [ ] Klik i Enter otevře správnou aktuální edit URL; Escape zavře nabídku.
- [ ] Loading, no-results a bezpečný error state fungují; prázdný seznam zůstává srozumitelný.
- [ ] Klávesnice (šipky/Home/End podle implementace), focus, role/ARIA a screen reader oznámení jsou ověřeny.
- [ ] Mobilní i desktop layout nepřetéká; rychlé psaní nezobrazí zastaralou odpověď.

### Oprávnění a data

- [ ] Aktivní admin/editor dostane pouze díla povolená RLS.
- [ ] Member, reader, inactive user a anon nedostanou suggestion payload ani rozlišitelnou existenci draftu.
- [ ] Přímý request na endpoint je otestován bez UI a bez session.
- [ ] Public Gallery/public detail stále vrací jen `published`; žádný interní result DTO není public.
- [ ] Odpověď neobsahuje content, summary, interní poznámky, cover request/path ani jiné nepotřebné metadata.
- [ ] Speciální znaky, `%`, `_`, čárka, závorky, dlouhý vstup a nevalidní UUID nezmění logiku filtru ani nevyvolají raw DB chybu.

### Výkon a regrese

- [ ] Je zaznamenán reálný počet děl v sandboxu, query latency a payload pro běžný i bezvýsledný dotaz.
- [ ] Hard limit, debounce a stale-response/abort ochrana jsou ověřeny.
- [ ] Bez migrace: plán dotazu je přijatelný pro současná data; jinak se index řeší samostatně.
- [ ] Create/edit díla, změna slugu, návrat na seznam a stávající veřejný detail fungují beze změny.
- [ ] `git diff --check`, lint/typecheck a relevantní testy projdou.

## 15. Návrat tohoto auditního PR

Audit má jediný dokumentační soubor a žádné runtime nebo datové závislosti. Návrat znamená revert commitu/PR nebo odstranění `docs/ARTALES_WORKS_NAVIGATION_SEARCH_AUDIT_V0_1.md`; není potřeba DB ani Env krok.
