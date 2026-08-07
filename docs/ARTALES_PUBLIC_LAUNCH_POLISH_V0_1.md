# ARTales public launch polish v0.1

## Status and purpose

This is a `develop`-only public launch-polish pass for production review. PR
#96 established the approved Paper / Ink / Gold palette on public surfaces, and
PR #98 delivered the approved runtime logo lockups and enabled the homepage
brand card's opt-in lockup mode. This follow-up resolves the remaining small
surface and interaction inconsistencies without changing structure, content,
assets, or application behavior. It must not be promoted to `main`
automatically.

## Selectors changed

The final, narrowly scoped block in `app/globals.css` adjusts:

- `.artales-public-header` for a softer boundary with the public shell;
- `.artales-home-brand-panel` and its large lockup wordmark for an integrated,
  balanced brand presentation;
- `.artales-home-feature-card`, `.artales-home-path-card`,
  `.artales-gallery-card`, `.artales-author-card`, `.artales-community-card`,
  and `.artales-resource-card` for one restrained card hierarchy;
- `.artales-work-detail-facts` and `.artales-edition-language-note` for a
  related but quieter informational surface;
- public navigation, gallery metadata/title links, work-fact links, and
  homepage path links for consistent underline, hover, and keyboard-focus
  treatment;
- public primary and secondary buttons plus the public theme toggle for calm,
  readable hover and focus states; and
- minimal dark-theme header and homepage brand-panel rules to prevent an
  obvious surface seam while retaining the established adaptive palette.

All interaction rules are contained by `.artales-public-shell` or
`.artales-home-shell`. They do not target reader, admin, editor, member,
account, or other internal containers.

## Visual problems fixed

- The header ended with a comparatively strong gold edge, making the start of
  the hero feel detached. The edge is now semantic and subtle, with a very
  restrained tonal shadow to carry the surface into the page.
- The approved homepage lockup sat in a panel that read like every other card.
  The panel now uses the muted Paper surface and measured gold border, and the
  large wordmark receives a bounded width so it remains centered and balanced.
- Catalogue/gallery cards and homepage cards used inconsistent border strength.
  They now share the warm surface, subtle border, and restrained shadow logic.
- Work facts and edition language notes now read as quieter adjacent information
  rather than generic translucent white cards.
- Public links previously mixed persistent, hidden, and abrupt gold underlines.
  Their underline reveal, hover color, and keyboard outline now follow one
  editorial-gold treatment.
- Primary and secondary action states now change within the semantic
  Paper/Ink/Gold system rather than making a harsh color jump.

No new raw color was introduced. Light/adaptive-light rules use the approved
semantic color tokens. The two dark-theme surface corrections use the existing
adaptive aliases because those aliases already switch with the explicit dark
theme, while the approved `--artales-color-*` palette remains light-valued.

## Expected visible effect

The homepage should feel intentionally branded from the navigation through the
hero, with the approved lockup resting naturally in a distinct editorial
panel. Public cards should feel warm and related instead of glossy or generic,
while facts and notes should remain visibly secondary. Navigation, links, and
actions should respond calmly and consistently to pointer and keyboard input.
These changes do not alter dimensions that participate in page layout, so no
layout shift is expected.

## Dark and adaptive decision

The established dark palette and its public card contrast recipes remain in
place. This pass only gives the dark public header an adaptive surface and soft
edge and preserves the brand panel's existing adaptive surface with a clearer
border. System/adaptive initial load continues to follow the existing theme
implementation; no theme script, media query, or runtime behavior changed.

## Intentionally not changed

- No copy, DOM, route, component, layout structure, or typography scale.
- No brand master, export, runtime asset, icon, favicon, PWA asset, manifest, or
  service worker.
- No reader CSS or variables, and no reader, parser, pagination, editor, admin,
  member, account, authentication, payment, credit, or internal UI selector.
- No database, environment, Supabase, dependency, or package file.
- No broad gold fills, new assets, gradients, or one-off raw colors.
- The existing mobile layout and its intentional homepage brand-panel behavior
  remain unchanged; only the inherited public color and state treatment applies.

## Develop preview checklist

- [ ] Homepage desktop
- [ ] Homepage mobile
- [ ] Header-to-hero transition
- [ ] Homepage brand card with the approved runtime lockup
- [ ] Public navigation hover and keyboard focus
- [ ] CTA buttons in default, hover, and keyboard-focus states
- [ ] Gallery/catalog cards
- [ ] Work-detail facts and edition language note
- [ ] Light theme
- [ ] Dark theme
- [ ] Adaptive/system initial load
- [ ] No layout shift
- [ ] Reader and internal surfaces remain visually unchanged

## Delivery and rollback

- **Changed files:** `app/globals.css` adds the scoped public polish;
  `docs/ARTALES_PUBLIC_LAUNCH_POLISH_V0_1.md` records its rationale, scope, and
  review procedure.
- **Risk:** `medium` — visible public CSS across several public routes requires
  responsive and light/dark preview review, although no application logic or
  data changes.
- **Target:** `develop first` — preview only; do not promote automatically.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback:** revert the public launch-polish commit. This removes the final
  override block and this record, restoring the PR #96/#98 state. No data,
  environment, package, asset, component, route, or cache rollback is needed.
  Recheck the homepage, gallery/catalog, work detail, interaction states, and
  both themes in the `develop` preview after the revert.
