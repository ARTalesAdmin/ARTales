# ARTales — pravidla redakčních revizí, ilustrací, QA a výchozích stylů (návrh v1, 13. 10. 2026)

> **Stav:** odsouhlasený produktový směr z rozhovoru s architektem po živém demo-testu Alenky s editory. **Není to implementace ani oprávnění k DB apply, produkčnímu nasazení či změně Readeru.** Konkrétní datový kontrakt, API, migrace, vizuální návrhy a testy musí projít vlastním PR. Autoritativní zůstávají AGENTS.md, WORKFLOW, RELEASE_POLICY, skutečný kód a výslovné autorizace.

## 1. Základní invarianta

Jedno schválené vydání knihy = neměnná **textová revize** + neměnná **obrazová revize** (smí být prázdná) + identifikovaná **verze redakčního stylového profilu** + výsledek QA. Dílčí změna obrazu či typografie nesmí přepisovat schválený zdrojový text. Uchovat work_id, slug, čtenářské kotvy, staré pozice a rollback. Je-li obrazová vrstva prázdná, vydání je plnohodnotné a publikovatelné za ostatních splněných podmínek.

Zdrojový Gutenberg text a ilustrace se archivují nezávisle. Zdrojový obraz není automaticky obrazem vydávaným. Obálka je **vždy vlastní ARTales**. Ivana rozhoduje o obrazové podobě jednotlivých knih a může zvolit rekreaci, vlastní ilustraci, původní legálně použitelnou ilustraci nebo vynechání. **Pouhá drobná změna chráněného obrazu sama nezaručuje nová či volná práva;** právní kontrola zdroje a finálního assetu jsou oddělené. Pokud ke zdrojovému souboru nelze oprávněně přistupovat nebo jej rozmnožovat, ponechat pouze zákonně dostupná metadata a nesdělovat jej generativním službám bez oprávnění.

## 2. Obrazová politika je *per titul* a měnitelná

Každý titul má explicitní obrazovou politiku (název v modelu pouze pracovní):
- **text_only** — výchozí bezilustrační vydání, žádná povinná čekající vizuální úloha, zachovají se zdrojové image sloty; lze později vyvolat obrazovou revizi.
- **illustrated_together** — vlastní nebo povolené ilustrace budou schválené před závěrečným vydáním; součástí **jednoho společného QA text + obraz**. Pokud se obrazová práce protáhne, kompetentní role může politiku změnit na text_only nebo visuals_later.
- **visuals_later** — text lze schválit a vydat bez čekání na obrázky; následná obrazová revize spustí **cílenou obrazovou QA**. Nevytváří automaticky opětovné ruční schvalování celé knihy.

Politika je rozhodnutí na úrovni díla/vydání, nikoli globální příkaz všem knihám. Změna politiky je auditovaná a nesmí přepsat schválené revize. Nepublikovaná či zatím nevybraná ilustrace nebrání textovému vydání, pokud platí text_only nebo visuals_later.

## 3. Jedna QA, pokud práce skončí společně

- Před prvním vydáním vytvořit jeden QA záznam nad přesnou kombinací: text_revision_ref, visual_revision_ref (vč. EMPTY), style_profile_version, renderer_layout_algorithm_version.
- U illustrated_together textovou a obrazovou práci vést podle potřeby paralelně. Po dokončení obou složek proběhne **jediné redakční společné závěrečné QA**, pokud už není hotové jiné požadované právní či vydavatelské ověření.
- U text_only první QA pokrývá text a Reader bez obrázků. Neznamená čekání na Ivanu.
- U visuals_later publikovaná textová revize zůstává. Nové/nahrazené obrázky mají vlastní QA: práva finálních assetů, schválení Ivany, kotvy, alternativní texty, poměr stran, zobrazovací profily, rozložení dotčených stran a automatická regrese celé projekce. **Pouze dopadem dotčené části** vyžadují ruční kontrolu. Pokud nová ilustrace výrazně přesune obsah či zneplatní kotvy/poznámky, eskalovat na širší QA, nikoliv automaticky tvrdit, že lokální kontrola stačí.
- Ani kompletní dokončení artworku před textem nesmí obejít společné QA; má jen odstranit potřebu druhého následného QA.
- Po schválení vytvořit nový immutable release manifest, nikdy nepřepisovat již schválený manifest. Vydání/přepnutí Readeru nadále vyžaduje samostatný autorizovaný atomický krok.

