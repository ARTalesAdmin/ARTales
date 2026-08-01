# ARTales visual identity candidates

Tato složka je určena pro budoucí evidenci kandidátů vizuální identity ARTales.

V tomto PR se sem zatím nepřidávají žádné binární assety. Současné logo soubory z `New logo.zip` zůstávají vstupní referencí mimo repozitář, dokud nebude rozhodnuto, co se má stát kandidátem uloženým v repu a co zůstane pouze archivní referencí.

## Proč kandidáty nemažeme

Nevybraná varianta nemusí být špatná. Může být nevhodná pro hlavní logo, ale dobrá pro favicon, avatar, speciální značku, interní dokument nebo pozdější revizi.

Proto kandidát nikdy nemá zmizet jen proto, že nebyl vybrán jako primární varianta. Měl by dostat stav a důvod.

## Doporučené stavy kandidátů

- `primary_candidate` — hlavní kandidát k testování;
- `reserve_candidate` — záložní kandidát, který zůstává použitelný;
- `not_selected` — nebyl vybrán pro danou roli, ale zůstává evidovaný;
- `test_failed` — selhal v konkrétním testu, například favicon nebo mobilní header;
- `archived_reference` — historická nebo inspirační reference;
- `superseded` — nahrazeno novější verzí.

## Doporučené role

- `wordmark` — samotný nápis ARTales;
- `logo_lockup` — symbol + wordmark;
- `symbol` — samostatný mark / pero-kapka-list;
- `monogram` — AT monogram;
- `texture` — pozadí nebo atmosférický motiv;
- `social_variant` — varianta určená primárně pro sociální sítě;
- `small_size_variant` — varianta určená pro favicon, avatar nebo malé UI použití.

## Co patří do kandidátní evidence

U každého kandidáta by později mělo být jasné:

- odkud pochází;
- k jaké roli je určen;
- zda je rastrový, vektorový nebo pouze mood reference;
- zda má práva a původ vyjasněné;
- v jakém testu uspěl nebo selhal;
- proč byl vybrán, odmítnut nebo ponechán jako rezerva.

## Co zatím nepatří do této složky

- náhodné pracovní exporty;
- generativní návrhy bez původu;
- finální mastery;
- produkční exporty;
- runtime assety používané webem.

Finální mastery patří později do `brand/artales/masters/`. Generované exporty patří do `brand/artales/exports/` nebo do jiné cílové struktury popsané manifestem.
