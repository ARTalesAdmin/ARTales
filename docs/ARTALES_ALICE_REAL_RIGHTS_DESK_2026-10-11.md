# Alice / Project Gutenberg #11 — skutečný předběžný právní dossier

Datum: 2026-10-11. Území: ČR/EU. Rozsah: **pouze původní anglický literární text** z konkrétního připnutého digitálního souboru. Toto není externí právní stanovisko ani oprávnění k publikaci.

## Zachycený zdroj
- Archivní soubor: `tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt`, přesný SHA-256 `49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094` (173595 bajtů).
- Upstream: `https://raw.githubusercontent.com/GITenberg/Alice-s-Adventures-in-Wonderland_11/7f18748e114b994d5d9454d5793581bc0b9cf9d7/11-0.txt`.
- Metadatový nadpis uvádí „The Millennium Fulcrum Edition 3.0“ a aktualizaci 6. 10. 2016. Neprohlašovat edition metadata za totožná s Carrollovým originálem.
- Programová kontrola opětovně ověřuje přesné bajty, komponentové hranice a jejich samostatné hashe; negarantuje právní pravdivost tvrzení třetích stran.

## Předběžné právní nálezy
- Carroll (Charles Lutwidge Dodgson) zemřel 1898. Obvyklé majetkové období dle § 27 českého AZ je život + 70 let, počítané od následujícího roku. Původní text je od 1. 1. 1969 mimo dobu majetkové ochrany v ČR. Toto zjištění se **nevztahuje automaticky** na pozdější překlady, editorská tvůrčí doplnění či soubory ilustrací.
- Nezahrnovat Gutenberg header, post-text licenci ani případné další ochranné známky do našeho literárního obsahu. Dál dokumentovat zdroj a označení originálního autora; nepoužívat označení Gutenberg způsobem naznačujícím partnerství.
- Digitální edice „Millennium Fulcrum Edition 3.0“ může obsahovat vydavatelská zpracování; jejich původ a tvůrčí přínos zatím nebyly nezávisle doloženy. Příslušné vydavatelské úseky vyřadit z ingestu, u vlastního literárního textu před zveřejněním potvrdit, zda nepřevzal chráněné novější tvůrčí zásahy.
- Tento připnutý text nemá inkorporované obrázky jako samostatná binární díla. Externí GITenberg obálka ani jiná vydání s Tennielovými ilustracemi nejsou součástí tohoto text-only capture; bez samostatného důkazu je nesmíme přidat.
- České překlady jsou samostatná díla. V anglickém pinned text-only snapshotu nebyla identifikována přeložená edice; případná pozdější česká mutace musí absolvovat vlastní právní kontrolu.

## Evidence a stav jednotlivých komponent
`inspectRealAliceRights(bytes)` sestaví přesný manifest: head-wrapper EXCLUDE, ediční úvod EXCLUDE, WORK_CONTENT HOLD (pending independent edition/source rights corroboration), ediční závěr EXCLUDE, Gutenberg licence EXCLUDE, externí obraz EXCLUDE (nezachycen). Výstup `evaluateRightsScan`: `needs_specialist_review`, `includedSnapshotIds=[]`, `publicationAuthorized=false`. Tento HOLD není konstatováním, že je Carrollův text stále chráněn; jde o chybějící nezávislé potvrzení konkrétní digitální edice a externě archivované evidence.

## Primární veřejné odkazy (referenční, zatím NE archivované jako evidenční soubory)
- https://www.gutenberg.org/ebooks/11 (katalog)
- https://www.gutenberg.org/policy/license (licence a ochranné známky)
- https://www.gutenberg.org/policy/permission.html (varování ohledně mimoamerických jurisdikcí)
- https://www.zakonyprolidi.cz/cs/2000-121 (autorský zákon, § 27 a § 11 odst. 5)
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0116 (směrnice 2006/116/ES, čl. 1)
- https://www.gutenberg.org/ebooks/114 (samostatné ilustrované vydání, NE součást capture)

## Před release
1. Nezávisle zaznamenat a archivovat datum/obsah citovaných právních pramenů a katalogových metadat. Uložit SHA-256 každého důkazu a spojit jej s konkrétní komponentou/edicí.
2. Ověřit ediční provenienci a případná autorskoprávně relevantní nová tvůrčí doplnění uvnitř textového úseku. Potvrdit rozsah vynechaného edičního materiálu.
3. Získat lidský právní verdict nad přesným snapshotem, oddělit `text-only eligible` od `publication approved`; podpis/schválení musí být nezávislé na automatickém scanneru.
4. Nepřenášet tento dokument ani fixture do produkční DB jako autorizaci ingestu nebo vydání.

Risk medium (legal assessment; no runtime change). Target develop first. DB no. Env no. Rollback revert report PR. Test checklist pinned SHA, boundaries, full 12 chapters, separate component hashes, negative mutation, CI. Zbývá nezávislá lidská kontrola vydání.
