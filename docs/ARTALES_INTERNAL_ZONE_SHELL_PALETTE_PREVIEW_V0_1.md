# ARTales internal-zone shell palette preview v0.1

## Summary

This is the first intentional visual change to ARTales internal surfaces. It
maps the semantic shell, navigation, text, accent, border, and card/panel
elevation tokens established after PR #119, defined in PR #120, and first
consumed in PR #121 toward the approved paper, ink, night, and restrained-gold
identity. It is a `develop`-only preview and is not approval for `main`.

**Risk:** medium, because this is an adaptive visual-system change. **Target:**
develop first. **DB:** no. **Env:** no.

## Token values changed

The old column records the value-preserving alias used before this preview.
Light/default and explicit dark mappings show the new computed intent. Dark
values are declared in the existing `html[data-artales-theme="dark"]` rule so
the internal namespace remains adaptive without changing public/legacy tokens.

| Token | Old value | New light/default | New dark |
| --- | --- | --- | --- |
| `--artales-internal-bg` | `var(--artales-paper)` | `#f9f0e3` | `#0f1315` |
| `--artales-internal-surface` | `var(--artales-surface)` | `#fffaf0` | `#141414` |
| `--artales-internal-surface-muted` | `var(--artales-paper-warm)` | `#f3eadc` | `#1b1b19` |
| `--artales-internal-surface-elevated` | `var(--artales-surface-strong)` | `#fffaf4` | `#1f1e1a` |
| `--artales-internal-border` | `var(--artales-border)` | `rgba(39, 40, 39, 0.14)` | `rgba(253, 243, 226, 0.14)` |
| `--artales-internal-border-strong` | `var(--artales-border-strong)` | `rgba(181, 134, 54, 0.34)` | `rgba(220, 166, 69, 0.36)` |
| `--artales-internal-text` | `var(--artales-ink)` | `#272827` | `#fdf3e2` |
| `--artales-internal-text-muted` | `var(--artales-muted)` | `#5f5247` | `#d8cbb7` |
| `--artales-internal-text-subtle` | `var(--artales-muted)` | `#73685d` | `#b7aa97` |
| `--artales-internal-heading` | `var(--artales-ink)` | `#0f1315` | `#fffaf0` |
| `--artales-internal-accent` | `var(--artales-gold)` | `#e0aa47` | `#e3aa46` |
| `--artales-internal-accent-strong` | `var(--artales-link)` | `#b58636` | `#e0aa47` |
| `--artales-internal-accent-soft` | `var(--artales-hero-glow)` | `rgba(224, 170, 71, 0.14)` | `rgba(224, 170, 71, 0.16)` |
| `--artales-internal-link` | `var(--artales-link)` | `#76531b` | `#e3aa46` |
| `--artales-internal-focus-ring` | `var(--artales-color-focus-ring)` | `rgba(181, 134, 54, 0.38)` | `rgba(224, 170, 71, 0.42)` |
| `--artales-internal-nav-bg` | `var(--artales-black)` | `#141414` | `#0f1315` |
| `--artales-internal-nav-border` | `var(--artales-border-strong)` | `rgba(220, 166, 69, 0.34)` | `rgba(220, 166, 69, 0.34)` |
| `--artales-internal-nav-text` | `var(--artales-gold-soft)` | `#fdf3e2` | `#fdf3e2` |
| `--artales-internal-nav-muted` | `var(--artales-muted)` | `#d8cbb7` | `#d8cbb7` |
| `--artales-internal-nav-active-bg` | `var(--artales-surface)` | `rgba(224, 170, 71, 0.14)` | `rgba(224, 170, 71, 0.16)` |
| `--artales-internal-nav-active-text` | `var(--artales-gold-soft)` | `#e3aa46` | `#e3aa46` |
| `--artales-internal-nav-hover-bg` | `var(--artales-surface)` | `rgba(253, 243, 226, 0.08)` | `rgba(253, 243, 226, 0.08)` |
| `--artales-internal-shadow-card` | `var(--artales-soft-shadow)` | `0 12px 32px rgba(15, 19, 21, 0.08)` | `0 14px 36px rgba(0, 0, 0, 0.28)` |
| `--artales-internal-shadow-panel` | `var(--artales-soft-shadow)` | `0 18px 48px rgba(15, 19, 21, 0.1)` | `0 20px 54px rgba(0, 0, 0, 0.32)` |

## Shell, navigation, and card rationale

- Shell backgrounds use a quieter warm-paper value in light mode and the
  approved ink/night family in dark mode. Elevated surfaces remain distinct
  without becoming bright or ornamental.
- Strong body and heading contrast is preserved. Muted and subtle roles remain
  deliberately readable rather than fading into the paper or night surface.
- Navigation retains a dark, efficient rail. Paper-colored default text and
  soft translucent hover treatments keep it calm; gold is reserved for active
  text, active tint, focus, and other meaningful emphasis.
- Borders combine neutral ink/paper transparency with a limited symbol-gold
  stronger edge. Shadows are shallower and quieter than generic SaaS cards.
- The light link remains the existing darker, contrast-safe brown-gold rather
  than using primary gold for small text on paper.

## Expected visible effect

Selectors already migrated in PR #121 will show the preview first: account and
admin shell text, member/account navigation title text, and the adaptive
app/workspace shell background, elevated gradient surface, and text. Other
mapped tokens are ready for existing or later semantic consumers, but this pass
does not claim that every internal card or navigation state already consumes
them. No selector, layout, spacing, typography, breakpoint, or component is
changed here.

## Deferred areas

Forms, inputs, tables, lists, workflow/status colors, danger/warning/success/info
states, badges, chips, modals, editor-specific surfaces, and inline styles are
deferred because their operational semantics and contrast need separate,
focused review. Reader, parser, pagination, access, role, membership, payment,
credit, Supabase, database, and environment behavior are outside this preview.
Public homepage, gallery, work-detail, assets, and brand sources are untouched.

## Preview checklist

- [ ] Account shell
- [ ] Member shell
- [ ] Member navigation, including active and hover states where tokenized
- [ ] Admin dashboard shell
- [ ] App/workspace shell, if present
- [ ] Card and panel surfaces where tokenized
- [ ] Global light mode
- [ ] Global dark mode
- [ ] Desktop viewport
- [ ] Narrow/mobile quick check
- [ ] No visual regression on the public homepage
- [ ] No visual regression in the Reader
- [ ] No forms, tables, statuses, or editor changes

## Rollback

Revert the palette-preview commit. That restores the internal aliases to their
value-preserving legacy sources and removes the explicit internal dark mappings.
There is no database, environment, asset, migration, or deployment ordering
requirement and no persistent data to recover.

## Next recommended PR

After the `develop` preview is reviewed in both themes and at desktop/mobile
widths, migrate one passive internal card/panel family to the mapped semantic
surface, border, text, and elevation tokens. Keep that selector-consumption PR
small, and continue to defer forms, tables, statuses, and editor workflows to
independent contrast and interaction reviews.

## Follow-up: forms and buttons polish

The next scoped preview now follows this shell palette in
`ARTALES_INTERNAL_ZONE_FORMS_BUTTONS_POLISH_V0_1.md`. It consumes explicit
internal form and button roles for named account/member forms and admin action
areas while preserving danger styling and continuing to defer editor, table,
status, Reader, and public-surface work. It remains `develop`-only and does not
authorize promotion to `main`.
