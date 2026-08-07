# ARTales public accent polish v0.1

## Status and intent

This is a quick public-facing accent polish after the intentional palette
mapping preview introduced by PR #91 and documented further by PR #93. It makes
the approved gold palette easier to see in the `develop` preview without
changing the semantic token values again. This preview is not approval to
promote the change to `main`.

## Selectors changed

Only these public selectors in `app/globals.css` change:

- `.artales-public-header` uses the strong gold border token for its existing
  bottom divider.
- `.artales-public-link` and `.artales-public-link:hover` keep primary text for
  readability and reveal a gold underline on hover.
- `.artales-button` uses primary gold for its existing border.
- `.artales-button-secondary` uses the strong gold border token for its existing
  border.
- `.artales-gallery-card` uses the strong gold border token for its existing
  card border.
- `.artales-gallery-card__author-link` and
  `.artales-gallery-card__meta a:not(.artales-gallery-card__author-link)` replace
  legacy underline recipes with the approved gold-hover token.
- `.artales-work-detail-facts a` replaces its legacy underline recipe with the
  approved gold-hover token.

## Expected visible effect

The public header divider, primary and secondary CTA outlines, and gallery card
edges show a restrained gold accent. Public navigation hover states and the
existing metadata and work-detail link underlines use the approved darker gold.
Link text remains the primary text color, so the accent does not carry the
readability burden.

## Risk and intentional exclusions

Risk is **low**: the patch changes only colors on existing borders and text
decorations, adds no layout-affecting rules, reuses approved semantic tokens,
and can be removed with a single revert. The result still needs review in the
deployed preview because automated CSS validation cannot judge every theme and
background combination.

There are no changes to spacing, type scale, layout, components, routes,
Tailwind configuration, semantic token values, state colors, reader styles or
variables, or admin/editor/member/account dense UI selectors. Public assets,
brand masters and exports, icons, favicon, manifest, service worker, packages,
database, environment, and Supabase configuration are also unchanged. Large
background recolors and new raw color literals are intentionally excluded.

## Preview checklist

Review the `develop` preview on desktop and mobile:

- [ ] Public header divider and navigation hover underline
- [ ] Primary and secondary public CTA borders and readable labels
- [ ] Gallery card borders, title links, metadata links, and author links
- [ ] Work-detail fact links and adjacent text
- [ ] Keyboard focus visibility for the affected links and CTAs
- [ ] Light, dark, and adaptive/system themes where available
- [ ] Contrast and readability on all affected backgrounds
- [ ] No layout shift or spacing change

## Delivery record

- **Changed files:** `app/globals.css` and this preview record.
- **Risk:** `low` — token-backed accents on existing public borders and link
  decorations only.
- **Target:** `develop first` — visual preview only; do not merge or promote to
  `main` automatically.
- **DB:** `no`.
- **Env:** `no`.

## Rollback path

Revert the accent-polish commit to restore the previous public border and
underline declarations. No database, environment, package, asset, component,
route, or token-value rollback is required. After reverting, recheck the public
header, CTAs, gallery cards, and work-detail links in the `develop` preview.
