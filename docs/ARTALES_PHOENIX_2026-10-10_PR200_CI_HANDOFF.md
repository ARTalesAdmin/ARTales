# ARTales Phoenix — 2026-10-10, PR #200 / izolovane databazove CI, uzavreni hlavniho vlakna

> Durable checkpoint, **neautoritativni**. Zivy GitHub, Supabase, AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md a explicitni autorizace architekta maji prednost. Nezamenujte starsi Phoenix 2026-10-10_MAIN.md ani drive uvedene heady za aktualni stav.

## Autoritativni readback pri uzavreni

- Repo: ARTalesAdmin/ARTales, produkce `main` HEAD **171df191eb54dbcef7bb015f748138c630428b2f**; develop HEAD **867afd9253a6ab28c1b39d73677a18ab9d34c367**.
- #196 ingest/comparison Reader fixture merged do develop, #197 synthetic budget/rights planner merged, #198 editorial legal-review tasks/RLS merged, #199 predchozi dokumentacni Phoenix merged, **#201 Preview Supabase isolation merged**.
- #200 otevrene **DRAFT**, branch `feat/artales-candidate-draft-editorial-handoff-20261010`, HEAD **a7095aa26921becab48ab02af706e97896123880**, base develop 867afd9253a6..., mergeable true (neni to znameni testove ready). 18 commitu a 10 zmenenych souboru pri poslednim readback.
- Supabase produkcni ref **nmhdwmszbwgrgfbmlguu**; `list_branches` vraci **jen main**, neni trvala dev/ephemeral branch. Produkcni migrace: **jen 20260926142755_remote_schema**. SQL kandidatu, editorial tasku ani #200 nebylo aplikovano na produkci.
- Vercel Preview env: zakazane/fail-closed testovaci URL a publishable/anon key oddelene od produkcnich hodnot; service-role key pouze Production. `ARTALES_FIXTURE_MODE=candidates` branch develop. Produkcni editor vytvari autory/knihy dal bez omezeni. Nepouzivat stara immutable Preview, ktera byla sestavena se sdilenymi hodnotami.
- Neprovadet `main` merge, produkcni DB apply, produkcni env edit ani vypinani editoru bez **noveho samostatneho explicitniho souhlasu**.

## Co skutecne vzniklo v #200

Novy nejmensi serverovy oblouk kandidat -> konkretni source -> hash/capture -> nezavisle editor review -> v jedine PostgreSQL transakci koncept `works` a `editorial_tasks(kind=edit_text, work_id)`, s kandidatskym linkem, idempotentnim `source_external_id` a promotion auditem. Dosud jen v feature branch, ne develop ani production DB.

Zmeny:
- `supabase/migrations/20261010164459_artales_candidate_draft_edit_text_handoff.sql`: jediny kanonicky (Supabase CLI v2.120.0 vygenerovany) soubor. Tabulka candidate_source_captures s SHA256 textu; oddelene `register_candidate_source_capture` admin a `review_candidate_source_capture` editor/admin; druhy actor na zaklade auth.uid(), nelze podstrcit reviewer ID; review fingerprint candidate/source/rights; explicitni typ puvodu a zdroje, zadny implicitni public_domain; atomicke `promote_candidate_to_edit_text`; audit, zamykani candidate -> source -> rights -> capture.
- `lib/candidateDraftHandoffGate.ts`, `lib/candidateSnapshotDigest.ts`, puvodni Node testy; samotne staticke testy nejsou DB E2E.
- `.github/workflows/artales-pr200-db-qa.yml`: disposable Docker/Supabase GitHub-hosted runner, bez cloud produkce a secretu, CI pgTAP.
- `supabase/tests/200_candidate_handoff_contract.sql`: 12 kontraktnich/RLS/EXECUTE testu.
- `supabase/tests/201_candidate_handoff_lifecycle.sql`: 22 skutecnych lokalnich DB/RPC behavioral aserci — dva simulovani auth subjekti, samoschvaleni, uspesny create work/task, opakovani, component-rights tamper, audit a forced rollback.
- `docs/ARTALES_PR200_ISOLATED_DB_QA.md`, `docs/ARTALES_CANDIDATE_DRAFT_EDITORIAL_HANDOFF_PLAN_2026-10-10.md`.

**Pozor:** PR #200 description je stale historicky (tvrdi docs-only), neodvozuje se z ni status. Pred budouci merge ji aktualizovat podle skutecneho diffu a testu.

## Novi testovaci infrastruktura — CO, KDY A JAK

**Hlavni technicky milnik:** skutecne funguje GitHub Actions lokalni Supabase/PostgreSQL + pgTAP. Repozitar ma schema-only baseline produkcni DB v `supabase/migrations/20260926142755_remote_schema.sql` — zadna prod data.

