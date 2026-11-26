# ARTales — doporučený plán komerční připravenosti (v1)

Datum: 2026-11-26
Status: RECOMMENDED / NON-BINDING. Pracovní doporučení, nikoli závazná strategie, autorizace dalších změn, nové governance pravidlo ani release approval.
Výchozí main: 17e437eeb7867ed352a705d52f3d7700f8f3cfe1.

## Rozsah a hranice

ARTales již funguje. Cílem je zachovat jeho stávající funkce, bezpečně monetizovat, chránit data a získávat zákazníky. Práce přímo v ARTales, bez závislosti na Nexu; pozdější integrace je samostatné rozhodnutí. Reader (typografie, sazba, sjednocení verzí), main/develop divergence a koncepce publikační automatizace jsou mimo rozsah. Nová práce z ověřeného main do izolované větve, PR proti main; respektovat AGENTS.md a RELEASE_POLICY.md. Merge, release a produkční DB zásah vyžadují samostatné schválení. Žádné změny produkčního env, žádné destruktivní operace. Používat existující mechanismy; nebudovat paralelní logiku. Dokument je veřejný: neobsahuje konkrétní nezabezpečené přístupové cesty, osobní údaje ani tajné údaje.

## Doporučený backlog

P0 = před ostrým placeným provozem; P1 = komerční aktivace; P2 = rozšíření; P3 = pozdější možnosti. Priority nejsou autorizací a mohou se měnit.

| ID | Balíček | Priorita |
| --- | --- | --- |
| A1 | Bezpečnost ekonomických RPC a serverové autorizace | P0 |
| A2 | Databázové granty, RLS, privilegované funkce, role | P0 |
| A3 | Registrace, přihlášení, pozvánky | P1 |
| A4 | API, omezení četnosti, prevence zneužití | P1 |
| A5 | Závislosti, tajné klíče a přístupové údaje | P1 |
| A6 | Monitoring a incidenty | P2 |
| B1 | Veřejná metadata a ukázky vs. chráněný obsah | P0 |
| B2 | Interní data, drafty, revize, redakční podklady | P0 |
| B3 | Storage a obrazy | P1 |
| B4 | Zálohy a obnova | P1 |
| B5 | Osobní údaje a retence | P1 |
| B6 | Prevence hromadného stahování a scrapingu | P1 |
| B7 | Evidence práv a původu vlastního obsahu | P2 |
| C1 | Atomické, idempotentní vyřízení ověřených plateb | P0 |
| C2 | Integrita peněženky, členství a nároků | P0 |
| C3 | Obchodní podmínky, reklamace a refundace | P0 |
| C4 | End-to-end zákaznická cesta | P1 |
| C5 | Platební brána a automatické párování | P1 |
| C6 | Finanční reporting, účetní export a kontrola | P1 |
| C7 | Revize cenotvorby a nabídky | P2 |
| C8 | Promo kódy, doporučení a dárky | P2 |
| C9 | Prodej PDF/EPUB a dalších produktů | P3 |
| D1 | E-mailová infrastruktura a doručitelnost | P1 |
| D2 | Regulovaný marketingový workflow | P1 |
| D3 | Integrace sociálních sítí | P1 |
| D4 | Marketingová analytika a konverze | P1 |
| D5 | SEO a organická viditelnost | P1 / Wave I |
| D6 | Newsletter a zákaznické zprávy | P2 |
| D7 | Zákaznická podpora | P2 |
| D8 | Placená reklama s limity | P2 |
| D9 | Partnerství a ambasadoři | P3 |

## Doporučené vlny (paralelní podle závislostí)

- I: A1/A2, B1/B2, C1/C2, D5. D5 lze řešit samostatnou větví z main.
- II: A3/A4/A5, B3/B4/B5/B6, C3/C4, D1/D2/D4. C3 je podmínkou ostrého placeného provozu i při souběžné přípravě. D1/D2 lze připravovat ihned.
- III: C5/C6, D3/D6/D7; postupné komerční rozšíření podle důkazů.
- IV: A6/B7/C7/C8/C9/D8/D9, měřený růst a případné postupné předávání vybraných činností Nexu.

## Wave I — podrobný doporučený postup

