# ARTales micro-symbol master lock v1

## Locked package

The v1 micro-symbol master package consists only of:

- `brand/artales/masters/micro-symbol/artales-micro-symbol.master.v1.svg`
- `brand/artales/masters/micro-symbol/artales-micro-symbol.master.v1.json`
- `brand/artales/masters/micro-symbol/README.md`

The SVG is the immutable vector input for deterministic, review-only icon
artifact generation. The lock records the source; it does not deploy the symbol,
approve generated production icons, or change the ARTales application.

## Change control

Do not edit the v1 SVG or metadata in place. A visual change requires a new
versioned package and explicit review. Runtime or `public/` integration remains
a separate, explicitly approved change.