## 4. Editorská poznámka: zachovat funkci současného editoru

Současný legacy editor má:
- typ bloku **note** = *veřejná vysvětlující poznámka v textu*, čtenář ji může vidět;
- pole **editor_note** u WorkBlock = *interní redakční komentář k bloku*, nepatří do publikovaného textu;
- samostatný typ **footnote** pro poznámky pod čarou.
Nový Semantic v2 nyní má footnote, ale ne plnou náhradu editor_note ani všech legacy variant note. Při migraci nesmí žádná ze tří funkcí zmizet.

V editoru lze interní poznámku zobrazit jako poznámkovou kartu či „blok“ u konkrétního sémantického bloku nebo atomu; **v datové vrstvě jde o redakční anotaci s identitou, autorem, stavem a kotvou**, oddělenou od zdrojového textového atomu, bez vlivu na čtenářskou paginaci a bez publikace. Veřejné note/footnote zůstanou obsahovými prvky, zachová se pořadí, vazba na text a výchozí vzhled legacy editoru. Převod legacy note a editor_note musí mít explicitní mapování a regresní testy, žádné zahazování.

## 5. Semantická oprava bloku při živé redakční práci

- Editor popíše změnu významu/stylu bloku. Systém nabídne opravený blok a **okamžitý lokální náhled**, ale autoritativní data se mění až po uložení podepsané revize.
- Uložení vytváří novou immutable textovou revizi s rodičovským ref, auditní historií a kontrolou zdrojového ukotvení. Redakční anotace se zachovají.
- Notifikovat při předání, vrácení, schválení a případně významném uložení, ne při každém stisku klávesy/změně preview. Pravidlo konkrétních adresátů ještě upřesnit.
- **Třetí panel zobrazující skutečný Reader render** je zatím **otevřený UX návrh**, ne povinná součást. Pokud se použije při bootstrapu, read-only a bez paralelního zdroje pravdy. Starý Reader zůstává pro nepřevedená díla, nový náhled využívá tentýž schválený manifest či lokální draft.

## 6. Výchozí formátování zdědit z existujícího ARTales, nikoli znovu vymýšlet

- Jako baseline použít současné bloky a výchozí formáty (lib/blocks.ts, lib/rendering/blockFormats.ts, components/work/work-content-renderer.css a relevantní Reader CSS). Neztratit typy a jejich formátovací smysl (kapitola, odstavec, citace, báseň, dopis, poznámka, footnote, tabulka, obraz atd.). Nový model má InlineMark: italic, bold, indent atd. a SemanticBlockPresentation: align, indent a mezery; přenos je třeba ověřit po typech, ne předpokládat úplnou kompatibilitu.
- Profil ARTales **verzovat**: např. global_style:v1; nový titul zdědí jeho výchozí pravidla. Titul může mít **lokální override** u celého typu bloku nebo u konkrétního bloku. Zachovat původní tučné/kurzívní značky textu (sémantický význam), pokud jsou součástí povoleného zdroje.
- Každé schválené vydání **připne konkrétní stylovou verzi a lokální rozdíly**. Nejde o dynamickou referenci na „nejnovější globální styl“. Změna globálního profilu nesmí bez souhlasu automaticky měnit již schválené knihy, jinak by vznikly nevyžádané desítky až stovky QA.
- Běžný editor mění vzhled svého díla lokálně. Návrh změnit globální pravidlo eskalovat architektovi s typem změny, ukázkami před/po, identifikací dopadů a rozsahem možných kontrol. **Výchozí volba: jen nové tituly.** Volitelné aplikování na vybrané knihy; hromadná migrace pouze s explicitním souhlasem a předběžnou automatizovanou regresí.
- **Čtenářské uživatelské preference** (velikost písma, zařízení, světlý/tmavý režim) jsou samostatná vrstva a nemění obsahovou ani stylovou revizi. Lokální přepočet paginace a předpočítané layout presety jsou možné bez AI či nové redakční QA.

## 7. Minimální integrační entity (koncept, ne SQL migrace)

