# ARTales Editorial Materials & Prompts

This document mirrors the internal `/member/resources` page. The page is the practical source for editors; this file keeps the standards versioned in the repo. Resources are a one-way reference library: editor forms can link to materials, but the materials page should not redirect back into create/edit flows.

## Work cover

- Ratio: 2:3
- Master: 1600 × 2400 px
- Used for: gallery, work detail, library, future print front-cover foundation
- Keep title, author and ARTales branding inside safe zones.
- One primary cover per work for now; variants are a later model.

## Author portrait / avatar

- Ratio: 1:1
- Master: 1200 × 1200 px
- Used for: author list, author detail, future contributors/imprint layers
- Prefer public-domain/licensed real portraits or ARTales symbolic avatars.
- Avoid random internet images without clear rights.

## Collection cover

- Ratio: 3:2
- Master: 1800 × 1200 px
- Used for: collection list, collection detail, editorial/catalog visual
- Should feel like an edition, shelf, catalogue circle or literary theme, not a competing book cover.

## Parser rules

- AI must not rewrite the source text.
- Ordinary dialogue/direct speech remains `::paragraph`, not `::quote`.
- `::quote` is for real detached quotes, mottos, epigraphs or visibly separated quoted blocks.
- Preserve italic text as inline `<em>...</em>`.
- Mark images/illustrations/maps as `::image` placeholders so editors can upload assets later.

## Materials page UX rule

- Keep contextual links from editor forms to `/member/resources`.
- Do not link from `/member/resources` back to new work/author/collection forms.
- Prompts on `/member/resources` should provide copy-to-clipboard actions for use in AI tools.
