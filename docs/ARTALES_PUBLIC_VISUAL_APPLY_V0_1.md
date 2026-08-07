# ARTales public visual apply v0.1

## Status and intent

This is a `develop`-only public visual apply preview. PR #91 mapped the
approved palette into semantic tokens, and PR #94 added a deliberately small
set of gold accents. Those previews remained subtle because later theme rules
and many public cards still supplied legacy gradients, translucent white
backgrounds, raw ink borders, and theme aliases instead of consuming the new
semantic values directly.

This pass makes the approved Paper, Ink, and Gold relationship visible without
changing token values, layout, typography, components, or routes. It is not an
approval to merge or promote the result to `main`.

## Public surfaces applied

- The light and adaptive public shell now rests directly on the Paper page
  token; its header uses the warm surface token and a restrained gold border.
- Homepage brand, feature, section, path, and final CTA panels use the warm
  surface and semantic subtle border. The existing homepage footnote uses the
  muted warm surface and strong border as the public footer treatment.
- Public primary actions pair inverse Ink with Paper text and a gold edge;
  secondary actions and the theme toggle use the warm surface and gold border.
- Gallery/catalog, author, community, and resource cards use the warm public
  surface, semantic primary text, and the stronger gold border.
- Work-detail facts and edition language notes use the muted warm surface,
  strong gold border, and semantic text hierarchy.

## Selectors changed

The apply block in `app/globals.css` is limited to the following public
selectors, scoped with `:root:not([data-artales-theme="dark"])` so existing dark
theme contrast recipes continue to work:

- `.artales-public-shell`, `.artales-public-header`, `.artales-public-main`,
  and `.artales-home-main`
- `.artales-home-brand-panel`, `.artales-home-feature-card`,
  `.artales-home-section`, `.artales-home-path-card`,
  `.artales-home-final-cta`, and `.artales-home-footnote`
- `.artales-button`, `.artales-public-link--primary`,
  `.artales-button-secondary`, and `.artales-theme-toggle`
- `.artales-gallery-card`, `.artales-author-card`,
  `.artales-community-card`, and `.artales-resource-card`
- `.artales-work-detail-facts`, `.artales-work-detail-facts dt`, and
  `.artales-edition-language-note`
- `.artales-gallery-card__subtitle`, `.artales-gallery-card__summary`, and
  `.artales-gallery-card__meta`

## Replaced visual recipe categories

The new declarations replace public-only cascade outcomes from translucent
white cards, legacy light-theme surface aliases, raw ink borders, and the
public shell gradient with semantic page, surface, text, border, inverse, and
gold tokens. Existing shadows are retained, and no new raw colors or gradients
are introduced.

## Expected visible effect

In light and adaptive-light preview, the page should read as Paper rather than
generic cream, with warmer card layers, dark literary text, and measured gold
edges around navigation, actions, catalogue cards, and work facts. Primary
buttons remain calm Ink surfaces rather than broad gold fills. The result is a
palette application, not a layout redesign, so there should be no movement or
size change.

## Intentionally deferred

- Existing dark-theme recipes are preserved and should receive regression and
  contrast review rather than an incidental recolor in this light-surface pass.
- Reader styles and variables, admin/editor/member/account and other dense
  internal UI, authentication, payments, credits, and Supabase logic remain
  untouched.
- State colors, layout, spacing, typography scale, shadows, components, routes,
  Tailwind configuration, assets, icons, manifest, service worker, packages,
  database, and environment configuration are unchanged.

## Preview checklist

Review the deployed `develop` preview:

- [ ] Homepage on desktop and mobile
- [ ] Public header and navigation
- [ ] Public homepage footnote/footer treatment
- [ ] Gallery/catalog cards
- [ ] Work-detail page and facts
- [ ] Public primary and secondary CTA/buttons
- [ ] Light, dark, and adaptive/system themes where available
- [ ] Link, hover, and keyboard-focus readability
- [ ] No layout shift or spacing change

Automated parsing can validate syntax, but the final color relationships and
theme transitions require browser review in the deployed preview.

## Delivery and rollback

- **Changed files:** `app/globals.css` applies the public palette;
  `docs/ARTALES_PUBLIC_VISUAL_APPLY_V0_1.md` records scope and review guidance.
- **Risk:** `medium` — this is an intentional, visible public visual-system
  change that requires responsive and theme regression review.
- **Target:** `develop first` — preview only; do not promote automatically.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback:** revert the public visual-apply commit to restore the preceding
  cascade. No data, environment, package, asset, component, or route rollback
  is required. Then recheck the homepage, public shell, catalogue, work detail,
  actions, and theme switching in the `develop` preview.
