-- ARTales v0.10.12a-rev
-- Manual QR credit top-up / support foundation.
-- Allows order_items to represent credit top-ups and donations/support payments.

alter table if exists public.order_items
  drop constraint if exists order_items_product_type_check;

alter table if exists public.order_items
  add constraint order_items_product_type_check
  check (
    product_type = any (
      array[
        'online_unlock'::text,
        'pdf_download'::text,
        'epub_download'::text,
        'pdf_epub_bundle'::text,
        'print'::text,
        'membership'::text,
        'credit_topup'::text,
        'support'::text,
        'donation'::text
      ]
    )
  );