### I-A: A1/A2 Security Hardening
První aktivní balíček: security/artales-hardening-v1. Ostatní balíčky pouze návrh.
1. F0: ověřit main, živé schéma a dotčené migrace; inventura funkcí, efektivních grantů (včetně PUBLIC), RLS, views, Storage, server/client call sites, identity/role a závislostí; zjistit izolované testovací prostředí. Výsledek: matice povolených přístupů a rozsah. Nepublikovat konkrétní otevřené zranitelnosti.
2. F1: ekonomické funkce — zachovat existující serverové vstupy a ceny, ověřit identitu, omezit EXECUTE podle doložených volajících, validovat kanonické parametry, transakční integrita, souběh a opakované operace. Nedublovat C2.
3. F2: systematicky vyhodnotit identitu, ekonomiku, katalog, redakci, interní data a infrastrukturu. Nepoužívat plošné revokace ani slepé opravy advisorů. Koordinovat hranici s B1/B2. Zachovat autorizované veřejné, redakční a administrativní toky.
4. F3: testy skutečných databázových rolí a negativní testy (izolace mezi účty, odmítnutí nepovolené operace, přístup k interním datům), pozitivní testy, souběh, rollback a opakování, CI build/typecheck a regresní testy. Testovací data pouze izolovaná; produkce read-only do samostatné autorizace.
5. F4: PR proti main, seznam souborů, risk high, DB yes pro DB změny, Env dle reality, test evidence, kompatibilita mezi verzemi a pořadí migrace/deploy. Záloha či ověřená ochrana dat, bezpečný návrat bez znovuotevření zranitelnosti; produkční kroky samostatně schválit. Následně read-only verifikace oprávnění a bezpečné smoke testy.

Akceptace: neautorizované operace odmítnuty; žádné změny cizích účtů/rolí; ceny a benefity z ověřeného zdroje; souběh nepřečerpá zůstatek; idempotence dle obchodního významu; interní data a pozvánky chráněny; legitimní toky a regresní testy zachovány; evidence testů a produkční verifikace. Neprohlašovat splnění bez důkazu.

### I-B: B1/B2 Content & Data Protection
Klasifikovat veřejná metadata/ukázky, chráněný plný obsah, interní redakční podklady a citlivá provozní data. Zabezpečit skutečnou datovou hranici v DB/API/Storage; server ověřuje nárok, vrací jen dovolený rozsah. SEO má přístup jen k veřejným údajům. Prověřit všechny současné klienty a cache, žádné přepisování Readeru. Nezaručovat nemožnost kopírování již oprávněně zobrazeného obsahu. Akceptace: veřejný katalog funguje, neoprávněný přístup k plnému a internímu obsahu odmítnut, oprávněné čtení a redakce zachovány.

### I-C: C1/C2 Economic Integrity
Zmapovat QR platební a členský tok, stavy a ledger. Použít jeden kanonický ekonomický tok pro ověřenou platbu, atomický fulfillment, jednoznačné identifikátory, idempotenci, konsistenci zůstatků a nároků; zabránit duplicitě i neplatným přechodům stavů. Budoucí brána pouze poskytne ověřenou platební událost, nebude novým ekonomickým systémem. Akceptace: jedna platba = jedno vyřízení, rollback při chybě, bezpečné opakování/souběh, účetní dohledatelnost. Bez změn cen nebo nabídky bez rozhodnutí.

### I-D: D5 SEO & Visibility
Samostatná větev z main. Audit aktuální indexace; dynamická sitemap veřejných URL; robots.txt a noindex pro neveřejné plochy (nikoli náhrada autorizace); unikátní metadata pro díla/autory/kolekce; canonical, jazykové varianty/hreflang dle skutečných URL; Book/Person/Breadcrumb dle skutečných dat; Open Graph; Google Search Console/Bing po ověření vlastnictví; měřit organickou návštěvnost a konverze. Test: HTTP status, canonical a indexovatelnost, XML validace, správné veřejné URL, žádný chráněný obsah v HTML/metadata/sitemap, preview není indexováno. Indexace a umístění ve vyhledávačích nejsou garantované.

## Budoucí marketing a komunikace
D1 oddělit transakční, marketingovou, zákaznickou a interní komunikaci; doručení, souhlasy a odhlášení. D2: záměr → příprava → kontrola/schválení → distribuce → měření → učení. Omezit kanály, rozpočet, četnost, zachovat lidské schvalování a stop mechanismus. Kandidáti: Instagram, Facebook, Pinterest, newsletter; volit podle výsledků, nebudovat všechny najednou. D4 měřit dosah, návštěvu, registraci, nákup a náklad. Pozdější integrace s Nexem nepodmiňuje počáteční fungování.

## Navázání práce
Načíst AGENTS.md, RELEASE_POLICY.md, tento doporučený dokument a skutečný head pracovní větve/PR. Ověřit aktuální stav testů a migračního plánu, nepovažovat doporučení za dokončenou implementaci. První krok: F0, následně A1. Evidovat skutečné výsledky v commitech a PR, oddělit ověřené od neprovedeného. Bez automatického merge či produkčního apply.
