# ARTales — Právní screen v1

## Scope
Po Kandidátech A+B následuje individuální dohledání zdroje/edice, evidence autora, překladatele, ilustrátora, licenčních podmínek a zdůvodněné právní rozhodnutí. Bez snapshotu, kompletního crawlu textu, Readeru, Works mutací nebo automatické publikace. Odkazy pro čtení se otevírají u poskytovatele.

## Status
Source-only, izolovaná větev. Migrace nebyla aplikována v produkci. Nová UI není v produkci. Aktivovat teprve po SQL, RLS, autentizovaném a rolovém smoke testu.

## Data
- candidate_legal_sources: identita edice, originální zdroj, externí čtecí URL, rok, jazyk, překladatel, ilustrátor, autorství/práva/podmínky, evidence, editor.
- candidate_legal_decisions: pouze append-only rozhodnutí s nezávislou historií a snapshotem důkazů k danému okamžiku, admin final, editor needs_evidence/deferred.
- Neschvaluje se ani nemění work_candidates.rights_status; přednost má samostatná evidence screeningu.

## Role
Editor/admin: čtení, přidání zdrojů, právní ověření i mezikroky. Admin: schválení žádosti o snapshot; žádný skutečný snapshot v tomto rozsahu.
RLS v DB je povinné; samotný formulář nestačí jako autorizace.
Schválení vyžaduje doložené právo původního textu, překladu (nebo výslovně bez překladu), vyloučení ilustrací, ověřené podmínky zdroje, důkaz a podrobné odůvodnění. Náhled ani záznam v Open Library nejsou právní schválení.

## Limitace
Automatický crawler Gutenberg a import knih není součástí v1. Automatické posouzení zákonných práv není součástí v1. Vyhledávání využívá externí katalogové stránky (Open Library, Gutenberg); žádný text se nestahuje na ARTales. Dlouhodobá cache / ingest až v navazující etapě.

## Uvolnění
Risk: high (DB, RLS a právní rozhodnutí). Target: develop/isolated validation first; production only after explicit separate authorization. DB: yes. Env: no.
Rollback: nejprve deaktivovat UI; schéma a auditní data ponechat, nesmazat. Žádné destruktivní zpětné migrace.

## Požadované testy
- migrační APPLY a schema readback na izolované DB s kompatibilními ARTales migracemi
- editor/admin/reader a anon RLS INSERT/SELECT, pokus editora o approved/rejected zamítnut
- admin approved bez source, evidence, překladových práv, nebo nejasných podmínek vždy odmítnut
- rozhodnutí je append-only; schválená edice nelze měnit
- idempotence kandidátů beze změn
- funkční obrazovka, vypnutý ingest, externí odkazy, bez získávání plných textů
- build/TS/lint, signed E2E až po autorizovaném deploy

## Integrační audit 25. 10. 2026
- Izolovaná Supabase migrace a 6 negativních / 2 pozitivní rolové testy PASS; testovací DB odstraněna.
- Současný návrh obsahuje ruční evidenci edice a externí odkazy pro prohlížení; **integrovaný výběr katalogových edic ani interní textový náhled zatím neexistuje**. Tyto schopnosti musí být doplněny, než bude možné tvrdit, že flow „crawl → výběr edice → čtení“ je celé hotové.
- Audit identifikoval souběžnou změnu podkladu během schvalování. Zdrojová oprava používá společný transakční advisory lock před editací zdroje a před získáním rozhodovacího snapshotu. Opravu je ještě nutné revalidovat na izolované DB včetně paralelního scénáře; starší úspěšný DB test nebyl testem této revize.
- Aktivace zůstává zakázaná: bez produkční DB migrace, skutečných rolových E2E kontrol a explicitního schválení.

## Doporučení edice — integrační pravidlo

Zdrojový modul `lib/legal/editionRecommendation.ts` připravuje **doporučení, nikoli právní rozhodnutí**. Není dosud zapojen do produkčního vyhledávacího UI, neprovádí webový crawl ani nepíše do DB.

Rozhodovací pořadí:
1. Projít identitu díla a jazyk. Neshody nebo pochybnosti vyřadí zdroj z automatického výběru.
2. Před automatickým doporučením vyžadovat doložený originální text, případný překlad, výslovné vyloučení ilustrací, zdrojové podmínky a odkazy/důvody právních závěrů.
3. Upřednostnit kompletní, textově ověřené a technicky jednoduše použitelné vydání; prostý text/HTML před EPUB. OCR/scany a katalogové údaje bez ověřeného textu eskalují.
4. Při stejné technické použitelnosti upřednostnit novější **vydání**, nikoli novější původní copyright nebo jiné dílo.
5. Neznámý rok, nerozhodný souběh nebo nedostatek důkazů => `manual_review`; editor může vybrat ručně, admin provádí finální právní schválení.
6. Výstup vždy obsahuje `legalApprovalRequired: true`; žádné automatické udělení práva ani vytvoření snapshotu.

Důležité: právní metadata nesmějí být odvozena z pouhého API Open Library; vyžadují samostatné důkazní posouzení. Další integrace musí přidat omezený katalogový adapter (Open Library Work → Editions), bezpečné náhledy dostupných textů a validaci vazby metadata ↔ zvolená edice. Zatím nesdělovat, že celý výběrový flow je nasazen.

## Rozdělení kompetencí — aktualizace
- Editor + admin: vyvolání screeningu, kontrola chronologických údajů, právní ověření zdroje a zápis rozhodnutí.
- Editor + admin: návrh snapshotu po posledním schváleném screeningu; stav `pending`.
- Admin: přijetí či zamítnutí požadavku na snapshot. **Ani adminská aprobace požadavku ve v1 neprovádí samotný snapshot/ingest.**
- Gutenberg první volba (externí vyhledání), Open Library alternativa. Rok úmrtí autora, překladatele a ilustrátora jsou důkazy/nápověda, nikoliv automaticky `rights=clear`. Chybějící metadata, spoluautoři nebo nejasná licence vyžadují eskalaci.
- Oddělená DB tabulka `candidate_snapshot_requests` a RLS pro admin review; schválení snapshotu je jiná autorita než právní posouzení.
- Zdroj-only změny vyžadují opětovný izolovaný DB test skutečné aktualizované migrace včetně tabulky žádostí a kontrol, než bude možný produkční APPLY.
