# ARTales internal-zone forms and buttons polish v0.1

## Summary

This `develop`-only preview aligns a conservative set of account, member, and
admin form controls and actions with the internal shell palette introduced
after the audits and token work in PRs #119–#122. It changes presentation only:
spacing, markup, labels, validation, submission, and workflow behavior remain
unchanged.

**Risk:** low. **Target:** develop first. **DB:** no. **Env:** no.

## Selectors reviewed

The review covered the existing global selectors for `.artales-account-form`,
`.artales-member-form`, `.artales-member-inline-form`, member list actions,
admin dashboard actions, and forms nested in `.artales-admin-dashboard`. The
broader `.artales-member-content` rules and legacy dark-theme compatibility
rules were reviewed but not expanded because that scope can include editor and
other operational workflows.

## Selectors changed

The new, final cascade layer is intentionally limited to:

- text inputs, selects, textareas, placeholders, labels, help text, checkboxes,
  and radios inside the named account/member form classes and admin dashboard
  forms;
- primary and secondary actions inside those forms, member list action groups,
  and the admin dashboard action group;
- `:focus-visible` and `:disabled` states for those same controls.

Danger actions with `.artales-button-secondary--danger` are explicitly
excluded from primary and secondary surface remapping. No status, table, badge,
or chip selector is changed.

## Token usage and values

The form aliases created in PR #120 now have explicit palette-preview values,
and button aliases are added beside them. This avoids public/root token changes
and gives each theme an auditable mapping.

| Token | Light/default | Dark |
| --- | --- | --- |
| `--artales-internal-form-bg` | `#fffaf4` | `#1f1e1a` |
| `--artales-internal-form-border` | `rgba(39, 40, 39, 0.22)` | `rgba(253, 243, 226, 0.2)` |
| `--artales-internal-form-text` | `#272827` | `#fdf3e2` |
| `--artales-internal-form-placeholder` | `#73685d` | `#b7aa97` |
| `--artales-internal-form-focus-border` | `#b58636` | `#e0aa47` |
| `--artales-internal-form-disabled-bg` | `#eee5d8` | `#1b1b19` |
| `--artales-internal-form-disabled-text` | `#73685d` | `#8f8577` |
| `--artales-internal-button-primary-bg` | `#141414` | `#0f1315` |
| `--artales-internal-button-primary-text` | `#fdf3e2` | `#fdf3e2` |
| `--artales-internal-button-primary-hover-bg` | `#272827` | `#272827` |
| `--artales-internal-button-secondary-bg` | `#fffaf4` | `#1f1e1a` |
| `--artales-internal-button-secondary-hover-bg` | `rgba(224, 170, 71, 0.14)` | `rgba(224, 170, 71, 0.16)` |
| `--artales-internal-button-disabled-bg` | `#eee5d8` | `#1b1b19` |
| `--artales-internal-button-disabled-text` | `#73685d` | `#8f8577` |

Controls also consume `--artales-internal-text-muted`,
`--artales-internal-border`, `--artales-internal-border-strong`,
`--artales-internal-accent-strong`, and `--artales-internal-focus-ring`.
Gold remains a border, checkbox/radio, hover-tint, and focus accent rather than
a decorative full-button fill.

## Light/dark, focus, and disabled handling

Both themes map the same semantic roles to palette-appropriate values. Native
form backgrounds remain distinct from their shell, placeholder/help text stays
subordinate but readable, and disabled controls retain full opacity with an
explicit muted surface, text color, and `not-allowed` cursor. Keyboard focus
uses a three-pixel semantic ring with offset plus the semantic focus border.
Button focus uses the same ring with a slightly larger offset.

## Dangerous and destructive actions

Existing danger styling remains authoritative. Danger buttons are excluded
from both neutral action mappings so that their established warning color and
meaning are not weakened. This pass does not redesign, normalize, or broaden
destructive actions.

## Intentionally deferred high-risk areas

- data tables, statuses, badges, chips, and inline styles;
- WorkEditorForm, WorkBlocksEditor, editor blocks, sticky editor controls, and
  save-state controls;
- media upload, payment, ledger, role, permission, access, and membership logic;
- Reader, parser, and pagination behavior;
- public homepage, gallery, work-detail, brand assets, and public controls;
- component refactors, TSX class hooks, copy, i18n, DB, env, and packages.

## Preview checklist

- [ ] Account forms, where present
- [ ] Member forms, where present
- [ ] Admin dashboard actions
- [ ] Low-risk filters/search controls inside the scoped forms, where present
- [ ] Text input, select, and textarea
- [ ] Primary, secondary, and small list-action buttons
- [ ] Disabled controls and actions
- [ ] Keyboard tabbing and visible `:focus-visible` treatment
- [ ] Global light mode
- [ ] Global dark mode
- [ ] Desktop viewport
- [ ] Narrow/mobile quick check
- [ ] No Reader regression
- [ ] No public homepage regression
- [ ] No editor, media, payment, or destructive-action regression

## Rollback

Revert the forms/buttons polish commit. This removes the scoped cascade layer,
restores the previous value-preserving form aliases, and removes the new button
aliases. No database, environment, asset, migration, deployment ordering, or
persistent-data recovery step is required.

## Follow-up

The next `develop` preview pass builds on these form and action mappings with
the same internal semantic palette for classed tables, list rows, badges,
chips, alerts, and status messages. That follow-up remains presentation-only
and continues to defer editor, media, payment, Reader, parser, and pagination
work.
