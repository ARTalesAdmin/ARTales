# ARTales — dokončení redakčního procesu a migrační roadmapa

Stav: produktový backlog, 4. 11. 2026. Tento dokument zachycuje odsouhlasený směr; **neznamená autorizaci produkční migrace, merge, deploye ani API výdajů**. Pracovní základ je `main` a izolovaný draft PR #297, nikoli `develop` ani Nexus.

## Rozhodnutí a neměnné podmínky

1. **Nejdřív fungující cyklus** snapshot → sémantické bloky → první QA → označení nálezů → automatické *výhradně prezentační* opravy → nová neměnná revize → explicitní přijetí/vrácení oprav s poznámkou → dokončení QA → čtečka. Přerušení v prohlížeči nesmí ztratit práci.
2. **AI nemění literární originál.** Neměnné surové bloky, pořadí, kotvy a zdrojové hash. Chyba v původním textu vyžaduje oddělené výslovné rozhodnutí a novou textovou edici s auditovanou proveniencí. Vyřazení distribuční poznámky není AI rozhodnutí.
3. **Nová čtečka nesmí být horší než stávající.** Než se publikuje jediné migrované dílo, nutná je vizuální a funkční srovnávací matice vůči současnému produkčnímu readeru.
4. **Migrace existujících knih až po certifikaci nového toku.** Zachovat metadata autorů, vizuálů, obálek, kolekcí, veřejné URL a vazby. Tituly individuálně procházejí novou cestou; část může být degradována/odložena/vyřazena pouze po lidském právním a edičním rozhodnutí. Původní produkční flow vypnout až po doložené paritě a bezpečném návratu.
5. **Rozumně jednoduché UI**, průběžně validovaná povinná pole, krátké instrukce, jeden zřejmý primární další krok, čitelné důvody blokací. Nezdržovat editorům práci novými administrativními kroky.
6. **Nexus AI** může být uživatelský název fronty; v aktuálním PR jde o ARTales worker, nikoli skutečnou integraci Nexus runtime. O eventualitě propojení rozhodnout až podle provozní užitečnosti, bezpečnosti a nákladů.

## Priority a konkrétní milníky

### P0 — hotová jedna QA seance a přesná čtečka (aktuálně rozpracováno PR #297)

**P0a: bezpečnost a transakce oprav**
- Ověřit SQL v izolovaném testu v pořadí migrací, skutečná oprávnění RLS pro editor/admin/anon, zámky, claim races, přesný aktuální SHA, revize po havárii workeru a nemožnost duplicit.
- Ověřit serverový commit jen známých prezentačních patchů, vytvoření přesně jedné následné textové QA kontroly, označení staré jako `superseded` nikoli `completed`, přenos nedokončených nálezů, zachování vlastnictví.
- Přijmout/vrátit **každou** opravenou změnu, přijetí bez poznámky, vrácení s poznámkou a novým nálezem; finální QA nepovolit při nerozhodnutých změnách.
- Stav fronty `queued/running/completed/failed`, návrat po zavření stránky, po pádu workeru fail-closed, bezpečné obnovení výsledků, ochrana před nechtěnou duplicitní platbou.
- Po dokončení opravy zůstat na stejné obrazovce nebo přejít přímo na novou aktuální revizi, nikoli ručně zadávat další úkol.

**P0b: renderer/reader parity**
- Vstupní sada: současný produkční reader a typicky chybná díla včetně *The Great God Pan*, velmi dlouhých odstavců, poznámek, básní, kapitoly, zvláštních znaků, jmen chráněných před zalomením.
- Porovnat typografii (nadpisy/mezery/odstavce/hyphenation), titulní stranu, stránkování, polohu stránky, jednostranu/dvoustranu, scroll, fullscreen, light/dark, nastavení velikosti textu, dostupnost a responzivitu mobile/tablet/desktop.
- Testovat také skutečné DOM výšky a přetečení, přelom odstavce mezi stranami, změnu šířky/zoomu/fontu, obnovu stránky, rozdíl mezi měřicím a viditelným rendererem. Zachovat všechna slova a typografická oddělení pouze ve vykreslení.
- **Výstup:** browser screenshot/interaction evidence + regresní testy + seznam paritních rozdílů; žádná publikace, dokud zásadní rozdíl není vyřešen.
- QA barevnost: opravené bloky jedna konzistentní barva v obou panelech, aktivní označení odlišné; vidět aktuální stav rozhodnutí.
- **Konkrétní nalezená a opravená chyba v PR:** viditelný `unitView` neaplikoval `protectedTerms` stejně jako měřicí průchod. Náprava v commit `0847d0d`; ověřit znovu na aktuálním HEAD CI a browserem.