Viz presny playbook: **[ARTALES_DATABASE_TEST_ENVIRONMENT_2026-10-10.md](./ARTALES_DATABASE_TEST_ENVIRONMENT_2026-10-10.md)**.

Kdy:
- **Vychozi pro kazdou DB/SQL/RLS/trigger/RPC zmenu:** jednorazovy lokalni DB job bez placene cloud Supabase. GitHub Actions auto trigger pri PR do develop a zmenach v `supabase/migrations/**`, `supabase/tests/**` nebo samotnem workflow; `workflow_dispatch` pripraven.
- **Pro skutecne podepsane auth uzivatele + Next.js browser/API + Preview:** pripadne kratke placene **ephemeral** Supabase branch; cena drive $0.01344/h, znovu zjistit a potvrdit; zadna stale platena develop branch; musi se smazat a readbackem overit cleanup.
- **Pro realnou concurrency:** dve oddelena SQL spojeni na disposable local DB (napr. psql/pg driver v CI), nikoli jen dve volani v jedine session.
- Neni nutne znova zkouset zapis do auth.users na cloud Supabase API; drive blokovany. Synteticke `auth.users` profily uvnitr CI disposable lokalni DB byly **uspesne overeny** behom #5. To doklada lokalni test roles, nikoli realny login JWT/browser.

Bezny CI sled: checkout -> setup-cli v2.120.0 -> supabase init --force (jen cisty runner) -> supabase start --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor -> supabase test db --local -> supabase stop --no-backup s if: always(). Job `permissions: contents: read`, prazdny SUPABASE_ACCESS_TOKEN a DB_PASSWORD, **nevyzaduje cloud link ani produkcni secret**.

