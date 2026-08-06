# ARTales public palette mapping preview v0.1

## Status and intent

This is the first intentional visual palette mapping preview after the
value-preserving semantic-token preparation. Earlier work defined the semantic
color tokens, connected legacy root aliases, migrated an initial selector set
and the public shell, and completed the remaining public gallery/work-detail
token cleanup without intending to change rendered colors.

This preview changes only literal values in the root semantic token definitions
in `app/globals.css`. It targets `develop` for controlled visual review and is
not approval for promotion to `main`. Legacy aliases remain in place and no
selector declarations are added, removed, or rewritten.

## Mapped tokens

| Semantic token | Previous value | Preview value | Rationale |
| --- | --- | --- | --- |
| `--artales-color-background-page` | `#fbf5ea` | `#FDF3E2` | Approved Paper |
| `--artales-color-background-surface` | `#fffefb` | `#fffaf0` | Conservative warm surface above Paper |
| `--artales-color-background-inverse` | `#0d1528` | `#0F1315` | Approved Ink / Night |
| `--artales-color-background-inverse-deep` | `#090b0d` | `#141414` | Approved Deep Dark |
| `--artales-color-text-primary` | `#0d1528` | `#272827` | Approved Text Dark |
| `--artales-color-text-inverse` | `#fff8e5` | `#FDF3E2` | Approved Paper on inverse surfaces |
| `--artales-color-brand-gold` | `#d9b76e` | `#E0AA47` | Approved Primary Gold |
| `--artales-color-brand-gold-secondary` | `#d9b76e` | `#E3AA46` | Approved Secondary Gold |
| `--artales-color-brand-gold-hover` | `#6f5424` | `#D19738` | Approved Darker Gold |
| `--artales-color-brand-symbol` | `#d9b76e` | `#DCA645` | Locked symbol/source gold |
| `--artales-color-border-subtle` | `rgba(13, 21, 40, 0.14)` | `rgba(39, 40, 39, 0.14)` | Existing low alpha retained with Text Dark RGB |
| `--artales-color-border-strong` | `rgba(217, 183, 110, 0.44)` | `rgba(224, 170, 71, 0.44)` | Existing alpha retained with Primary Gold RGB |

The case used in CSS follows the repository's lowercase literal style; the
values above are equivalent to the approved palette notation.

## Expected public preview impact

The mapped definitions and their existing one-way legacy aliases can affect the
base public page, public brand text, header/navigation, footer, homepage and
public calls to action where those tokens or aliases remain active. The
selector-level semantic references in gallery/catalog cards and work-detail
facts now preview Text Dark directly. Existing later light, dark, and adaptive
theme declarations continue to win where the cascade already overrides a root
alias, so those theme-specific recipes are preserved rather than force-remapped
in this first preview.

Because this is deliberately conservative, an approved palette value being
defined here does not imply that every public surface has been migrated to it.
The preview should be reviewed as a controlled first mapping, not a complete
site recolor.

## Intentionally deferred

- `--artales-color-background-surface-muted` remains `#f3eadc`, which is already
  compatible with Paper and preserves existing surface separation.
- `--artales-color-text-secondary` and `--artales-color-text-muted` retain
  `#5f5247` and `#73685d`; changing secondary hierarchy awaits contrast review.
- `--artales-color-brand-gold-muted` remains unchanged because remapping its
  alpha recipe is unnecessary for this preview. The approved Gold Shade
  (`#B58636`) is therefore not assigned to a semantic token in v0.1; assigning
  it belongs to a later, usage-led mapping rather than this conservative pass.
- Action and focus tokens remain unchanged. Existing selector behavior, rather
  than a broader action-system remap, is the review boundary for v0.1.
- Success, warning, error, and info state colors remain unchanged so semantic
  meaning and status contrast are not altered incidentally.
- Gradients, shadows, raw colors, and other alpha recipes remain unchanged.
- Reader tokens, reader CSS, and reader themes remain deferred.
- Admin, editor, member, and account dense UI tokens and selectors remain
  deferred, as do payment, credit, authentication, and Supabase behavior.
- Components, routes, Tailwind configuration, public assets, icons, manifests,
  service workers, packages, database, and environment configuration are not
  part of this preview.

## Preview checklist

Review in the `develop` preview on desktop and mobile:

- [ ] Homepage page color, text hierarchy, cards, and links
- [ ] Public header, navigation, brand treatment, and focus visibility
- [ ] Public footer text, links, dividers, and background relationship
- [ ] Gallery/catalog cards, metadata, links, and empty states
- [ ] Work-detail headings, facts, links, and adjacent surfaces
- [ ] Public primary/secondary buttons and CTA hover/focus states
- [ ] Light theme where available
- [ ] Dark theme where available
- [ ] Adaptive/system theme, including initial load and theme switching
- [ ] Basic text/background and interactive-state contrast and readability

Automated CSS parsing can confirm syntax, but visual contrast and the full
adaptive-theme cascade still require browser review in the deployed preview.

## Rollback path

Revert the single palette-preview commit (or restore the previous values in the
mapping table) to return the root semantic tokens to their value-preserving
state. No database, environment, asset, package, component, or route rollback
is required. After rollback, recheck the public homepage, shell,
gallery/catalog, and work-detail pages in light, dark, and adaptive themes.

## Delivery record

- **Changed files:** `app/globals.css` contains the reviewable literal token
  mapping; this document records its scope, expected effects, deferrals, review,
  and rollback.
- **Risk:** `medium` — this is an intentional public visual-system change and
  needs targeted browser and contrast review, but it does not alter application
  behavior or data.
- **Target:** `develop first` — preview review is required; this is not approval
  to promote the mapping to `main`.
- **DB:** `no`.
- **Env:** `no`.
- **Known limitation:** automated syntax checks do not replace browser review of
  public surfaces, responsive states, or light/dark/adaptive theme combinations.