**P0e: duální publikační provoz bez regresí (tvrdá podmínka)**

- **Žádné přepočítávání starých `WorkBlock` publikací.** U každého `work_id` rozhoduje pouze konkrétní potvrzený záznam v `artales_semantic_publications`: vydaná validní sémantická revize → nový reader; jinak původní `ReaderClient` + jeho `paginateReaderBlocks`, čtenářské nastavení a vazby bez změny.
- Nový sémantický reader může převzít vizuální shell, toolbar, témata a čtenářské služby starého readeru, **nikdy ale jeho `WorkBlock` interpretaci nebo algoritmus fragmentace**. QA a sémantický reader sdílejí `getSemanticPageUnits` i `SemanticUnitContent`; viewportová paginace je přizpůsobení již schváleného obsahu, nikoli nové formátovací rozhodnutí.
- Vlastní veřejné URL `/reader/[slug]`, autorizace `preview/full`, odemčení a čtenářské údaje zůstávají kompatibilní; sémantické kotvy se vážou na originální atomy, nikoli číslo stránky. Převod starých poznámek, záložek a progress vyžaduje explicitní a auditovaný most, bez falešného tvrzení o přesnosti mapování.
- **Fail closed:** nevalidní publikovaná sémantická revize není důvodem tiše ukázat jiný obsah. Nevydané a dosud nepřevedené knihy zůstávají na stávajícím readeru.
- Nejprve dokazatelně **nulová regresní změna** v legacy cestě (test route, screenshoty, mobilní čtení, původní stránkování), potom vizuální a funkční parita nového readeru. Starý kód odstranit až po 100% ověřeném cutoveru a samostatném schválení.
- Stav rozpracovaného PR #297: sdílené vykreslení sémantických bloků a jednotná ediční projekce **jsou ve vývojové větvi**, veřejný sémantický reader ale ještě nemá hotové funkce původní čtečky ani skutečné DOM měřené stránkování. Není certifikován jako náhrada.

**P0d: Jedno autoritativní sémantické vykreslování a oprava po publikaci**
- **Editor určuje strukturu a schválenou sazbu, nikoli definitivní číslo stránky.** Společná interpretace `SemanticRevision.blocks`, `presentation`, edičních výjimek, pravých source kotviček a udržovaných typografických pravidel musí být jedna pro QA a veřejný reader. Čtečka smí přepočítat fyzické zalomení na šířce/fontu, nesmí znovu reinterpretovat či přepisovat text ani originální bloky.
- **Aktuální stav ověřen na main:** `SemanticReaderLab` používá `getSemanticPageUnits/projectSemanticReader`, ale `SemanticPublicReader` má nezávislou rekurzivní interpretaci bloků i vlastní ořez, navíc veřejná sémantická cesta nevyužívá čtenářský toolbar a čtenářské nastavení stejné jako legacy reader. Toto ještě není sjednoceno.
- Odstranit duplicitní sémantické renderery a dvojí určení obsahu vydání. Zavést sdílený prezentační renderer a jednotný page-unit projection QA/public. Uživatelské funkce (layout scroll/spread, motiv, písmo, navigace, čtenářský progress, záložky/poznámky) musí zůstat jako čtenářská shell vrstva, bez zpětného používání legacy `WorkBlock` pagination.
- **Nález po publikaci:** editor smí z veřejné knihy založit nový opravný případ ukotvený na konkrétním `work_id`, `publication_revision_sha256`, atomu a čtenářském kontextu (mobil/font/viewport). Původní veřejná revize a odkazy zůstávají neměnné. Nová pracovní revize/samostatné QA opraví pouze sazbu nebo schválenou textovou edici. Až po PASS, lidském přijetí, vizuální a právní kontrole a samostatném publikačním schválení se atomicky přepne veřejný pointer. Zachovat důkaz před/po, audit a rollback.
- Migrace a veřejný reader se nepřepínají, dokud nejsou doloženy parita, navázané poznámky/progress a návrat na předchozí vydanou revizi.

