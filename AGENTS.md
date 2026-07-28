# Pokyny pro agenty v repozitáři ARTales

ARTales je spuštěný kulturní a čtenářský projekt. Produkci vždy chraňte.

- `main` je produkční větev pro `artales.net`; `develop` je sandbox a preview větev pro `ar-tales.vercel.app`.
- Novou práci zakládejte ve vlastní větvi z `develop` a otevírejte pull request do `develop`.
- Do `main` nikdy neposílejte změny přímo ani je neslučujte. Produkční nasazení vyžaduje výslovné schválení uživatele.
- Neměňte produkční proměnné prostředí a nespouštějte destruktivní databázové operace.
- SQL migrace přidávejte pouze na výslovné zadání.
- Platby, AT kredity, členství, reader, editor, parser a Supabase logiku měňte pouze na výslovné zadání.
- Zrušený patch **v0.10.15k — Table Pagination & Generated Header Fix** nepoužívejte ani neoživujte bez nového výslovného schválení. Tabulky, parser a stránkování readeru patří do pozdější samostatné práce v sandboxu.
- Držte se rozsahu úkolu. V jeho větvi lze opravit build nebo typové chyby, které změna sama způsobila.
- U vizuálních změn upřednostněte tokeny, znovupoužitelné komponenty, schválené brandové podklady a řízený manifest. Nevytvářejte další jednorázové barvy, styly ani nahodilé assety.
- Ve veřejném textu používejte klidný, konkrétní, důvěryhodný a čtenářsky orientovaný tón. Neslibujte jako hotové funkce, které neexistují.

Každý pull request nebo patch musí obsahovat: shrnutí, změněné soubory, riziko (`low` / `medium` / `high`), cíl (`develop first` / `production safe`), DB (`yes` / `no`), Env (`yes` / `no`), postup návratu a testovací checklist. Podrobnosti jsou v `docs/WORKFLOW.md` a `docs/RELEASE_POLICY.md`.
