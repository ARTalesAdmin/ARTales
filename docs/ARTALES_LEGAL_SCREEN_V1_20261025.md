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
Editor/admin: čtení, přidání zdrojů, mezikroky. Admin: finální výrok approved/rejected.
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
