# Redakční aktivita a interní seznam děl v0.1

## Význam režimů

- **Všechna díla** zobrazují všechna díla, která editorovi nebo administrátorovi dovolí stávající RLS.
- **Moje díla** zobrazují díla, u kterých má právě přihlášený uživatel řádek v `work_editor_activity`. Nejde o vlastnictví ani o `created_by`.
- **Ke kontrole** je pouze základní lokální signál: zahrnuje díla se stavem `review` **nebo** s vyplněným `submitted_for_review_at`. Hierarchie editorů, přidělování reviewerů a Nexus/Syrael review workflow se nezavádí. Prázdný výsledek je platný a UI jej popisuje otevřeně.

Seznam přijímá `mode=all|mine|review` a `sort=changed_desc|title_asc|title_desc`. Výchozí je `all` a nejnovější redakční změna. Názvové řazení používá zobrazovaný titul `title_cs || title_en || title`; časové řazení nechává `NULL` na konci a má stabilní tiebreak.

## Datový význam

`works.updated_at` zůstává technickým časem libovolného `UPDATE` a neslouží jako údaj „Naposledy změněno“.

- `works.content_changed_at` je čas posledního úspěšně odeslaného redakčního uložení.
- `works.content_changed_by` je profil editora, který toto uložení provedl; při smazání profilu se nastaví na `NULL`.
- `work_editor_activity` drží pro dvojici dílo–editor první a poslední redakční zásah a počet zaznamenaných uložení.

RPC `record_work_editorial_activity` atomicky aktualizuje oba redakční údaje díla a provede insert/upsert aktivity. Ověřuje aktivní roli `editor`/`admin` a identitu bere z `auth.uid()`. Tabulku aktivity může číst jen aktivní editor/admin; zapisovat lze pouze vlastní aktivitu. Anonymní čtení není povoleno.

Aktivita se zaznamená po odeslání vytvoření či úpravy díla a po úspěšném uložení change setu, appendu nebo delete batch. Technické dávkování velkých děl zůstává beze změny. Spolehlivé porovnání všech metadat pro no-op zatím není k dispozici; konzervativně se počítá pouze explicitně odeslané uložení editorem, nikoli čtení nebo background operace.

Zápis aktivity následuje až po úspěšném obsahovém uložení. Pokud v tomto okamžiku selže pouze RPC aktivity, uložený obsah se editorovi nehlásí jako neúspěšný: server actions pokračují na běžný success redirect a JSON endpointy vrátí `ok: true` spolu s `activityWarning: "editorial_activity_failed"`. Chyby samotného obsahu, metadata syncu nebo dávky zůstávají fatální jako dosud. Klientské zobrazení této neblokující diagnostické výstrahy je odloženo, aby se v této fázi nedestabilizoval editor.

Rychlé hledání dostává aktuální režim a omezuje výsledky stejnou množinou děl. Čas v jeho výsledcích je `content_changed_at`, nikoli `updated_at`.

## Záměrně odloženo

Do navazující práce Nexus/Syrael patří hierarchie editorů, přiřazování kontrol, workflow nad review a jemnější audit změn. Tato fáze nemění Reader, parser, blokovou sémantiku, typografii, stránkování, poznámky ani veřejné stránky.

## Smoke checklist pro develop

- [ ] `/member/works` načte výchozí `all + changed_desc`.
- [ ] A–Z a Z–A řadí podle zobrazovaného titulu.
- [ ] „Moje díla“ může být před prvním uložením prázdné.
- [ ] Po uložení draftu se vyplní `content_changed_at` a dílo se objeví v „Moje díla“.
- [ ] Karta zobrazuje datum i čas; starší dílo bez aktivity otevřeně uvádí chybějící záznam.
- [ ] „Ke kontrole“ bezpečně zobrazí výsledek nebo prázdný stav.
- [ ] Hledání respektuje zvolený režim.
- [ ] Veřejný detail, Reader a poznámky v Readeru zůstávají funkční.

## Nasazení a návrat

Additivní Supabase migrace **musí být aplikována do cílové Supabase databáze před testováním preview nebo nasazením aplikačního kódu**. Bez migrace může `/member/works` selhat, protože aplikace vybírá `content_changed_at` a dotazuje `work_editor_activity`.

Migrace neprovádí backfill. Existující díla proto mají `content_changed_at = NULL` až do jejich dalšího úspěšného redakčního uložení nebo do samostatně schváleného backfillu. „Moje díla“ budou pro konkrétního uživatele zpočátku prázdná, dokud tento uživatel po migraci úspěšně neuloží redakční změnu.

Při návratu nejprve revertujte aplikační commit. Nové nullable sloupce a tabulku lze bezpečně ponechat nevyužité. Jejich odstranění by bylo destruktivní a smí proběhnout jen samostatnou, výslovně schválenou migrací po záloze; tento patch žádný automatický down krok neposkytuje.
