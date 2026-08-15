# Reader Phase 4 — synchronizované Poznámky

## Rozsah a rozhodnutí auditu

Phase 4 nahrazuje hlavní uživatelský koncept jedné záložky funkcí **Poznámky**: v Readeru lze přidat více prostých poznámek, zobrazit jejich seznam, přejít na uloženou pozici a odstranit právě jednu poznámku. Rich text, editace a mezidílový zápisník nejsou součástí MVP.

Repozitář používá serverový Supabase klient s cookies a ověřuje identitu přes `auth.getUser()`. Má vlastní nedestruktivní SQL migrace a RLS policies. Reader dosud znal pouze anonymní localStorage a starý klíč jedné záložky; profilová čtenářská nastavení nejsou vhodná pro kolekci samostatných záznamů. Reader proto získává úzce vymezený `/api/reader/notes` endpoint, který znovu ověří uživatele, a novou tabulku s RLS. Synchronizované MVP je bezpečné v jednom PR; není důvod dělit ho na lokální a vzdálenou část.

## Data, Supabase a bezpečnost

`reader_notes` ukládá ID, `user_id`, stabilní aktuální identitu díla `work_slug`, volitelný titulek a tělo, barvu, procento postupu, scroll/page pozici, počet stran, layout a timestamps. RLS povoluje select/insert/update/delete výhradně tam, kde `auth.uid() = user_id`. API nepoužívá service role, při každé operaci ověřuje přihlášeného uživatele a filtruje čtení i mazání jeho ID.

Migrace `2026-08-14_reader_synced_notes_phase4.sql` je aditivní. Po nasazení schématu lze nasadit kód. Produkční aplikace migrace vyžaduje samostatné výslovné potvrzení; tento PR míří pouze do `develop`.

## Lokální fallback a import

- Settings, progress, bookmark a savedWorks klíče se nemažou ani nepřepisují.
- Nová cache/fallback kolekce používá `artales.reader.notes:<slug>`.
- Existující `artales.reader.bookmark:<slug>` se jednou převede na `Původní poznámka` / `Imported note` se zachovanou pozicí. Dokončení importu se zapisuje do samostatného markeru `artales.reader.notesLegacyImported:<slug>`, takže změna zdroje na `synced` ani další reload import nezopakují. Starý klíč zůstává jako záloha.
- Anonymní a síťově nedostupný Reader ukládá lokálně a ukazuje „Pouze v tomto zařízení“. Po přihlášení se lokální záznamy nejprve upsertují a až potom se cache nahradí odpovědí serveru.
- Remote delete proběhne před odstraněním z lokální cache; neúspěch poznámku skrytě neztratí.

## UI, navigace, mobil a přístupnost

Kompaktní menu obsahuje popsaný formulář pro titulek, text a barvu a rolovací seznam aktuálního díla. Prázdný titulek i text vytvoří poziční poznámku pojmenovanou podle strany. Ovládací prvky jsou keyboard accessible, delete identifikuje konkrétní poznámku a zavřené menu/formulář nejsou v tab pořadí.

Přechod preferuje `pageIndex`; spread jej zarovná na obsahující dvoustranu a pagedFlow posune odpovídající list. Starší záznam spadne na `progressPercent` a nakonec `scrollY`. Parser ani algoritmus řezání stran se nemění. Panel má omezenou výšku/šířku, zalamování a vnitřní scroll pro telefon.

## Omezení

Synchronizace je reload/open based, nikoli realtime. Editace existujícího textu a cross-work dashboard nejsou součástí Phase 4. Offline záznam se nahraje při příštím otevření Readeru s platnou session a sítí.

Reader navíc opakuje synchronizaci při návratu prohlížeče online a při návratu viditelné karty. Nová lokální poznámka spustí pokus o synchronizaci vždy, když je prohlížeč online, i když předchozí pokus skončil lokálním fallbackem. Neúspěšný pokus nikdy nenahrazuje ani nemaže lokální kolekci a nevyžaduje reload.

## Preview checklist

- Otevřít pagedFlow i spread; ověřit restore a go-to-page beze změny.
- Přidat více poznámek (také prázdnou), ověřit title/body/barvu a reload.
- Přejít na poznámku v obou layoutech a smazat jen jednu.
- Nasimulovat starý bookmark, provést sync a několik reloadů; ověřit právě jeden import bez smazání starého klíče.
- Vytvořit poznámku offline, obnovit připojení bez reloadu a ověřit její automatické nahrání.
- Ověřit přihlášenou synchronizaci desktop → telefon po reloadu/otevření Readeru.
- RLS ověřit dvěma účty; cizí operace nesmí zpřístupnit řádky.
- Ověřit klávesnici, Escape/outside click, telefon a žádný overflow.
- Ověřit Phase 3 preferences a nezměněný parser/page slicing.

## Rollback a verze

Nejprve revertovat runtime commit/PR; lokální klíče a serverová data ponechat pro obnovu. Aditivní tabulku není nutné dropovat a destruktivní down migrace se nemá spouštět. Cleanup vyžaduje samostatné schválení. `public/version.json` se v develop PR nemění; až schválená promoce develop → main musí marker zvýšit podle hlavního release protokolu.

## Phase 4 UX polish follow-up

Develop-first polish adds visible page-margin note markers and previous/current/next note navigation, with a collapsible full list. Sync, storage, API and RLS architecture are unchanged. See `ARTALES_READER_NOTES_MARKERS_NAVIGATION_POLISH_V0_1.md`.
