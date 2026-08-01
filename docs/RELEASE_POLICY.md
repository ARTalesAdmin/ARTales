# Release policy ARTales

## Základní pravidlo

Produkce je živá a její bezpečnost má přednost před rychlostí. Runtime změny směřují nejdříve do `develop`, projdou Vercel preview a uživatelským testem. Do `main` se dostanou až po výslovném schválení uživatele. Codex nesmí přímo pushovat ani slučovat do `main`.

## Úrovně rizika

### Low

Dokumentace, izolovaná textová oprava nebo malá změna bez dopadu na data, autentizaci, platby a hlavní uživatelské cesty. Návrat obvykle znamená revert jednoho commitu.

### Medium

Běžná runtime změna, více propojených komponent, změna uživatelského toku nebo vizuální systémová úprava. Vyžaduje cílené regresní testy v preview a jasný rollback.

### High

Změna databáze, produkční konfigurace, autentizace, plateb, AT kreditů, členství, readeru, editoru, parseru nebo jiné kritické cesty. Vyžaduje výslovné zadání, samostatný plán, pečlivé testování a konkrétní návratový postup. Rizikové oblasti se nemají přidávat bokem k jinému úkolu.

Při pochybnostech použijte vyšší úroveň rizika.

## Databáze a Supabase

- Destruktivní databázové operace jsou zakázané.
- SQL migrace lze přidat jen na výslovné zadání.
- PR musí uvést `DB: yes`, pokud mění schéma, data, policies, storage, SQL nebo Supabase chování; jinak `DB: no`.
- Změna s `DB: yes` musí popsat pořadí nasazení, zálohu nebo ochranu dat, zpětnou kompatibilitu a rollback.
- Produkční databázový zásah nelze odvodit jen ze schválení kódu; vyžaduje samostatné výslovné potvrzení.

## Proměnné prostředí

- Codex nesmí měnit produkční environment variables.
- PR musí uvést `Env: yes`, pokud vyžaduje novou nebo změněnou proměnnou; jinak `Env: no`.
- U `Env: yes` musí být uveden název proměnné, dotčená prostředí, kdo ji nastaví, bezpečné pořadí a rollback. Tajné hodnoty nepatří do repozitáře ani do PR.

## Standardní změna vs. hotfix

**Standardní změna** vždy postupuje přes pracovní větev, PR do `develop`, preview, test a výslovné produkční schválení.

**Hotfix** je pouze naléhavá oprava aktivního produkčního incidentu, ne zkratka pro běžnou práci. Musí mít co nejmenší rozsah, vlastní větev, popis incidentu, cílený test a okamžitě použitelný rollback. Produkční krok stále vyžaduje výslovné schválení uživatele. Po opravě je nutné zajistit, aby stejná změna zůstala také v `develop` a větve se nerozešly.

## Povinný obsah PR nebo patche

Každý souhrn musí obsahovat:

- **Summary:** co a proč se změnilo.
- **Changed files:** úplný seznam dotčených souborů a stručný účel.
- **Risk:** `low`, `medium` nebo `high` s odůvodněním.
- **Target:** `develop first` nebo `production safe`. Označení `production safe` je hodnocení připravenosti, nikoli povolení k nasazení.
- **DB:** `yes` nebo `no`, případně podrobnosti.
- **Env:** `yes` nebo `no`, případně podrobnosti.
- **Rollback notes:** konkrétní postup návratu a upozornění na nevratné kroky.
- **Test checklist:** provedené automatické kontroly i kroky, které má ověřit uživatel v preview.

PR má také výslovně uvést neprovedené testy a známá omezení. Build nebo type chyby způsobené změnou lze opravit v její pracovní větvi; nesouvisející refaktor patří do jiného úkolu.

## Rollback

Rollback se plánuje před produkcí, ne až při incidentu. U běžné změny má být možné vrátit konkrétní commit nebo PR. Pokud kód závisí na datech či konfiguraci, musí popis vysvětlit bezpečné pořadí návratu. Po rollbacku se ověří kritická uživatelská cesta a zaznamená se důvod návratu.

Zrušený patch **v0.10.15k — Table Pagination & Generated Header Fix** nesmí být použit jako základ další práce bez nového výslovného schválení. Tabulky, parser a refaktor stránkování readeru patří do pozdější samostatné práce v `develop`.
