# ARTales Visual Identity Pack

This folder is the project-specific home for the ARTales visual identity pack.

It is not a finished Brand Pack v1 yet. It is the first repository structure for evaluating, documenting, approving and later exporting ARTales visual identity assets.

## Scope

This folder is limited to visual identity:

- wordmark;
- logo lockup;
- symbol or mark;
- monogram;
- color palette;
- typography;
- graphic motifs, backgrounds and textures;
- export profiles;
- generated visual assets;
- approval and readiness state.

It does not manage the full ARTales brand, message house, legal policy, product strategy or wider Syrael governance model. Those materials can be referenced as context, but they are not locked by this visual identity pack.

## Folder roles

- `masters/` is reserved for future locked source masters, such as SVG wordmark, logo lockup, symbol and monogram files.
- `exports/` is reserved for generated outputs created from locked masters, such as favicons, web logos, social avatars, watermarks and brand sheets.
- `visual-identity.readiness.example.json` shows how to evaluate whether the visual identity is ready for lock and export.
- `visual-identity.manifest.example.json` shows how future visual assets should record their source, version, usage and approval state.

## Current status

Current ARTales visual material is treated as reference or candidate material until the relevant masters are explicitly approved and locked.

Reference material is not a production master.

## Future tooling

This ARTales structure is the first project-specific implementation of a future reusable Visual Identity Builder model. Generic validators, exporters, UI or CLI tooling may later move to a separate tool repository. Project-specific approved masters, manifests and exports should remain versioned with the project that uses them.