**P0c: skutečný redakční průchod**
- Společně s garantem před provozem projít kandidát → snapshot → QA → oprava → nová verze → přijato → návazné úkoly → připraveno vydat.
- Přihlášení Pavly/Ivany a převzetí skutečných úkolů **až po dokončení první funkční verze**, dle dohody.
- Měřit pracovní úspěch, ne pouze počet commitů. Produkční SQL, API/env a deploy zvlášť autorizovat.

### P1 — migrace stávajícího katalogu + základní metadata a publikace (po P0)

**Migrace katalogu — povinný P1 milník (neodkládat do P3)**

#### Kontrolovaný převod a odstavení starého flow (po certifikaci P0)

1. **Read-only inventory:** aktuální publikované knihy, licence, typy zdrojů, vztahy autorů, kolekcí, obrázků, čtenářské URL/poznámky, metadata, textové hashes, výjimky a závislosti na legacy code.
2. **Certifikovaná srovnávací baseline:** screenshoty a čtenářské funkce starého readeru, několik reprezentativních knih, návrat/rollback včetně čtenářských odkazů.
3. **Převod po titulech:** reuse existujícího autora/vizuálů, nový snapshot jen s právním oprávněním, sémantické bloky, kompletní QA, explicitní editor approval, rozhodnutí `přijmout / vrátit / odložit / vyřadit`; převod negarantuje zachování každého titulu.
4. **Pilotní paralelní provoz:** publikovat jen schválené knihy; počty, obrázky, metadata, veřejné URL a verze porovnat s baseline; schopnost vrátit titul ke starému readeru.
5. **Postupný cutover:** až po paritě a schválení vypnout staré zapisovací flow; ponechat archiv a čitelnou provenienci, zachovat rollback. Nemazat historii, obálky nebo autorské profily.
6. **Kanonický stav:** nová tvorba probíhá přes jediné sémantické blokování a redakční cestu. Legacy může zůstat pouze jako bezpečná historická čtecí vrstva do konce migrace.




**Související vazby a povinná metadata**


**Autoři a kolekce**
- Vznik kandidáta může předzaložit **draft** autora/kolekce jen tehdy, když není spolehlivě existující ekvivalent; nejprve deduplikace podle bezpečné identity (jména se mohou shodovat). Nikdy nevytvářet automaticky veřejnou stránku.
- Kandidát dostane `author_id` / vazby na kolekce, úkoly pro autora, obálku a kolekce podle chybějících údajů a způsobilých editorů. Existující autor/obálka/vizuál/kolekce se použijí, neprojdou zbytečnou regenerací.
- Textová a vizuální odpovědnost odděleně; Ivana může dobrovolně převzít volné textové úkoly. Předzaložení není automatické schválení.
- Přejít seznam povinných polí na cílové datové modely; zejména autor, název/slug, licence a source receipt, provenience překladu a obrázků, snapshot, právní PASS, finální revize QA, obálka, popisek, vazby na veřejný katalog.
- Validace v UI *a zároveň* na DB/publikační bráně; vysvětlovat **co chybí a kde je to doplnit**. Dílčí rozpracované drafty ukládat.

