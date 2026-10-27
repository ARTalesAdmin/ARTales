# Pracovní postup ARTales

Tento dokument popisuje bezpečný způsob práce pro product ownera, který nemusí znát detaily Gitu, Codexu ani Vercelu.

## Co která část znamená

- **`main` = produkce.** Obsah této větve běží na `artales.net` a musí zůstat stabilní.
- **`develop` = historická sandboxová/integrační větev.** Dokud nebude vyčištěná od nedokončených a nahrazených návrhů, není zdrojem nových integračních větví ani automatickým cílem PR. Její kód se smí cíleně studovat a jednotlivé komponenty převzít pouze po aktuální kontrole.
- **Pracovní větev = jedna konkrétní změna.** Podle dočasného rozhodnutí Architekta z 26. 10. 2026 ji vytvoříme z čerstvě ověřeného `main`, výsledek dáme do izolovaného PR proti `main`. Samotný PR nic nenasazuje do produkce.
- **Pull request (PR) = kontrolní místo.** Ukazuje, co se mění, jaké je riziko a jak byla změna ověřena. Není to automatické povolení k produkčnímu nasazení.

## Role

- **Uživatel:** product owner, architekt, tester a konečný schvalovatel.
- **ChatGPT:** poradce, plánovač, reviewer a autor zadání.
- **Codex:** agent, který pracuje ve větvi, provádí kontroly a připravuje PR.
- **GitHub:** uchovává větve, PR a historii změn.
- **Vercel:** vytváří preview a zajišťuje produkční deployment.
- **Supabase:** datová vrstva; změny v ní vyžadují zvýšenou opatrnost a výslovné zadání.

## Běžný postup krok za krokem

1. Uživatel vymezí konkrétní úkol, rozsah a požadovaný výsledek; bez toho se autorita k zápisu neodvozuje.
2. Z čerstvě ověřeného `main` se založí samostatná pracovní větev pro jedinou změnu.
3. Ve větvi vzniknou jen schválené změny; případný kód z `develop` se jednotlivě analyzuje, testuje a přizpůsobí aktuální produkci, bez plošného merge.
4. Otevře se PR **proti `main`** s rizikem, přehledem změn, DB/Env, testy a rollbackem dle `RELEASE_POLICY.md`. PR je návrh, ne schválení merge.
5. Kontroly a případné izolované preview se provádějí nad přesným HEAD pracovní větve, nezávisle na `develop`. Pokud autentizované preview není možné, nepředstírá se jeho ověření.
6. Chyby se opraví v téže izolované větvi a znovu se ověří. Bez výslovného rozhodnutí se nic nepřelévá do `develop`.
7. Architekt zvlášť rozhodne o přijetí, **merge přesného PR/head** a případném produkčním release; databáze, storage, env a provozní aktivace mají vlastní brány.
8. Po samostatně autorizovaném sloučení/nasazení proběhne ověření skutečné produkce a zápis významného handoffu. Do `main` se nikdy přímo nepushuje.

## Co znamená „schváleno“

Schválení preview neznamená automaticky schválení produkce. Před produkcí má uživatel znát rozsah změny, výsledek testů, případný dopad na data nebo prostředí a způsob návratu. Bez výslovného souhlasu pro přesný merge a produkční krok zůstává změna v izolované pracovní větvi. Samotná existence PR proti `main` ani automaticky vzniklé preview není produkční autorizace.

## Dočasnost směrování

Tento režim je dočasné výslovné rozhodnutí Architekta pro práci během úklidu `develop`, nikoli obecný trvalý ústup od kontroly produkce. Návrat ke standardní integrační větvi vyžaduje nové rozhodnutí po jejím vyčištění. Neznamená automatickou změnu Nexus enrollmentu či předání starých autorizací.

## Praktická kontrola uživatele v preview

Podle typu změny ověřte zejména:

- že odpovídá zadání a nic navíc se nezměnilo;
- hlavní uživatelskou cestu na počítači i telefonu;
- přihlášený i nepřihlášený stav, pokud je relevantní;
- chybové a prázdné stavy;
- texty, odkazy a základní přístupnost;
- že stávající kritické funkce zůstaly funkční.

Pokud je výsledek nejasný nebo rizikový, změnu neposouvejte do produkce. Vraťte ji k úpravě s konkrétním popisem problému.
