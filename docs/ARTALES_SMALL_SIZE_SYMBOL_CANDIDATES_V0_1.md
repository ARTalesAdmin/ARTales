# ARTales small-size symbol candidates v0.1

## Summary

This review package presents three self-contained SVG treatments of the locked ARTales pen-drop symbol for small-size evaluation. It creates no production favicon, app icon, binary output, public asset, or runtime integration.

## Source symbol master

The sole geometry source is `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg`, with its lock record in the adjacent JSON file. The candidates preserve every source path and use transforms only for scale and padding. The source master and existing exports remain unchanged.

## Why small-size use needs separate review

The full lockups are designed for larger brand presentation and are unsuitable as favicon or app-icon sources. Even the standalone symbol has a tall silhouette, a fine pen-nib opening, and four small diamond details. Browser rasterization and low pixel counts can reduce those details, especially at 16 px, so a dedicated decision is required before production export.

## Candidate variants

1. **transparent-gold:** Primary Gold symbol on transparency for controlled inline backgrounds. It is not a dependable standalone choice on unpredictable browser or operating-system backgrounds.
2. **dark-square-gold:** Primary Gold symbol on a controlled Ink/Night square, with 48 px vertical padding on the 512 px source canvas. It is likely the strongest favicon/app-icon base.
3. **dark-round-gold:** Primary Gold symbol on a controlled Ink/Night circle, with 72 px vertical padding on the 512 px source canvas. It is intended for social-avatar and rounded app-icon review.

No candidate changes or destructively simplifies the locked geometry.

## Review board sizes

The review board shows all three variants at simulated **16, 24, 32, 48, 64, and 128 px**. Rows run transparent, dark square, and dark round; columns increase in size from left to right. Neutral paper, white, and checker surfaces belong only to the board and make transparency and edges easier to inspect.

## Color and background rationale

Primary Gold (`#E0AA47`) follows the approved export profile. Ink/Night (`#0F1315`) gives the two controlled-background directions consistent dark contrast. The existing monochrome-light export is useful on known dark surfaces, but it is not a practical small-size or favicon choice on light or transparent preview backgrounds because the mark can lose contrast.

## Limitations

- SVG simulation does not prove the result of future PNG or ICO rasterization.
- Fine master details may disappear at 16 px; review should focus on the nib opening, diamonds, and overall silhouette.
- Transparent gold depends on a controlled host background.
- These artifacts await human visual review and are not masters or public assets.

## Out of scope

Binary formats, production favicons, app icons, a simplified symbol, master locking, `public/` assets, metadata or manifest changes, application/runtime integration, CSS, database work, environment changes, and modifications to the source master or existing exports are all excluded.

## Next steps

1. Complete human visual review.
2. Choose one small-size candidate direction.
3. Optionally create a clearly separate simplified v0.2 if the locked detail is insufficient.
4. Lock a dedicated small-size master after approval.
5. Generate PNG, ICO, and app-icon binaries later through an approved manual/tooling workflow.
6. Perform runtime or public integration only in a later explicitly scoped pull request.

## Change control

- **Risk:** low — isolated review SVGs and documentation only.
- **Target:** develop first.
- **DB:** no.
- **Env:** no.
- **Rollback:** revert the candidate-set commit; no data, configuration, binary, public, or runtime cleanup is required.