| Objekt | Klíčové vazby | Pravidlo |
| --- | --- | --- |
| WorkEditorialPolicy | work_id, illustration_mode, effective_revision | Obrazy nejsou povinné; změna po schválení zakládá nový revizní krok |
| TextRevision | work_id, parent_ref, source_ref, notes_ref, style_profile_ref | Immutable po Save; interní poznámky nezveřejňovat |
| IllustrationSlot | work_id, source_image_snapshot_ref, source_atom_anchor | Původní místo obrazu existuje i při omit |
| VisualRevision | work_id, parent_ref, selected_asset_refs a placement_refs nebo EMPTY | Vlastní ARTales image je oddělený od původního zdroje |
| StyleProfile | profile_id, version, block defaults, overrides | Pinned per vydání; změny pouze opt-in zpětně |
| QaApproval | work_id, text_ref, visual_ref, style_ref, layout_version, scope | Dokládá přesně testovanou kombinaci, ne generický „OK“ |

*Nezavádět další velký paralelní stavový systém, pokud lze kontrakt navázat na stávající editorial task, semantic revision a release gate.* Právní způsobilost textu zůstává nezávislá na výběru finální obrazové vrstvy. Technické publikování, oprávnění editorů a poznámky čtenářů jsou chráněné samostatnými branami.

## 8. Akceptační scénáře pro další implementaci

1. Alice bez ilustrací: text schválen, visual EMPTY, jedno QA, následný bezpečný per-work Reader cutover. Image sloty zůstávají archivně známé.
2. Alice s dokončenými vlastními ilustracemi: text a artwork paralelně, **jedno** společné QA, žádná duplicitní textová revize.
3. Alice text-only již publikovaná, Ivana dodá obrázek: nová visual revize a cílené QA dopadu + automatická regrese celé čtečky, původní poznámky a text beze změn.
4. Chráněný/nejasný obrázek: žádné veřejné zveřejnění zdroje, možnost omit/custom podle práv; textový release zůstává způsobilý.
5. Interní editor_note se po uložení/vrácení zobrazí editorovi; nikdy neunikne do Readeru ani snapshotu veřejného vydání. Veřejné note/footnote se správně renderují.
6. Změna lokálního odsazení/kurzívy mění jen jednu knihu. Globální změna stylu v2 **nezmění** žádnou již schválenou knihu bez opt-in; ukáže architektovi rozsah dopadu a případné QA.
7. Výběr obrázku nebo změna velikosti písma nesmí spouštět AI reinterpretaci textu; čtenářské kotvy/progress zůstávají mapovatelné.
8. Veřejný Reader funguje starým způsobem pro nepřevedené tituly; třetí panel, pokud bude vybrán, zůstává read-only QA náhled.

## 9. Pořadí implementace a odklady

**První prioritou nadále je skutečný bezpečný Alice E2:** signed DB draft Save -> reload -> komentář/return -> editor approve, s reálnou admin/editor relací a Reader projekcí. Teprve pak doplnit menší datový kontrakt pro policy + notes + style version + illustration slot; nepřidávat zbytečné UX příslušenství před ověřením transakce. Artwork zůstává paralelní, skutečný binární ingest je oddělený úkol (PR #237 Draft).

**Není rozhodnuto:** povinný třetí panel, přesná notifikační politika, grafické UI Ivany, rozsah bezpečných automatických regresí u masové změny stylu, konkrétní SQL migrace a schvalovací oprávnění v již existujícím editorial workflow. Tyto položky nezaměňovat za dokončenou implementaci.

## 10. Zdrojové reference

- Legacy: lib/blocks.ts (note / footnote / editor_note), components/editor/WorkBlocksEditor.tsx, lib/rendering/blockFormats.ts, components/work/work-content-renderer.css.
- Semantic: lib/semantic/model.ts, lib/semantic/compose.ts, lib/semantic/readerProjection.ts, lib/semantic/layoutPresets.ts.
- Obrázky: lib/ingest/illustrationSnapshot.ts, illustrationPlacement.ts, illustrationArchiveChoice.ts, illustrationStorageAdapter.ts.
- Release: lib/publication/readerCutoverDryRun.ts, readerRevisionRouting.ts, galleryMigrationPlan.ts.
- Předchozí Phoenix: docs/ARTALES_PHOENIX_2026-10-12_ARTWORK_INGEST.md.
