# Pracovní postup ARTales

Tento dokument popisuje bezpečný způsob práce pro product ownera, který nemusí znát detaily Gitu, Codexu ani Vercelu.

## Co která část znamená

- **`main` = produkce.** Obsah této větve běží na `artales.net` a musí zůstat stabilní.
- **`develop` = sandbox.** Zde se skládají změny určené k preview a testování. Vercel preview je dostupné na `ar-tales.vercel.app`.
- **Pracovní větev = jedna konkrétní změna.** Codex ji vytvoří z aktuálního `develop`, připraví v ní změny a otevře pull request do `develop`.
- **Pull request (PR) = kontrolní místo.** Ukazuje, co se mění, jaké je riziko a jak byla změna ověřena. Není to automatické povolení k produkčnímu nasazení.

## Role

- **Uživatel:** product owner, architekt, tester a konečný schvalovatel.
- **ChatGPT:** poradce, plánovač, reviewer a autor zadání.
- **Codex:** agent, který pracuje ve větvi, provádí kontroly a připravuje PR.
- **GitHub:** uchovává větve, PR a historii změn.
- **Vercel:** vytváří preview a zajišťuje produkční deployment.
- **Supabase:** datová vrstva; změny v ní vyžadují zvýšenou opatrnost a výslovné zadání.

## Běžný postup krok za krokem

1. Uživatel popíše malý, jasně ohraničený úkol a jeho očekávaný výsledek.
2. Codex vyjde z větve `develop` a vytvoří samostatnou pracovní větev.
3. Codex provede pouze zadané změny, spustí vhodné kontroly a sepíše rizika.
4. Codex otevře PR **do `develop`**. PR musí obsahovat položky předepsané v `RELEASE_POLICY.md`.
5. Po začlenění do `develop` vytvoří Vercel sandbox/preview. Uživatel zde změnu prakticky otestuje.
6. Nalezené chyby se opraví opět přes pracovní větev a PR do `develop`.
7. Teprve stabilní a otestovanou změnu může uživatel výslovně schválit pro produkci.
8. Přesun do `main` a produkční deployment proběhne odděleně. Codex změnu do `main` sám neslučuje.

## Co znamená „schváleno“

Schválení preview neznamená automaticky schválení produkce. Před produkcí má uživatel znát rozsah změny, výsledek testů, případný dopad na data nebo prostředí a způsob návratu. Bez výslovného produkčního souhlasu zůstává změna v `develop`.

## Praktická kontrola uživatele v preview

Podle typu změny ověřte zejména:

- že odpovídá zadání a nic navíc se nezměnilo;
- hlavní uživatelskou cestu na počítači i telefonu;
- přihlášený i nepřihlášený stav, pokud je relevantní;
- chybové a prázdné stavy;
- texty, odkazy a základní přístupnost;
- že stávající kritické funkce zůstaly funkční.

Pokud je výsledek nejasný nebo rizikový, změnu neposouvejte do produkce. Vraťte ji k úpravě s konkrétním popisem problému.
