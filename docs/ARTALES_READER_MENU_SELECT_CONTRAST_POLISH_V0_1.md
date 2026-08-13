# Reader compact-menu contrast polish v0.1

## Scope

This small Reader polish addresses two readability issues observed before Phase 3:

- native select options could become very low contrast in the script and dark themes;
- the semi-transparent compact-menu panel allowed text from the reading surface to
  show through, especially over a desktop two-page spread and on mobile.

The change is CSS-only and scoped to `.artales-reader-menu__panel` and its native
select controls. It does not change the menu layout, labels, control structure,
Reader behavior, or settings persistence. The panel now uses an opaque,
theme-matched surface and a slightly stronger theme-aware shadow. Compact-menu
selects expose matching light or dark native color schemes, explicit option colors,
legible disabled-option colors, and visible hover and keyboard-focus states.

## Native select limitation

The operating system and browser ultimately render an opened native select menu.
Some browsers ignore part or all of the CSS applied to `option` elements. The
closed control remains explicitly styled, while `color-scheme` and option foreground
and background colors provide the best supported hint for opened menus without
replacing the native select with a custom combobox.

## Develop-preview checklist

- [ ] In light, script (`rukopisný`), and dark themes, confirm every closed select
  value is readable against the compact-menu surface.
- [ ] Open every select in the supported desktop browsers and confirm available and
  disabled options remain distinguishable where native styling permits.
- [ ] Confirm pointer hover and keyboard focus are visible in all three themes.
- [ ] In desktop two-page mode, open the menu over page text and confirm the reading
  surface does not show through or compete with menu text.
- [ ] On a narrow mobile viewport, open and scroll the menu over the reading surface;
  confirm its fill, border, and shadow keep controls comfortably readable.
- [ ] Confirm account, admin, member, and other non-Reader forms are unchanged.
