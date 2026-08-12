# ARTales — interní autocomplete rychlé navigace děl v0.1

**Základ:** audit z PR #142  
**Cíl:** `develop first`  
**Riziko:** `medium`  
**DB:** `no`  
**Env:** `no`

## Shrnutí

Na chráněné stránce `/member/works` je nad seznamem děl interní autocomplete.
Po výběru výsledku otevře `/member/works/[slug]/edit`. Implementace nemění
veřejnou Galerii, veřejný detail, Reader, parser, editor bloků ani upload médií.

## Změněné soubory a cesta dat

- `app/member/works/page.tsx` umisťuje komponentu pod akci „Nové dílo“.
- `components/member/WorksQuickNavigation.tsx` zajišťuje debounce, stavy,
  klávesnici a navigaci.
- `app/member/works/search/route.ts` je interní, necachovaný endpoint a před
  každým dotazem znovu vyžaduje roli editor/admin.
- `lib/dbWorks.ts` obsahuje omezený serverový dotaz přes cookie-aware Supabase
  klienta. RLS zůstává druhou autorizační vrstvou.
- český a anglický member slovník obsahují texty autocomplete.

## Hledání a výsledky

Od dvou znaků se hledá case-insensitive v `title`, `title_cs`, `title_en` a
`slug`. Jména autora (`name`, `name_cs`, `name_en`) se hledají odděleným
omezeným dotazem; celý platný UUID přidá přesnou shodu `works.id`. Výsledná
projekce obsahuje pouze ID, názvy, slug, status, `updated_at` a jméno autora.
Vrací nejvýše deset unikátních děl. Přesné a prefixové názvy/slugs mají
přednost, v rámci relevance rozhoduje poslední úprava.

Dotaz nemá status filtr: draft, review, published i archived jsou dostupné jen
tehdy, pokud je přihlášenému editorovi/adminovi dovolí RLS. Endpoint nepoužívá
service role, má `private, no-store` a veřejná cesta jej nesdílí.

## UX a přístupnost

Input používá combobox/listbox atributy, oznamuje loading, chybu a prázdný
výsledek, podporuje šipky, Enter, Escape i kliknutí. Výsledky ukazují název,
autora, stav, slug a datum úpravy. Minimálně dvouznakový vstup a 250ms debounce
omezují počet requestů; pořadí requestů a `AbortController` brání přepsání
novějšího výsledku starší odpovědí.

## Hranice a další práce

Tagy nejsou použity: audit nepotvrdil jejich dostatečné pokrytí ani kurátorská
pravidla a quick-find je nepotřebuje. Veřejná Galerie zůstává samostatný
budoucí publish-only úkol s oddělenou query cestou; později může hledat
názvy/autory a nabídnout veřejné kolekce či kurátorované tagové facety, nikdy
však drafty. Při růstu dat je třeba změřit p95/`EXPLAIN ANALYZE` a teprve v
samostatném schváleném úkolu zvážit trigram/full-text indexy.

## Preview checklist

- [ ] `/member/works` se načte a hledání je u horních ovládacích prvků.
- [ ] Česká a při dostupném locale switchi anglická copy je správná.
- [ ] Funguje přesný/částečný a český/anglický název, slug a autor.
- [ ] Celý UUID funguje; neplatný nebo částečný UUID se nechová jako exact ID.
- [ ] Loading, bez výsledků a chyba jsou srozumitelné.
- [ ] Klik, šipky + Enter a Escape fungují; cíl je editor podle slugu.
- [ ] Oprávněný editor najde draft; member a anonym nedostanou interní data.
- [ ] Úzký/mobile viewport je použitelný.
- [ ] Galerie, veřejný detail, Reader a tagové vazby zůstaly beze změny.

## Návrat

Revertovat commit tohoto MVP. Nebyla přidána migrace, Env, balíček ani asset;
rollback proto nevyžaduje databázovou nebo provozní operaci.
