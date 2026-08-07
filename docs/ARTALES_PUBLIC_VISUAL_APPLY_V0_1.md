# ARTales public visual apply v0.1

## Status and intent

This is a focused, develop-only visual apply preview for the approved ARTales
public palette. It does not authorize promotion to `main`.

PR #91 mapped the approved palette into semantic tokens, while retaining the
existing cascade and most raw recipes. PR #94 added a deliberately small gold
accent pass. Both were subtle because later adaptive-theme rules, translucent
white cards, legacy ink borders, and legacy surface aliases still won on many
public selectors. This pass connects the main light/adaptive public surfaces to
the approved semantic Paper, Ink, Gold, surface, border, and inverse tokens.

## Public surfaces visually applied

- The public shell now sits directly on Paper rather than sharing the later
  legacy launch gradient used by application/workspace shells.
- The public header uses a warm surface and a restrained strong gold divider.
- Homepage brand, feature, path, editorial section, and final CTA cards use the
  warm semantic surface; the larger section and final CTA retain a stronger
  gold edge for hierarchy.
- Homepage labels and public kickers use the approved darker gold, while body
  copy uses the approved primary/secondary text hierarchy.
- Gallery/catalog cards, author cards, and work-detail facts use the warm
  semantic surface with the strong gold border system.
- Secondary public actions use the muted warm surface; primary public actions
  use inverse Ink/Paper with a gold border.

No standalone public footer selector exists in the current stylesheet or public
TSX markup. The footer relationship is therefore represented by the Paper
public shell and existing public link treatments; no DOM or route was added to
manufacture a new footer in this CSS-only pass.

## Selectors changed

The apply layer is limited to the non-dark public cascade:

- `.artales-public-shell`
- `.artales-public-header`
- `.artales-home-brand-panel`, `.artales-home-feature-card`,
  `.artales-home-section`, `.artales-home-path-card`,
  `.artales-home-final-cta`
- `.artales-home-eyebrow`, `.artales-home-card-eyebrow`,
  `.artales-home-panel-label`, `.artales-home-intro`, and public homepage copy
- `.artales-public-kicker`
- `.artales-gallery-card` and its subtitle, metadata, summary, and hero copy
- `.artales-author-card`
- `.artales-work-detail-facts` and its term labels
- `.artales-button-secondary`, `.artales-theme-toggle`,
  `.artales-public-link--primary`, and `.artales-button`

The previous combined launch-theme rule was narrowed from public, application,
and workspace shells to application/workspace shells only. This prevents the
legacy launch gradient from covering the semantic public Paper background and
does not alter the application or workspace result.

## Old recipe categories replaced

The public apply layer replaces effective translucent-white card recipes,
legacy launch surface aliases, raw ink borders, and raw light-theme CTA recipes
with existing semantic surface, border, text, gold, and inverse tokens. It adds
no new raw colors, gradients, shadows, spacing, typography, or layout rules.
Dark-theme-specific public recipes remain intact and continue to win when
`data-artales-theme="dark"` is active.

## Expected visible effect

In light mode and the non-dark adaptive state, the homepage and catalog should
read as warm Paper with distinct cream surfaces, calm dark literary text, and
selective gold edges and labels. Gallery cards and work facts should no longer
look like generic translucent white panels. Primary actions remain restrained
Ink buttons with a gold outline rather than broad gold fills. Dark mode should
retain its established dark public treatment and readable gold accents.

## Intentionally deferred

- Dark-theme recipe remapping beyond preserving the current reviewed dark
  treatment.
- A dedicated public footer component or selector.
- Reader styling and variables; reader pagination and parser work.
- Admin, editor, member, account, auth, payment, credit, and other dense internal
  UI selectors.
- State/status colors, shadows, mobile layout, spacing, typography scale,
  components, routes, assets, icons, manifests, service workers, packages,
  database, environment, and Supabase behavior.

## Preview checklist

Review the deployed `develop` preview:

- [ ] Homepage on desktop: Paper shell, warm cards, text hierarchy, and section edges
- [ ] Homepage on mobile: same palette relationship with no spacing or layout shift
- [ ] Public header/navigation: warm header, gold divider, readable hover and focus
- [ ] Public footer area: Paper relationship and existing public links remain readable
- [ ] Gallery/catalog: warm cards, gold borders, metadata and summaries remain readable
- [ ] Work detail: warm facts surface, label hierarchy, links, and adjacent cover
- [ ] Public primary/secondary CTA and theme toggle: default, hover, and focus states
- [ ] Light, dark, and adaptive/system theme behavior where available
- [ ] Link, hover, focus, and text contrast across affected surfaces
- [ ] No layout shift at desktop or mobile breakpoints

Automated CSS parsing validates syntax only. Visual contrast, OS-level adaptive
initialization, and interaction states still require browser review in the
preview deployment.

## Delivery record and rollback

- **Changed files:** `app/globals.css` applies the public palette;
  `docs/ARTALES_PUBLIC_VISUAL_APPLY_V0_1.md` records scope and review guidance.
- **Risk:** `medium` — this is an intentional public visual-system change across
  several pages, with no data or behavior change.
- **Target:** `develop first` — preview only; do not merge or promote to `main`
  automatically.
- **DB:** `no`.
- **Env:** `no`.
- **Rollback notes:** revert the visual-apply commit to restore the previous
  public launch gradient and legacy effective surface recipes. No data,
  configuration, package, asset, component, or route rollback is required.
  Recheck homepage, header, gallery, work detail, CTAs, and light/dark/adaptive
  themes after rollback.
