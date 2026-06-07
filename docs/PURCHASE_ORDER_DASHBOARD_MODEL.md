# ARTales v0.9.6 – Purchase / Orders / Dashboard foundation

This layer prepares the business/accounting flow before real payments are enabled.

## Core model

```txt
product = what can be bought or unlocked
purchase_intent = user clicked / showed interest before checkout is active
order = future commercial transaction
order_item = product line inside an order
entitlement = actual reader access granted after payment/manual grant/welcome unlock
```

## Tables

### `purchase_intents`

Captures interest when a user clicks a product CTA while checkout is still disabled.

Used for:

```txt
which products attract interest
which works readers try to buy
which CTA should be prioritized
```

### `orders`

Prepared for real checkout providers later.

Statuses:

```txt
draft
pending_payment
paid
failed
cancelled
refunded
fulfilled
```

### `order_items`

Prepared for fulfilment logic.

Examples:

```txt
online_unlock -> grants online_read entitlement
pdf_download -> grants pdf_download entitlement
pdf_epub_bundle -> grants PDF + EPUB entitlements
print -> manual/print fulfilment
```

### `page_views`

Lightweight internal analytics table. It stores page path, session id, optional user id, referrer and user agent. It does not store IP addresses.

## Admin dashboard

Route:

```txt
/member/admin/dashboard
```

Admin only.

Shows:

```txt
visits
accounts by role
purchase intents
orders
paid orders
payments received
product counts
active entitlements
```

Ranges:

```txt
this month
all time
```

CSV export:

```txt
/member/admin/dashboard/export?range=month
/member/admin/dashboard/export?range=all
```

## Not implemented yet

```txt
Stripe / payment provider
real payment sessions
order history for readers
invoices
automatic fulfilment after payment
income/outcome ledger
worker compensation / production cost accounting
```

These belong to later versions.
