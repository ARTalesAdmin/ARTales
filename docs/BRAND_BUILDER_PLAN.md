# Brand Builder Lite: plán pro ARTales

## Účel

Brand Builder je lehký, opakovatelný interní postup pro převod **schválených brandových masterů** do technických výstupů. Má udržet loga, barvy a exporty konzistentní, dohledatelné a verzované. První praktický případ je stabilizace značky ARTales.

ARTales má působit jako klidný kulturní prostor — **Galerie příběhů** — nikoli jako technologický dashboard, masový e-shop nebo hlučný SaaS. Technologie slouží kultuře; není hlavním příběhem.

## Co Brand Builder není

- není generátor nové identity;
- není nástroj pro kreativní překreslování schváleného loga;
- není zatím plné Syrael UI ani univerzální produkt;
- není důvod k redesignu všech stránek najednou;
- nenahrazuje lidské schválení masterů ani kontrolu výsledných exportů.

## Zásada bez generativního driftu

Po schválení masteru se jeho tvar, proporce, význam ani barevnost kreativně nereinterpretují. Brand Builder smí provádět pouze předem definované převody: změnu formátu a velikosti, bezpečné ořezy, variantu pro schválené pozadí a technickou optimalizaci. Každý výstup musí odkazovat na konkrétní verzi vstupu a pravidlo exportu. Změna masteru vytváří novou verzi; tiše nepřepisuje původní zdroj.

## Brand Builder Lite pro ARTales

První verze bude dokumentovaná struktura a řízený proces. Skript nebo malý nástroj může vzniknout až ve chvíli, kdy jsou vstupy, názvy, rozměry a očekávané výstupy ověřené ručním použitím.

Doporučené pořadí:

1. potvrdit finální ARTales wordmark, symbol/monogram, hlavní logo a paletu;
2. uložit neměnné mastery s verzí a vlastníkem schválení;
3. definovat exportní profily a pravidla pro světlé, tmavé a transparentní pozadí;
4. vytvořit ARTales brand pack, tokeny a manifest;
5. vizuálně a technicky zkontrolovat všechny výstupy;
6. používat pack při postupné tokenizaci a zjednodušování veřejného vizuálního systému;
7. teprve po ověření v ARTales vyhodnotit obecnější řešení pro Syrael/Nexus.

Editor a admin nejsou první cíl vizuálního refaktoru. Přednost má kontrolovaný základ veřejné značky.

## Vstupy

Povinné nebo podporované vstupy:

- název značky, verze a základní metadata;
- schválený wordmark;
- schválený symbol, mark nebo monogram;
- schválené hlavní logo;
- schválená barevná paleta;
- pravidla použití na světlém a tmavém pozadí;
- volitelné typografické a uživatelské poznámky.

Každý vstup má mít stabilní identifikátor, verzi, datum schválení, formát zdroje a stav schválení. Do produkčních exportů smějí vstoupit jen schválené mastery.

## Výstupy

Podle schválených exportních profilů může Brand Builder připravit:

- varianty loga pro světlé, tmavé a transparentní pozadí;
- favicon soubory;
- webové a aplikační ikony;
- avatary pro sociální sítě;
- watermarky;
- SVG, PNG a WebP exporty podle skutečné potřeby;
- CSS/aplikační barevné tokeny;
- stručný brand sheet;
- asset manifest.

Nevytváří se všechny možné varianty „pro jistotu“. Každý soubor musí mít známé použití. Zlatá je akcent, nikoli plošná dekorace.

## Asset manifest

Manifest je strojově čitelný seznam schválených výstupů a jejich původu. Může být JSON nebo jiný jednoduchý verzovaný formát. Pro každý asset má evidovat alespoň:

- jednoznačné ID a verzi brand packu;
- cestu k souboru a formát;
- typ varianty a zamýšlené použití;
- zdrojový master a jeho verzi;
- rozměry, poměr stran a případně barevný prostor;
- vhodné pozadí (`light`, `dark`, `transparent`);
- hash/checksum pro kontrolu změny;
- stav schválení a datum exportu;
- exportní pravidlo nebo verzi nástroje.

Manifest umožní odhalit náhodně přidané či zastaralé assety a později bezpečně automatizovat kontrolu. Samotný manifest nesmí obsahovat tajné údaje.

## Pravidla pro navazující vizuální práci

- Nejdříve systém, potom jednotlivé stránky.
- Používat tokeny a znovupoužitelné komponenty místo ad hoc hex barev a jednorázových efektů.
- Inline styly ponechat jen pro skutečně dynamické hodnoty.
- Nepřidávat náhodné rastrové assety bez záznamu v manifestu a pravidel použití.
- Hlídát prostor, čitelnou typografii, klidný kontrast a přístupnost.
- Veřejný tón má být klidný, literární, konkrétní, důvěryhodný a zaměřený na čtenáře. Budoucí možnosti se nesmějí prezentovat jako současné funkce.

## Podmínka pro Syrael/Nexus

Abstrakce do Syrael/Nexus začne až poté, co ARTales brand pack projde reálným použitím a prokáže, že vstupy, exportní profily, tokeny i manifest fungují. Teprve z konkrétních opakovaných potřeb se oddělí obecná pravidla. ARTales se nemá přizpůsobovat předčasně navrženému univerzálnímu nástroji.
