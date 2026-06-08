# ARTales product delivery next notes

This note records product-direction decisions that are intentionally not implemented in v0.10.0.

## Product order

Recommended order after product-surface cleanup:

1. Reader page mode foundation.
2. Dual-page / book-spread reader mode.
3. Official PDF renderer prototype.
4. Admin PDF preview.
5. Generate official PDF/EPUB files into storage.
6. Entitlement-gated download delivery.
7. Optional custom reader exports later.

The first downloadable PDF/EPUB product should be an official ARTales edition file stored in project storage, not a fresh render on every user download.

## Images / covers / inline media

The current cover image fields are useful, but ARTales still needs a deliberate media pipeline decision:

- Supabase Storage bucket for covers and future inline images, or
- external Drive/source import with later normalization into storage, or
- hybrid import first, storage as canonical delivery later.

Future media work should cover:

- upload/attach from member editor UI,
- cover image selection,
- inline image block support,
- alt/caption fields,
- storage paths and cleanup rules,
- public delivery URLs or signed URL strategy.

## Bilingual metadata

Before translating full works, ARTales should support localized metadata for at least:

- authors,
- collections,
- possibly work title/subtitle/summary/preview metadata.

A likely direction is either explicit fields such as `bio_en` / `bio_cs`, or a structured translation table keyed by entity, field and locale. The translation-table approach is more scalable for future languages, but needs a cleaner editor UI.

Full work text translation can wait. The platform UI, author/collection metadata and product surfaces can become bilingual first.