**Jednotné UI a progress**
- Stav díla jako jeden přehledný, stavově odvozený **progress bar knihy** a jednoduchý řetězec kroků. Nezaměňovat „AI čeká“ a „dílo připraveno“.
- Primární tlačítka odpovídají aktuálnímu stavu: `Přijmout první QA` nebo `Předat k opravě`; v navazujícím QA `Přijmout změnu` / `Vrátit s poznámkou`; `Dokončit kontrolu`; poté navazující editorovy úkoly.
- Statusové štítky a čítače úkolů zobrazují skutečnou databázi, ne optimistický odhad. U blokace uvést krátké sdělení a odkaz na opravné místo.
- Zachovat co nejméně kliků; nezvyšovat zbytečně počet úkolů na jediný QA nález.

### P2 — rozšíření redakce: AI anotace, autorské profily, žádosti a optimalizace

**AI návrhy popisků na jedno tlačítko**
- `Navrhnout anotaci knihy` a `Navrhnout profil autora` jsou samostatné akce. AI vrací **originální vlastní formulace**, nikoli reprodukovaný copyrightový text; používá ověřená metadata/snapshot nebo označené faktické zdroje.
- Draft je editovatelný; musí mít stav `navrženo → lidská úprava → schváleno`, audit identity a verze. Bez schválení se nesmí publikovat.
- Nehádat bibliografická fakta, rok, překladatele nebo autorovy životní údaje; neověřené pasáže označit a předat editorovi.


**AI provoz a účetnictví**
- Evidovat pro každý požadavek `job_id`, `candidate_id`, SHA revize, účel, poskytovatele, model, status, počet pokusů, duration, skutečný `input_tokens`, `output_tokens` a případně `cached_tokens`, cenu/modelovou sazbu v době požadavku, `estimated_cost` pokud provider cenu nedal; nikdy neuvádět odhad jako skutečnost.
- Budget/limity na uživatele, den a model, zákaz neomezených retry; anonymizované logy bez ukládání celého literárního textu v provozním telemetry.
- Ověřit reálné fakturační číslo proti poskytovateli. Provoz AI fronty může zůstat v ARTales, není nutno přesměrovávat do Nexu jen kvůli názvu.



- **Čtenářská žádost o dílo:** veřejný strukturovaný návrh s názvem/autorem a odkazem, antispam, deduplikace, moderace, právní prescreen, informační stav žádosti. Není to automatická publikace.
- **Editorská žádost o dílo:** autentizovaný editor může nominovat konkrétní dílo, s odůvodněním a vstupními zdroji; vznikne kandidát k posouzení, nikoli obcházení právního nebo rozpočtového schválení.
- **Poučení z evidence:** měsíční úkol garanta, statistika častých oprav, opakování/vrácení, úspěšnost na první/druhý pokus a typy překážek; návrhy pravidel až po lidské revizi, verzované metodiky, ověření na regresní sadě.
- Samostatné návrhy ke zjednodušení publikace a automatizaci metadat pouze pokud neohrozí hlavní QA a Reader.

## Akceptační kontrola před ostrým zapnutím

- [ ] Zelené CI na **přesném** commitu, včetně textové integrity a sémantické paginace.
- [ ] SQL migrace prošly v izolovaném DB testu a RLS/role matici; nulové změny v produkci bez autorizace.
- [ ] AI job: enqueue, oprava, text nezměněn, atomické pokračování QA, opakování po pádu, bez duplicit.
- [ ] QA: přijetí a vrácení opravy na jednotlivém bloku + souhrnné přijetí; nelze předčasně uzavřít.
- [ ] Screenshotové a interakční srovnání readeru vůči produkční baseline na mobilu, tabletu i desktopu.
- [ ] Reálná seance s garantem; až potom práce Pavly a Ivany.
- [ ] Autorizace merge/DB/env/produkce zvlášť; rollback bez destrukce originálních dat.

## Nezaměňovat stav

- **PR #297**: programový návrh a CI, ne produkční služba.
- **P0**: 100% současné priority. P1/P2 jsou konkrétní schválená produktová zadání do backlogu, **nikoli hotové implementace**.
- **P1 migrace**: naplánovaná a prioritní po P0; není to povolení spustit hromadnou transformaci nebo odstavit stávající reader.
