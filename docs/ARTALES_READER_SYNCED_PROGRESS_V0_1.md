# Reader synced progress v0.1

## Rozsah a cíl

Tato develop-first změna synchronizuje pozici ve full Readeru přihlášeného
uživatele přes Supabase, aby bylo možné pokračovat na jiném zařízení. Zachovává
stávající lokální klíč `artales.reader.progress:<slug>` jako první vrstvu a
offline/error fallback. Nemění parser, slicing, obsahový model, Reader access,
Poznámky, preferences ani UI Moje knihovna.

## Datový model

Nová tabulka `public.reader_progress` má jeden řádek pro dvojici
`(user_id, work_slug)`. Ukládá režim, procento, scroll/page pozici, počet stran,
layout a klientský `updated_at`; `created_at` vzniká v DB. Kontroly omezují
procento na 0–100, nezáporné page hodnoty a layout na `pagedFlow`, `spread`,
`scroll` nebo `page`. Vazba na `auth.users` používá `on delete cascade`.

## API a latest-wins

`GET /api/reader/progress?slug=…` vrací pro anonymní session
`signedIn: false`; přihlášenému vrací pouze jeho řádek. `POST` validuje slug,
číselné hodnoty, layout a timestamp, user id vždy převezme z ověřené serverové
Supabase session. Starší příchozí zápis je odmítnut jako stale.

Při otevření full Readeru klient:

1. načte a validuje lokální záznam,
2. vyžádá remote záznam,
3. porovná validní `updatedAt`,
4. obnoví novější záznam a vítěze zapíše lokálně,
5. pokud vyhrál local, pošle jej přihlášenému online uživateli na server.

Stejné porovnání se spouští při návratu online a při zviditelnění dokumentu.
Realtime není součástí MVP.

## RLS a bezpečnost

RLS policies dovolují `select`, `insert`, `update` a `delete` pouze pokud
`auth.uid() = user_id`. Role `anon` nemá oprávnění k tabulce; `authenticated`
má jen potřebné CRUD operace. API nepřijímá klientské `user_id` a dotazy navíc
explicitně filtruje přihlášeného vlastníka.

Progress je soukromý signál historie čtení. Neuděluje entitlement, neotevírá
full Reader a nenahrazuje existující access rozhodnutí. Endpoint nevrací obsah
díla.

## Local fallback a ochrana proti race

Lokální záznam se nemaže a lokální zápis zůstává primární reakcí na pohyb v
Readeru. Při offline stavu, 401 nebo remote chybě Reader pokračuje z localStorage
a data nepřepisuje prázdným serverovým stavem. Poznámky, bookmarks a settings se
nečistí ani nemigrují.

`progressRestoreReady` zůstává zavřené po dobu počátečního local/remote
porovnání. Inicializační strana 1 se proto neuloží ani neodešle před restore.
Obnovení navíc potlačí jeden následný poziční zápis, aby timestamp vítězného
záznamu nebyl nahrazen pouhým renderem.

## Non-goals a Moje knihovna

Tento PR nemění access/entitlement logiku ani Moje knihovna UI. Zejména účet s
all-access nesmí později automaticky zaplnit knihovnu všemi čitelnými díly.
Budoucí hub má ukazovat pouze díla s progress, explicitním uložením, explicitním
unlockem nebo poznámkou. Samotný progress není permanentní unlock.

## Develop preview checklist

- [ ] Anonymous local progress se stále obnoví.
- [ ] Přihlášený local progress se nahraje.
- [ ] Remote progress se obnoví v jiném browseru/zařízení.
- [ ] Novější local porazí starší remote a naopak.
- [ ] Offline čtení zachová local; reconnect/open nahraje novější local.
- [ ] Strana 1 nepřepíše obnovenou pozici.
- [ ] Restore funguje v `pagedFlow` i `spread`.
- [ ] Poznámky a account preferences dále fungují.
- [ ] Uživatel A nemůže číst ani zapisovat progress uživatele B.
- [ ] Progress neobchází Reader access logiku.
- [ ] Žádný localStorage klíč se nemaže.
- [ ] Parser, slicing, payments, package, env a brand zůstaly beze změny.

## Nasazení a rollback

Riziko je **high** (Reader, autentizovaná API cesta a aditivní DB migrace), cíl
je **develop first**, DB **yes**, Env **no**. Pro preview se nejprve aplikuje
aditivní migrace a potom nasadí runtime; stávající lokální chování je zpětně
kompatibilní.

Při rollbacku se nejprve revertuje runtime/API commit a ověří lokální restore.
Tabulka se ponechá s RLS i daty; její drop není součástí běžného rollbacku a
vyžadoval by samostatné výslovné schválení a zálohu. Nejsou zde destruktivní
migrační kroky ani nové environment variables.
