# ARTales — předání: obecné sémantické QA, pilot The Great God Pan

**Read-only checkpoint: 2026-11-06 (Europe/Prague).** Tento dokument popisuje skutečně ověřený stav a závaznou metodiku další práce. Není to autorizace změny produkce ani potvrzení hotové AI opravy.

## Rozhodnutí pro další vlákno

Priorita je **P0: uzavřít obecný redakční QA cyklus a otestovat jej na Panovi společně s administrátorem**. Všechny změny musí být použitelné pro libovolné kandidátní dílo; Pan je pouze reálný testovací případ.

Repo: `ARTalesAdmin/ARTales`. K 2026-11-06 ověřený produkční `main` = `4abb90bf461d6f12e2d5317d29450c6ac7a2c1ce` (PR #302). Další vlákno MUSÍ na startu znovu ověřit HEAD a produkční deploy/DB; tento checkpoint neznamená, že se později nic nezměnilo.

* `main` = produkce; nové změny izolovaná větev z právě ověřeného `main`, review/testy/preview a samostatný schválený merge/DB apply.
* `develop` obsahuje historické nekompatibilní experimenty: pouze read-only reference, nikoli integrační základ.
* ARTales **bez Nexus runtime/governance** dle jednorázové provozní výjimky. Odkaz `Nexus AI` na UI je cílová produktová formulace, nikoli důkaz existujícího pracovníka.
* Nepřejímat automaticky celý draft PR #297: `https://github.com/ARTalesAdmin/ARTales/pull/297`, neuzavřený, 48 souborů, stará base `72ae856...`; některé jeho části již byly nezávisle vydány v PR #298–302. Je nutná selektivní inventura, diff proti **novému** `main`, deduplikace a oddělené bezpečnostní brány.

## Ověřený produkční stav Pana

Candidate `98508359-bce1-4e73-b842-b69a9d1112d0`, jedna semantická revize SHA `b8f99acc5abc5c965ec2707cca66abebb45fd4b9592c1dea79d20960b50f35b8`, stav `draft`, jedna otevřená `typography` QA značka `b39525e5-c4fd-4b7f-9871-dbc2fcea6565` na atomu `a:9a97e93e7b7b45bcf8257def`: „Dělení Raymond. Je to jméno, to bych nedělil mezi řádky.“ Žádná sémantická publikace. `artales_candidate_editorial_metadata` obsahuje 1 záznam (obsah konkrétních polí se v tomto checkpointu neprověřoval).

Šest úkolů, k poslednímu produkčnímu SELECT:
* `text_review` — **claimed**, Luboš (admin), id `fe8257aa-d624-41f3-9e7c-24b49ad02455`. Pilotní QA dělat spolu.
* `author_bio` — **claimed**, Pavla; `work_description` — **claimed**, Pavla. Uživatel potvrdil převzetí a viděl dvě rozpracované; pozdější readback ukázal tyto dvě plus administrátorské QA.
* `collection_curation` — **open**, Ivana. Stav byl po testu prokliku auditovaně vrácen z `claimed` na `open`, vlastník zůstal Ivana.
* `cover_art` a `author_visual` — **open**, Ivana.
* Všechny šest mají revizi výše. Žádný úkol nebyl ověřen jako `completed`; nedokončovat je demonstrativně.

Produkční rozhraní:
* `https://artales.net/member/editorial-pipeline`
* `https://artales.net/member/editorial-detail/98508359-bce1-4e73-b842-b69a9d1112d0`
* `https://artales.net/member/semantic/98508359-bce1-4e73-b842-b69a9d1112d0`

## Co existuje a co teprve dodat

**Existuje v main:** sémantická revize jako ověřitelná struktura a SHA-256 vazba na immutable zdroj; UI zobrazování bloků/QA flags; persistentní flag a komentář; administrátorský `commitSemanticQaBatch` s omezenými deterministickými operacemi (`exclude_note`, `compact`, `airy`, `center`) nad max 50 položkami, `recomposeSemanticBatch` a RPC `artales_commit_semantic_qa_batch`; redakční fronta s role-based assignment, administrátorskou změnou vlastníka, metadata kandidáta a podmínkami dokončení; bilingvní popisky (kniha, autor, kolekce) 200–800 znaků CZ i EN při novém vytvoření/uzavření úkolu. Byly nasazeny PR #298, #299, #300, #301, #302.

**Není dokončeno/produkčně ověřeno:** skutečný AI worker s frontou, cenovým účetnictvím a durable retry; návrh oprav pouze sazby z metodiky a QA flags; bezpečný atomický commit **AI** opravené revize a důkaz shody všech textových bytů; per-change verdict (přijmout/vrátit s poznámkou), barevné zvýraznění všech změněných bloků; navazující kontrola v jedné seanci; closeout QA a navazující úkoly; publikace všech šesti typů úkolů s propagací author/collection/cover a dvou popisků; publikovaný sémantický reader a migrace 49/64 historických děl. CI ani draft PR #297 neznamenají produkční funkcionalitu.

## Metodologie P0 — nejkratší bezpečná cesta

1. **START/REBASE AUDIT:** načíst aktuální `main`, vývojovou dokumentaci, SQL RPC definice, opravné revize v DB, PR #297 a současné deployment flags. Sestavit dependency matrix. Nevytvářet nový paralelní model pro historické WorkBlocks. Bez produkčních mutací v této fázi.
2. **INVARIANTY:** archivovaný originál a všechny jeho znaky a pořadí jsou neměnné. AI smí měnit pouze povolené prezentace, sazbu, zalomení, nezlomitelná spojení jmen, zobrazení/rozložení, kompozici a stránkování. Žádné tiché opravy pravopisu, odstranění odstavců či parafráze. Pokud originál skutečně chybný, zvláštní výslovně redaktorem vyvolaná textová revize se samostatnou proveniencí a schválením. `verifySemanticRevision` + konzistence zdrojových anchorů + audit před/po.
3. **QA DRAFT:** editor označí blok nebo pravidlo platné pro celé dílo, persistentní flag, komentář a evidence zdrojové revize. Běžný opakující se nález se aplikuje **per dílo hromadně**, nikoli padesátkrát ručně. QA první kola akce: `Přijmout dílo` pokud všechny podmínky PASS, nebo `Odeslat k opravě` pro otevřené nálezy. Jasný počet nálezů a stav.
4. **BATCH PREP / GUARDS:** nejdřív deterministické fixy; AI pouze kde je skutečný význam, za verzované metodiky a přesného vstupního kontraktu (atom, okolí, flag, policy, budget). AI vrací **strukturovaný omezený patch** výhradně nad layout/presentation. Validace každého patch, nemožnost změny řetězců a source mapping, limity a důvody odmítnutí. Fail closed.
5. **ASYNC, ALE JEDNA SEANCE:** durable job queue se stavy queued/running/completed/failed/retry, progress počítaný z reálného počtu kroků a auditovaných událostí, bez vymyšlených procent nebo slibů času. UI hláška o předání AI frontě; editor může zůstat, zavřít okno nebo zvolit práci bez čekání. Po dokončení se aktualizuje stejná seance, při odchodu vznikne navazující úkol **tomu samému editorovi**. Bez závislosti na dlouho běžícím browser requestu.
6. **IMMUTABLE COMMIT:** transakční CAS vůči očekávané rodičovské SHA, nová zapečetěná revize, vazba parent-child, status a audit, bez částečně přijatých oprav; případná kolize/timeout musí mít jednoznačnou recovery cestu. Nezakrývat neúspěch dokončením.
7. **REVIEW VERDICTS:** změněné bloky mají jednotnou speciální barvu odlišnou od aktivního výběru redaktora i původních flagů. Klik na změnu → `✓ Přijmout` bez povinného komentáře nebo `✗ Vrátit` s povinnou poznámkou. Reject vrací do skupinové dávky; až když je vše rozhodnuté, může se QA uzavřít. Opakované kolo stejné zásady.
8. **CLOSEOUT:** po schválení všech změn validovat žádné nevyřešené flags, zdrojovou integritu, snapshot/author/collection/cover/CS+EN popisky a požadované task stavy; dokončit QA auditovaně a bez dvojích/duplicitních tasků. Nespouštět publikaci jen proto, že AI PASS.
9. **DEMO/PROOF:** izolované testy pro změněné/prázdné/stará SHA/missing atom/duplicitní AI callback/multiple concurrent jobs/token limit/nenalezený worker/failed retry/odchod a návrat redaktora; DB RLS a grant tests z pohledu editora/admina; integrace na Panovi: z existujícího `Raymond` flagu až po potvrzení opravy, při zachování doslovného textu. Panovu QA zatím **neuzavírat**, dokud uživatel v aplikaci skutečně neposoudí výsledek.

### Nezbytné souběžné zásady

* Další rozvoj readeru samostatně, zpětně kompatibilní původní design i funkce, ale bez duplicitní semantické pravdy. Nový reader má převzít QA-ověřené sémantické bloky; mobilní/tablet/desktop a paginace jsou samostatná regresní matice. Dual-mode pro starých 49/64 děl až do jejich dokončené migrace; starý reader nesmí být regresován.
* Po publikaci nález v mobilní čtečce musí založit revizi, ne přepsat vydanou knihu in place.
* P1 migrace katalogu po bezpečné nové semantické pipeline; po jednom titulu, zachování vizuálů/autorů, manuální QA vlastníkem; až potom vypnout legacy model. P2 AI návrhy anotací a profilů. Nevytvářet teď přidružené side quests.
* Učení z logů: token/čas/cena/pokusy/flag/accepted-rejected outcome. Periodické přezkoumání cca 14–30 dní **s lidským potvrzením** metodiky; nic se nesmí učit samo a potichu povyšovat do pravidel.
* Produkční SQL / merge / release jsou oddělené brány s výslovnou autorizací; aktuální dotaz na předání není schválení nasazení nové QA. Každý ověřený release musí obsahovat runtime readback, CI, Vercel status a skutečnou uživatelskou zkoušku.

## Převzetí vláknem

Pokyn do dalšího vlákna:

> Pokračuj v ARTales P0 — obecné sémantické QA s pilotem *The Great God Pan*. Nejdřív přečti `docs/ARTALES_SEMANTIC_QA_HANDOFF_20261106.md` z ověřeného `main` (nebo z handoff větve/PR, pokud ještě není sloučeno), revaliduj produkční data, projdi starý draft PR #297 pouze selektivně, a vytvoř nejkratší bezpečný plán implementace a ověření AI oprav/nové revize/verdiktů/jedné seance. Nesnaž se znovu budovat redakční frontu. Nezasahuj do textu originálu ani do legacy readeru; neprováděj produkční apply/merge bez samostatné autorizace. Po každém větším bloku dodej ověřitelný výsledek a přiznej nedokončené části.

### Důkazy / odkazy
- Repo: `https://github.com/ARTalesAdmin/ARTales`
- Rozpracovaný velký návrh: `https://github.com/ARTalesAdmin/ARTales/pull/297`
- Workflow: `docs/WORKFLOW.md` a `docs/RELEASE_POLICY.md`
- Sémantika: `lib/semantic/compose.ts`, `app/member/semantic/[candidateId]/qa-actions.ts`, `components/editor/SemanticReaderLab.tsx`, `components/editor/SemanticQaPanel.tsx`
- Produkční úkoly: `app/member/editorial-pipeline/page.tsx`, `app/member/editorial-detail/[candidateId]/page.tsx`
- Draft PR #297 navržené soubory: `lib/semantic/aiQaProposalEngine.ts`, `app/api/internal/editorial/ai-qa-jobs/route.ts`, `app/member/semantic/[candidateId]/ai-job-actions.ts`, `ops/sql/20261104_artales_ai_qa_durable_jobs.sql`, `ops/sql/20261104_artales_safe_layout_commit_v4.sql`, `ops/sql/20261104_artales_qa_change_decisions_v4.sql`, `ops/sql/20261104_artales_qa_closeout_v4.sql`; ověřit kompatibilitu s novým `main`.
