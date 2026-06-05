# ARTales Product & Access Model

ARTales separates three concepts:

1. **Product** – what can be bought, unlocked, downloaded, or requested.
2. **Entitlement** – what a reader already has access to.
3. **Purchase/order** – the future payment record that creates an entitlement.

v0.9.4 adds the product catalogue layer without payment processing.

## Product types

| Product type | Meaning | Default price |
| --- | --- | ---: |
| `online_unlock` | Permanent online reading access for one work | €1 |
| `pdf_download` | Future downloadable PDF edition | €2 |
| `epub_download` | Future downloadable EPUB edition | €2 |
| `pdf_epub_bundle` | Future PDF + EPUB bundle | €3 |
| `print` | Future print edition placeholder | varies |

## Current behaviour

Checkout is intentionally disabled in v0.9.4. Product cards are visible on work detail pages, but purchase buttons lead to `/checkout/coming-soon`.

Access is still granted through:

- welcome unlock,
- admin manual grant,
- future subscription/monthly logic,
- future purchase flow.

## Database tables

- `products`
- `product_prices`

These tables are public catalogue data. They do not grant access by themselves.

## Entitlements remain the source of truth

A reader can read a full work online only when an entitlement exists:

- `reader_entitlements.entitlement_type = 'online_read'`, or
- active Library membership entitlement.

Product rows do not bypass entitlement checks.

## Next steps

Likely follow-up versions:

- v0.9.5 – Paywall and product CTA polish.
- v0.9.6 – AT Credit spending / checkout preparation.
- v0.9.x – Orders and payment provider integration.
- v1.x – PDF/EPUB delivery and print flow.
