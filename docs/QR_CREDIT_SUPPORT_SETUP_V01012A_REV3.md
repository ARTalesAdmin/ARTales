# ARTales v0.10.12a-rev — Credit top-up & support QR setup

Tento patch nahrazuje původní jednoduchý produktový QR checkout. Launch model je:

- čtenář si dobije kredit přes dynamický QR platební pokyn,
- podporovatel může poslat podporu ARTales bez fulfillmentu,
- platba se zatím ručně kontroluje v bance,
- admin fulfillment přijde v dalším patchi.

## Env proměnné

Lokálně patří do `.env.local`. Na produkci patří do Vercel → Project → Settings → Environment Variables.
Supabase env je pro tuto funkci nepotřebuje.

```bash
ARTALES_QR_ACCOUNT_NAME="ARTales"
ARTALES_QR_BANK_NAME="Název banky"
ARTALES_QR_ACCOUNT_NUMBER="123456789/0100"
ARTALES_QR_IBAN="CZ0000000000000000000000"
ARTALES_QR_BIC="XXXXXXXX"
ARTALES_QR_PAYMENT_NOTE="Kredit nebo podpora se aktivuje ručně po spárování platby."
```

`ARTALES_QR_IBAN` je pro dynamický QR kód povinný. Bez IBAN aplikace zobrazí ruční platební údaje, ale QR nevygeneruje.

## SQL

Spusť migraci:

```text
lib/supabase/migrations/2026-06-30_manual_qr_credit_support_v01012a_rev.sql
```

Rozšiřuje `order_items.product_type` o:

- `credit_topup`,
- `support`,
- `donation`.

## Launch omezení

Checkout zatím ukládá zemi zákazníka a nabízí pouze země EU. Je to záměrné dočasné omezení pro jednodušší EU/OSS launch režim.

## Důležité

Tento patch ještě nepřipisuje kredit automaticky. Vytvoří objednávku, order item a QR platební podklad. Ruční označení platby a připsání kreditu bude řešit navazující admin fulfillment patch.

## v0.10.12b — CZK QR + admin fulfillment

Navazující patch doplňuje dvě provozní pravidla:

- Pokud zákazník zvolí `Česko`, objednávka se vytvoří v `CZK` a QR kód zůstává ve formátu SPD/QR Platba, aby česká bankovní aplikace nabízela domácí platbu místo malé EUR/SEPA platby.
- Pokud zákazník zvolí jinou EU zemi, objednávka zůstává v `EUR`.

Přepočet pro české platby je řízený env proměnnou:

```bash
ARTALES_QR_CZK_CENTS_PER_EUR="2500"
```

Výchozí hodnota `2500` znamená 25 Kč za 1 EUR / 1 kredit. Pokud proměnná není nastavená, použije se právě tato konzervativní launch hodnota.

Admin fulfillment je na:

```text
/member/admin/payments
```

Doporučený provoz:

1. Zákazník vytvoří kredit nebo podporu přes QR.
2. V bance zkontroluješ přijatou platbu podle VS.
3. V `/member/admin/payments` klikneš buď:
   - `Označit jako zaplacené` — jen spárování platby bez fulfillmentu,
   - `Zaplaceno + připsat kredit` — připíše kredit do `reader_credit_ledger`,
   - `Zaplaceno + přijmout podporu` — označí podporu jako přijatou bez nároku.

Akce jsou záměrně ruční. Pozdější platební brána může používat stejná data jako automatický zdroj pravdy.

## v0.10.12c notes — storno, poznámky a lokalizace

Doporučené lokalizované poznámky pro platební obrazovku:

```bash
ARTALES_QR_PAYMENT_NOTE_CS="Kredit nebo podpora se aktivuje ručně po spárování platby."
ARTALES_QR_PAYMENT_NOTE_EN="Credit or support is activated manually after payment is matched."
```

Starší proměnná `ARTALES_QR_PAYMENT_NOTE` zůstává jako fallback, ale pro produkci je lepší používat jazykové varianty. Pokud je nastavena jen anglická fallback poznámka, bude se zobrazovat i v českém UI.

Admin plateb teď nemaže záznamy natvrdo. Používá se storno:

- neuhrazený pokyn se označí jako `cancelled` / `failed`,
- už vyřízený kredit se označí jako `refunded` a systém vloží zápornou korekci do `reader_credit_ledger`,
- stornované záznamy nejsou ve výchozím aktivním pohledu adminu a lze je zobrazit přes filtr `Storna` nebo `Vše`.

Tento přístup je bezpečnější pro audit a pozdější účetní export než fyzické mazání plateb.
