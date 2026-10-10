# ARTales: databazove testovaci prostredi / CI playbook — 2026-10-10

> **Aktualni provozni navod / neautoritativni dokument.** V pripade rozporu maji prednost zivy kod, konfigurace CI, AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md a explicitni autorizace architekta.
> Companion Phoenix: [ARTALES_PHOENIX_2026-10-10_PR200_CI_HANDOFF.md](./ARTALES_PHOENIX_2026-10-10_PR200_CI_HANDOFF.md).

## 1. Co jsme postavili

Novy *opakovatelny izolovany* databazovy QA harness pro ARTales, vytvoreny **v PR #200**, zatim **ne v mergnutem develop**. Testy bezi na jednorazovem GitHub-hosted runneru s lokalnim Docker/Supabase PostgreSQL. Nepotrebuji druhy placeny cloudovy Supabase projekt ani dlouhodobou vyvojovou branch.

| Soubor v feature branch PR #200 | Ucel |
| --- | --- |
| .github/workflows/artales-pr200-db-qa.yml | GitHub Actions job: local-only DB boot, test a cleanup |
| supabase/migrations/20260926142755_remote_schema.sql | Schema-only baseline produkcni DB, **bez produkcnich dat** |
| supabase/migrations/20260928100532_work_candidates_foundation_p1_1a.sql | Kandidati / RLS |
| supabase/migrations/20260928100546_candidate_persistence_p1_2a.sql | Zdroje, komponentova prava, audit, draft constraints |
| supabase/migrations/20261010111107_artales_editorial_tasks_pilot.sql | Redakcni tasky, audit a RLS |
| supabase/migrations/20261010164459_artales_candidate_draft_edit_text_handoff.sql | Rozpracovany schvalovaci gate a atomicky prevod |
| supabase/tests/200_candidate_handoff_contract.sql | 12 pgTAP testu schema/RLS/grants |
| supabase/tests/201_candidate_handoff_lifecycle.sql | 22 pgTAP testu dvou simulovanych roli, deduplikace, tamper, rollback |
| docs/ARTALES_PR200_ISOLATED_DB_QA.md | Detail a acceptance hranice uvnitr PR #200 |

**CI implementace:** GitHub Actions, ubuntu-latest, Supabase CLI pres supabase/setup-cli@v1 s verzi 2.120.0. Komponenty Supabase, ktere nejsou potreba, se pri startu vylucuji (vcetne GoTrue, Realtime, Storage, Studia a API). DB migrace se aplikuji pouze uvnitr runneru. Sada pouziva pgTAP ve formatu SQL. Kazdy pgTAP soubor zacina BEGIN a konci ROLLBACK.

## 2. Kdy toto prostredi pouzit — vychozi volba

**Pouzit automaticky pri PR do develop, ktere meni:**
- Supabase SQL migraci, DDL, funkce, triggery, RLS, prava nebo redakcni/kandidatske transakce;
- testy v supabase/tests;
- samotny GitHub Actions QA workflow.

