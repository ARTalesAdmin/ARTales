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
