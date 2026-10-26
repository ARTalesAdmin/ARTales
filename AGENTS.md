# Pokyny pro agenty v repozitáři ARTales

ARTales je spuštěný kulturní a čtenářský projekt. Produkci vždy chraňte.

- `main` je jediný aktuální produkční zdroj pro `artales.net`. `develop` je dosavadní sandboxová/historická integrační větev, která obsahuje i nedokončenou a superseded práci.
- **Dočasné směrování od 2026-10-26 (výslovné rozhodnutí Architekta):** novou práci zakládejte ve vlastní izolované větvi z čerstvě ověřeného `main` a předkládejte PR k revizi **proti `main`**, nikoli proti `develop`. `develop` smí sloužit k cílené čtecí inspekci a selektivnímu převzetí konkrétních ověřených komponent, nikdy k hromadnému merge nebo automatickému backportu. Po úklidu `develop` tento dočasný režim přezkoumá Architekt.
- **Žádný přímý push nebo automatický merge do `main`.** PR do `main` znamená návrh/review, nikoli povolení ke sloučení, nasazení, migraci či produkční změně. Ty vyžadují samostatné výslovné rozhodnutí.
- Neměňte produkční proměnné prostředí a nespouštějte destruktivní databázové operace.
- SQL migrace přidávejte pouze na výslovné zadání.
- Platby, AT kredity, členství, reader, editor, parser a Supabase logiku měňte pouze na výslovné zadání.
- Zrušený patch **v0.10.15k — Table Pagination & Generated Header Fix** nepoužívejte ani neoživujte bez nového výslovného schválení. Tabulky, parser a stránkování readeru patří do pozdější samostatně schválené izolované práce.
- Držte se rozsahu úkolu. V jeho větvi lze opravit build nebo typové chyby, které změna sama způsobila.
- U vizuálních změn upřednostněte tokeny, znovupoužitelné komponenty, schválené brandové podklady a řízený manifest. Nevytvářejte další jednorázové barvy, styly ani nahodilé assety.
- Ve veřejném textu používejte klidný, konkrétní, důvěryhodný a čtenářsky orientovaný tón. Neslibujte jako hotové funkce, které neexistují.

Každý pull request nebo patch musí obsahovat: shrnutí, změněné soubory, riziko (`low` / `medium` / `high`), cíl (`develop first` / `production safe`), DB (`yes` / `no`), Env (`yes` / `no`), postup návratu a testovací checklist. Podrobnosti jsou v `docs/WORKFLOW.md` a `docs/RELEASE_POLICY.md`.
