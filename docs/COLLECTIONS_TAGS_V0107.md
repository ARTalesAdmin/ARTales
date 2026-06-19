# ARTales v0.10.7 — Collections & Tags

## Co patch zavádí

- **Collections v1.0**
  - kolekce jsou bilingvní (`title_cs/en`, `subtitle_cs/en`, `description_cs/en`, `curator_note_cs/en`)
  - veřejná galerie kolekcí používá lokalizovaný obsah podle aktivního locale
  - kolekce mají typ, featured flag, pořadí a cover metadata
  - díla lze do kolekcí řadit ručně přes vazební tabulku `work_collections`

- **Tags v1.0**
  - nová tabulka `tags` s typy (žánr, forma, téma, nálada, období, jazyk, obtížnost, reading mode, formát, audience, content note, other)
  - vazební tabulka `work_tags`
  - interní editor tagů na `/member/tags`
  - editor díla umožňuje přiřazovat více tagů

## Důležité poznámky

- `works.collection_id` zůstává zachované jako **primární kolekce** kvůli backward compatibility.
- Vícenásobné přiřazení kolekcí řeší `work_collections`.
- Editace vztahů kolekce ↔ díla je dostupná na `/member/collections/[slug]/edit`.
- Seed core 8 kolekcí je v `docs/collections_seed_v1.sql`.

## Doporučený postup nasazení

1. aplikovat migraci `2026-06-19_collections_tags_v0107.sql`
2. nasadit patch UI/TS části
3. spustit seed `docs/collections_seed_v1.sql`
4. založit první tagy a otestovat:
   - vytvoření/úpravu kolekce
   - přiřazení děl ke kolekci a jejich pořadí
   - přiřazení tagů v editoru díla
   - veřejné `/collections` a `/collections/[slug]`
