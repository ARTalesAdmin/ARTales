# Kandidáti A+B — bezpečný source-only balík

Základ: produkční main (Prescreen Shadow Library), **nikoli develop**. Větev: `feat/candidates-a-b-prescreen-mainline-20261023`.

## Scope

- Trvalý seznam Kandidátů pro aktivní editory a administrátory: ruční založení, vyhledání, detail, stav, priorita, poznámky.
- Převod jednoho existujícího `queued` handoffu pouze administrátorem, atomicky přes `artales_transfer_prescreen_handoff`.
- Opakovaný převod vrací původní kandidátní ID; závod o stejný titul serializuje `FOR UPDATE`.
- Unique bibliografický identifikátor a Open Library work key; shody v již publikovaných/uložených `works` a kandidátech končí bez sloučení.
- Open Library záznam není edice ani právní rozhodnutí. `rights_status='unknown'`, `discovery_status='pending'`.
- Žádné změny do `works`, readeru, parseru, plateb, Auth nebo publikování.

## Migrace a bezpečné pořadí

1. **Před produkcí:** sladit v repozitáři starší název Prescreen migrace `20261022201100` s již aplikovanou `20261023063248`; obsah SQL je identický. Nespouštět původní Prescreen pod druhým ID. Provést samostatnou migrační kontrolu.
2. Na izolované databázi s produkčním baseline nasadit pouze `20261023114500_candidate_intake_ab.sql` a otestovat funkcionalitu a RLS pod skutečnou identitou.
3. Samostatně autorizovat produkční APPLY nové migrace; po readbacku a kontrole migrací teprve aktivovat aplikaci. Deploy před migrací by zobrazil chybu kandidátní stránky a transfer RPC.
4. Případný rollback UI neodstraňuje uložené kandidáty. **Neprovádět automatický drop tabulky** při návratu.

## Povinné testy (dosud **NEPROVEDENY**, pouze source-only příprava)

- [x] SQL migrace PASS v čisté krátkodobé Supabase větvi se schématem produkce, 2026-10-24; RLS zapnuté, tři politiky a dvě RPC funkce přítomny; testovací větev smazána.
- [ ] Dvě souběžná předání jednoho handoffu → právě jeden Kandidát, obě odpovědi odkazují na stejné ID.
- [ ] Znovu provedené předání → `already_transferred`, žádná další řádka.
- [ ] Stejný titul jako `works` → `existing_work`, bez převodu.
- [ ] Shoda s ručně založeným Kandidátem → `existing_candidate`, bez tichého sloučení původu.
- [ ] Admin může převést queued titul, editor/member/anon nemůže.
- [ ] Aktivní editor může vytvořit ručního Kandidáta a změnit stav, prioritu a poznámky.
- [ ] Editor ani běžný API klient nemůže přepsat identitu, původ, právní stav nebo použít Prescreen API bez oprávnění.
- [ ] `transferred` nelze legacy voláním vrátit na `queued`.
- [ ] Reload zachová kandidáta a poznámky; mobilní/desktop layout, prázdná i chybová stránka.
- [ ] Regrese Prescreen hledání, výběru, odebrání, historie a právního disclaimeru.
- [ ] Regrese Reader, Login, veřejné stránky a stávajících 64 `works`.

## Riziko a hranice

Riziko: **medium** (nová DB tabulka + RPC + admin UI). Target: **production safe po testech**. DB: **yes, source-only**. Env: **no**. Reader/Auth/Payments: **no**.
První release neobsahuje právní screening ani automatické vytváření konceptu.

Testovaný stav (2026-10-24): krátkodobá Supabase branch APPLY PASS a základní readback PASS; GitHub CI run 40073464527 PASS: 7/7 node contract tests, TypeScript, scoped lint, Next.js production build. **Neznamená signed Auth E2E nebo concurrent RPC PASS.**

CI: https://github.com/ARTalesAdmin/ARTales/actions/runs/40073464527

Dokud nejsou hotové skutečné write/readback a souběžné testy pod přihlášenými rolemi, nedoporučujeme produkční APPLY ani deploy.