Workflow je konfigurovan na PR event do develop a path filtry supabase/migrations/**, supabase/tests/**, .github/workflows/artales-pr200-db-qa.yml. Zmena pouze dokumentace jej **nespusti**. workflow_dispatch je pripraven pro rucni spusteni, pokud jej GitHub umozni; dostupnost pro konkretni ref je nutne overit.

**Neni nahradou za:**
- browser/app E2E s realne podepsanymi Supabase Auth relacemi a HTTP/PostgREST;
- skutecne paralelni transakce ve dvou nezavislych PostgreSQL spojenich;
- overeni aktualni Vercel Preview konfigurace;
- pravni provereni skutecne edice/textu nebo dovoleni ke komercnimu pouziti;
- autorizaci produkcni DB migrace a deploymentu.

Testovaci SQL zaklada **zcela synteticke** profily a auth.users uvnitr lokalni databaze. Role jsou simulovane pomoci PostgreSQL SET LOCAL ROLE authenticated a lokalni JWT claim (request.jwt.claim.sub). Jde o poctivy DB/RPC/RLS kontrakt, **nikoliv** o plne realne Supabase Auth prihlaseni. Proto je GoTrue v testovacim runneru zamerne vypnute.

## 3. Jak bezi CI a jak se cte vysledek

Workflow obsahuje tento sled:

1. checkout exact PR commitu (jen permissions: contents: read);
2. install Supabase CLI 2.120.0;
3. supabase init --force **uvnitr noveho runneru**;
4. supabase start s vyloucenim nepotrebnych sluzeb; nacist schema-only baseline a navazne migrace;
5. supabase test db --local (pgTAP);
6. supabase stop --no-backup vzdy, vcetne chyby testu.

V jobu jsou SUPABASE_ACCESS_TOKEN a SUPABASE_DB_PASSWORD zamerne prazdne. Workflow nepotrebuje produkcni URL, service-role key ani GitHub zapisova opravneni. Nesmime jej pozdeji rozsirit o --linked, db push, vzdaleny projekt ani produkcni secret.

**Presne overene dukazy k 2026-10-10:**

| Run / commit | Co bylo testovano | Vysledek |
| --- | --- | --- |
| [#3 / 38073964414](https://github.com/ARTalesAdmin/ARTales/actions/runs/38073964414), 9e7e730b7831498240b874c9157ca6e21a1bdf44 | 12 schema/grant/RLS pgTAP kontrol | **PASS 12/12**; lokalni DB start i cleanup PASS |
| [#5 / 38075011866](https://github.com/ARTalesAdmin/ARTales/actions/runs/38075011866), a7095aa26921becab48ab02af706e97896123880 | 12 schema + 22 behavioral pgTAP kontrol | **FAIL 33/34**; jedina chyba: self-review test #4, viz nizsi presna diagnoza; cleanup PASS |
| #4 / 38074991562 | Predchozi meziverze pred upravou testu | Cancelled po novem commitu; cleanup probehl |

**Proc run #5 skoncil cervene:** Funkce review_candidate_source_capture spravne vraci JSON {"result":"blocked","reason":"self_review_forbidden"} pri samoschvaleni. pgTAP v supabase/tests/201_candidate_handoff_lifecycle.sql u kontroly 'submitting admin cannot review own snapshot' porovnava *->>'result'* s retezcem *self_review_forbidden*, tj. porovnava spatne JSON pole. Doporucena **jednoradkova** korekce testu: zmenit pri teto konkretni aserci *->>'result'* na *->>'reason'*, ponechat ocekavany retezec. Znovu spustit cele CI. **Zatim neprovedeno; #5 zustava FAIL.**

Ostatnich 21 z 22 behavior testu proslo vcetne jedineho works draft, jedineho edit_text tasku, task created eventu, opakovaneho volani, zmeny prav po review a vyvolaneho rollbacku. To je dukaz funkcnosti uvnitr simulovaneho PostgreSQL kontextu, **nikoliv** podepsany browser Auth E2E.

## 4. Jak lokalne zopakovat — pouze na ciste testovaci kopii

Podminky: Docker a Supabase CLI kompatibilni s verzi 2.120.0. Pracovat na nove clone/CI runneru feature branche PR #200; nepripojovat projekt k cloudove produkcni Supabase. *supabase init --force* v existujici pracovni kopii muze prepsat lokalni config.toml.

~~~bash
supabase init --force
supabase start --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
supabase test db --local
supabase stop --no-backup
~~~

Kontrola stop se musi provest i pri predchozi chybe. GitHub Actions ma proto krok s podminkou *if: always()*. Neni nutne zrizovat ephemeral Supabase branch pro kazdou SQL regresi.

## 5. Kdy pouzit DOCASNOU cloudovou Supabase branch

Pouze kdyz test skutecne vyzaduje cloudove GoTrue/Auth, Vercel/HTTP/PostgREST, preview autentizaci, serverless provoz ci chovani mimo lokalni runner. Priklady: realny login dva ruznych editoru, plne E2E Reader/Composer napojeni na DB, prokazani spojeni Vercel Preview ke konkretni testovaci DB.

Pravidla:
1. Vyziadat aktualni cenu a potvrzeni nakladu pred vytvořenim; drive pozorovana sazba byla **$0.01344/h**, neni cenovy prislib.
2. Branch *jen na dobu aktivniho testu*, bez kopirovani produkcnich dat, bez long-lived develop DB.
3. Testovat jen na syntetickych identitach/datach. Zapisovat do PR jmeno/ID/ref branch, cas zalozeni, aplikovane migrace, vysledky a cas smazani.
4. Preview must target **exact ephemeral ref**; nikdy ne produkcni. Po testu odebrat docasne preview secrets a vratit fail-closed config.
5. Smazat branch a znovu nacist list_branches; neusinat s bezici testovaci DB.

**Posledni overeny stav** 2026-10-10: pouze produkcni Supabase branch main (ref nmhdwmszbwgrgfbmlguu); zadna dalsi branch. Produkcni historie migraci stale obsahuje jen baseline 20260926142755_remote_schema.

## 6. Vercel Preview / produkcni ochrana

PR [#201](https://github.com/ARTalesAdmin/ARTales/pull/201) merged do develop (867afd9253a6ab28c1b39d73677a18ab9d34c367). Vercel env readback 2026-10-10:
- NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY: odlisne nefunkcni hodnoty pro Preview; puvodni produkcni hodnoty pouze pro Production;
- SUPABASE_SERVICE_ROLE_KEY pouze Production;
- ARTALES_FIXTURE_MODE pro Preview git branch develop (read-only kandidatni fixture).
- Bez explicitniho ephemeral ref a credential nesmi preview zapisovat do DB. Stara immutable preview nasazeni vytvorena pred izolaci nepouzivat k prihlasenemu zapisovemu testu.

**Produkce:** main / artales.net a bezne ukony produkcnich editoru (autori, dila) se nemeni. Merge SQL kodu do develop nikdy sam o sobe neprovadi produkcni Supabase apply.

## 7. Pozadavky pred merge PR #200

1. Opravit jedinou chybne namirenou self-review pgTAP aserci a vyzadovat vsech **34/34 PASS** na aktualnim HEAD.
2. Doplneny nezavisly test dvou PostgreSQL spojeni: concurrent promote stejneho kandidata -> presne jeden draft/task, zadny deadlock, idempotentni druhy vysledek; lock_timeout/timeout negative case.
3. Projit SECURITY DEFINER audit, overit RLS a direct-write neprochodnost, overit append-only audit a fail-closed source/rights gate.
4. Oddelene vyhodnotit skutecne podepsane Supabase Auth E2E: zatim NEDOLOZENO; muze potrebovat jednorazovou cloud branch v dalsim kroku.
5. Nezamenovat strukturalni rights review a SHA256 za skutečnou pravni licenci nebo overenou archivni evidenci; realne komercni vydani a publishing stale nejsou povoleny.

**Nespojovat #200 pred dukazy a explicitnim rozhodnutim.** Nasledujici opravny test je nize narocny a uz je presne diagnostikovany.
