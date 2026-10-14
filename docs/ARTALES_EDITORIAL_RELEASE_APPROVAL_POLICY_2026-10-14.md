# ARTales — redakční QA, vlastní schválení a vydání (rozhodnutí 2026-10-14)

> **Autoritativní produktový směr potvrzený Architektem; implementace čeká na samostatné bezpečnostní a vydavatelské brány.** Doplňuje `ARTALES_EDITORIAL_VISUAL_QA_STYLE_POLICY_2026-10-13.md`. Je-li starší dokument nebo E2-1 pilot v konfliktu s povinnou nezávislou kontrolou všech textů, platí pro cílový produkt toto novější rozhodnutí. Není to autorizace k produkční DB apply, nasazení, merge ani automatickému publikování. Respektovat AGENTS.md, WORKFLOW, RELEASE_POLICY.

## 1. Výchozí vlastnictví QA

Editor zodpovědný za převzaté/importované dílo (včetně Architekta při migraci existující Galerie) může **sám dokončit redakční QA a schválit dílo k publikaci**, pokud jsou všechny povinné checky zelené a vztah k dílu/identita je podepsaně ověřen. Výchozí cesta **nevyžaduje povinného druhého editora**. Po schválení nesmí být revize tiše přepsána.

Samostatnou/křížovou kontrolu vyžadovat, pokud je text **vlastním autorským dílem editora, který jej právě zpracoval**. Volitelně se zapne, když si odpovědný editor o další kontrolu výslovně požádá, u náročného či delšího díla chce pomoc nebo přetrvává nejistota, kterou neumí odborně uzavřít. Délka sama o sobě není automatická povinnost dalšího recenzenta. Neuzavřený požadavek na další kontrolu blokuje finalizaci, dokud jej nepřevezme oprávněná jiná identita; žádná předstíraná druhá osoba/fixture ve skutečném provozu.

Editorští kolegové nemají znovu redigovat díla, na kterých už pracovali, pouze proto, že se mění technický editor. Před prvními piloty se práva ostatních uživatelů nemění. První migrační pilot sám provádí Architekt.

## 2. Jednotné QA jako podmínka vydání

QA je uzamčeno ke konkrétní neměnné čtveřici:
- `text_revision_ref`,
- `visual_revision_ref` včetně skutečně **EMPTY**,
- `style_profile_version`,
- `renderer_layout_version`.

**Pravidlo vizuálů per titul:**
- `text_only`: QA je platné i bez ilustrací a bez umělého čekajícího vizuálního úkolu.
- `visuals_later`: totéž pro první textové vydání; pozdější obrazová revize má cílené obrazové QA a regresi dopadů, nikoliv zbytečné nové textové QA.
- `illustrated_together`: před vydáním musí být dokončená vybraná obrazová revize, její oprávněné použití a společné text+obraz QA.

Všechny nutné kontroly musí být pozitivní: podepsaný archivovaný zdroj a identita díla, právní způsobilost konkrétního textu a příslušných assetů, přesná QA čtveřice, dokončené textové QA, odpovídající obrazové QA, render/Reader regrese a zachování poznámek, kotev a pozic uživatelů při cutoveru. Neznámé/neprokázané právo není zelený check. Otevřené chyby, chybějící evidence a nesoulad hashů znamenají HOLD/blocked, ne „domnělé OK“.

## 3. Redakční dokončení není veřejné vydání

Cílový UX pro zelené běžné dílo může být **„Schválit a vydat“**; server jej ale rozkládá do **jedné auditované, fail-closed transakce**, která ověří aktuální QA, práva, identity, neměnný manifest a atomický release. Není to prosté přepnutí `works.status` nebo současný E2 pilot `publication_allowed=false`.

Mít nejprve režim **přímého schválení odpovědným editorem**; po úspěšném průchodu lze zavést volitelný režim **automatického schválení a publikace** pouze pro explicitně způsobilou třídu titulů, s nastaveným oprávněním, auditovaným opt-in, stejnou serverovou validací, idempotencí, rollbackem a bez obcházení práv či externího QA. Nezelený check či otevřená eskalace automatiku vždy vypne. Produkční zapnutí této automatizace vyžaduje **samostatnou autorizaci Architekta**.

Po podpisu schválení vzniká immutable release manifest. Pozdější změna textu, obrázku, stylu nebo práv je **nová revize** s novým QA a novým release rozhodnutím, nikoliv editace již publikovaného schválení.

## 4. Dopad na E2-1 PR #243

Dosavadní podepsaná E2-1 syntetika „admin autor -> druhý admin schvalovatel“ je **platný negativní a volitelný dvoučlenný scénář, nikoli požadavek na každý titul**. Cílový pilot musí prokázat také **samoobslužný redakční podpis Architekta** na běžném importovaném zdroji (bez veřejné publikace), a dále odmítnutí vlastní kontroly u skutečného autorského/editor-original díla nebo explicitně vyžádané křížové kontroly. Tato klasifikace musí pocházet z věrohodných trvalých dat, ne z klientem změnitelného checkboxu.

Až existují textové, obrazové, rights a Reader podklady, připojit skutečný authoring UI / podpis QA / publication eligibility / server release. Dnešní PR nepřenáší žádné publikování do produkce. Neuvádět `self-review forbidden` jako univerzální produktové pravidlo; jen jako pravidlo pro režim `independent_required`.

## 5. Akceptace

1. Importovaný text, `text_only`, všechny checky zelené -> přiřazený editor sám může schválit publikaci; druhý editor není potřeba.
2. Importovaný text, `illustrated_together`, chybí práva či QA obrazu -> vydání blokováno.
3. `visuals_later`, bez ilustrací -> nevzniká falešný obrazový blocker; dodání obrázku vyvolá cílené QA.
4. Editorovo autorské dílo -> vlastní podpis jako jediná kontrola nestačí, nutná nezávislá podepsaná kontrola.
5. Editor požádal o druhou kontrolu -> blokovat dokončení do uzavření požadavku jinou oprávněnou identitou.
6. Nevyřešený legal HOLD / QA issue / poškozený otisk / Reader mapping -> žádné vydání, žádné auto.
7. Stále zelené, pinované QA + explicitní opt-in auto -> teprve **kandidát** pro automatický release, ne aktivace automatického zveřejnění.
8. Po schválení nová změna -> nový manifest a nové QA, starý release immutable a rollbackovatelný.

**Riziko:** vysoké pro budoucí DB/Release, nízké pro samotný tento dokument. **Cíl:** develop first. **DB:** no (dokument). **Env:** no. **Rollback:** revert dokumentační commit; runtime beze změn.