CI readback:
- [Run #3](https://github.com/ARTalesAdmin/ARTales/actions/runs/38073964414) commit 9e7e730...: **SUCCESS, 12/12**, cleanup PASS.
- [Run #5](https://github.com/ARTalesAdmin/ARTales/actions/runs/38075011866) commit a7095aa...: **FAIL 33/34**, 12/12 schema PASS, 21/22 behavioral PASS, cleanup PASS.
- Run #4 cancelled pri aktualizaci PR, cleanup PASS.

### Jedina aktualni zjevna testova chyba a presny opravny krok

Run #5 `supabase/tests/201_candidate_handoff_lifecycle.sql`, pgTAP assertion `submitting admin cannot review own snapshot`, test #4 z 22.

V DB funkci `public.review_candidate_source_capture` je platne:
`return jsonb_build_object('result','blocked','reason','self_review_forbidden')`.
Test ale aktualne dela `))->>'result','self_review_forbidden'` — porovnava pole `result` misto `reason`.

**Naprava:** jen v tomto testu nahradit `))->>'result','self_review_forbidden'` -> `))->>'reason','self_review_forbidden'`. Nemenit implementaci bez duvodu; nezmenit jine aserce na blocked. Pak cely GitHub Actions znovu -> musi byt **34/34** zelenych (pripadne resit nove nalezy). V tomto Phoenix dokumentacnim PR zamerne NEUPRAVOVAT runtime ani test feature #200. Uvedena chyba dosud v #200 neopravena.

Co #5 skutecne podporuje: 1 draft + 1 edit_text task + 1 task-created event + 1 promotion audit na pozitivnim pruchodu, idempotentni opakovani, fail-closed changed rights, forced failure rollback (works/link/task vse vraceno). Bez dvojiteho simultanniho spojeni — skutecnou race/deadlock toleranci **zatim nezmereno**. SQL synteticky reviewed content =/= verifikovana pravni licencia, komercni release nepovoluje.

## Bezpecnostni otevrene otazky #200

- SECURITY DEFINER u public RPC musi mit minimal grants, fixed search_path, presne role a nezmenitelny audit; pred integraci treba security advisor + adversarial proverit. Strukturalni hash a dva lide sami o sobe nejsou externi prava.
- Captured source / component-rights inventory pri zadani muze byt uzivatelske tvrzeni, nikoli nezavisle archivni overeni; kontrola povolenych komponent zustava fail-closed, neprohlasovat realnou legal clearance.
- Zamky v review/promote sjednoceny candidate -> source -> rights -> capture; **realne paralelni dve transakce dosud neprobehly**.
- GitHub-local CI vypina GoTrue, proto validuje Postgres `auth.uid()` pri simulaci JWT claim v SQL — nevypovida o skutecnem OTP/email/Supabase Auth ani browser E2E.
- Workflow pri PR do develop reaguje na sql/tests/yaml soubory; doc-only commit ho nezapne. GitHub job musi byt ctverec: vysledky, cleanup, exact head. Vsechny behy mohou zrat minuty GitHub-hosted runner, zadna stale DB.
- Reader/Composer a UI source-anchored prace jsou ve vedlejsim vlakne, nevrtat se do souboru vlastnenych druhym vlaknem. V ramci tohoto PR resit DB gate/atomicita/QA. Nexus worker queue se nepouziva.

## Postup navazujiciho hlavniho vlakna

1. Overit zive `main`/`develop`, #200 HEAD a GitHub run #5; precist AGENTS.md, WORKFLOW, RELEASE_POLICY, DURABLE_CHECKPOINT a tento Phoenix/playbook.
2. V #200 opravit **jen** pole v testu `self_review_forbidden`, na soucasnem HEAD a spustit CI (vyvola jej commit do supabase/tests). Vyhodnotit pravdive green na latest head.
3. Pokud green, implementovat oddeleny 2-connection concurrency harness na **stejne lokalni GitHub Actions DB**, idealne dve transakce se soubeznymi RPC, s timeout a aserci 1 work+1 task, zadny deadlock; commit, CI rerun.
4. Dokoncit SECURITY DEFINER/RLS/adversarial review, popr. docilit minimal changes, ne prekopavat fungujici migraci bez dukazu.
5. Zhodnotit realne signed Auth/Preview E2E oddelene; bud izolovany jednorazovy cloud Auth test po samostatne nakladove akceptaci, nebo jasne oznacit externi E2E jako neoverene. Code merge develop vs production DB apply jsou **dve ruzne autorizace**.
6. Po vsech dohodnutych gatech pripravit konkretni merge verdict a vyzadat si potrebnou autorizaci. #200 je stale DRAFT, zadny automaticky merge. Po dokonceni verzovat Phoenix status.

## Release/governance a archiv

- Architekt autorizuje merge; nikdy se neslucuje do `main` automaticky. `develop` bez trvale placene DB, fixture Preview fail closed.
- Produkcni ARTales se stavajicimi editory musi dal umoznovat autory, knihy a bezny zivot. Nechat production env, main, Supabase schema/data a role beze zmen.
- Tento Phoenix a playbook jsou **docs-only samostatny PR** do develop, nezavisly na testech #200. Dokumentacni merge mozny az po kontrole a vyslovnem rozhodnuti; zapsani checkpointu neni merge #200.
- Starsi `ARTALES_DURABLE_CHECKPOINT.md` a `ARTALES_PHOENIX_2026-10-10_MAIN.md` obsahuji historicke sekce; toto je aktualnejsi rekonciliace, ale stale neautoritativni.

## Prompt pro nove HLAVNI vlakno (copy/paste)

> Pokracujeme ve vyvoji ARTales po Phoenix 2026-10-10 — PR #200, izolovane DB CI. Repo ARTalesAdmin/ARTales. Nejdrive read AGENTS.md, docs/WORKFLOW.md, docs/RELEASE_POLICY.md, docs/ARTALES_DURABLE_CHECKPOINT.md, docs/ARTALES_PHOENIX_2026-10-10_PR200_CI_HANDOFF.md a docs/ARTALES_DATABASE_TEST_ENVIRONMENT_2026-10-10.md (tyto posledni dva v samostatnem docs PR, pokud jeste nejsou mergnute). Over zive main/develop/pr #200 a Supabase branches. Posledni znamy develop 867afd9253a6, main 171df191eb54; PR #200 DRAFT HEAD a7095aa26921. #201 Preview DB isolation uz merged, zadna trvala vedlejsi Supabase DB. PR #200 je skoro hotovy atomicky kandidat -> source capture -> nezavisle review -> works draft + edit_text task, ale dosud se neslucuje. GitHub Actions lokalni Supabase + pgTAP je funkcni a bez produkcnich dat/secrets, run #3 12/12 PASS, run #5 33/34 FAIL. Jediny FAIL v supabase/tests/201_candidate_handoff_lifecycle.sql: test self_review_forbidden porovnava ->>'result' s 'self_review_forbidden'; DB spravne vraci {result:'blocked',reason:'self_review_forbidden'}. Oprav tuto **jedinou testovou aserci** na ->>'reason', spust znovu CI a vyhodnot. Pak navrhni a implementuj opravdovy 2-connection concurrency test ve stejnem lokalnim GitHub Actions runneru, security-definer audit a rozhodnuti o dalsim podepsanem Auth E2E. Nic neaplikuj do produkce, bez schvaleni zadny merge do main, produkcni DB ani placeny long-lived Supabase. Nezamenuj SQL-role simulaci s podepsanym Auth/browser E2E, synteticka rights data s legal clearance ani merged SQL soubory s DB apply. Druhe vlakno vlastni Composer/Reader. Na konci dej jasny verdict: PR #200 ready nebo chybi konkretni gate.
