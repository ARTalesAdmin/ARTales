# ARTales logo lockup master lock v1

## Summary

The human-approved ARTales light/dark v0.3 review candidates are now locked as
logo lockup master v1. The two master SVGs are byte-identical copies; their
geometry, scale, spacing, alignment, viewBox, paths, colors, and embedded SVG
metadata were not changed.

## Human approval

> Ano, to je ono.

## Source candidate and masters

- Candidate: `artales-lockup-light-dark.v0.3`
- Candidate package: `brand/artales/lockups/candidates/light-dark-v0.3/`
- Locked symbol source: `brand/artales/masters/symbol-pen-drop/symbol-pen-drop.master.v1.svg`
- Locked wordmark source: `brand/artales/masters/wordmark-artales/artales-wordmark.master.v1.svg`

The locked symbol and wordmark source masters remain unchanged.

## SHA-256 comparison

| Variant or source | Source SHA-256 | Master SHA-256 | Byte-identical |
| --- | --- | --- | --- |
| Light lockup | `8697d4a0fa29e9c000e45b9c4a920ec2c916ac7940c61a9603fa28e34d6cd75b` | `8697d4a0fa29e9c000e45b9c4a920ec2c916ac7940c61a9603fa28e34d6cd75b` | Yes |
| Dark lockup | `ee4844c7d4c96a57ae3a01a1b52731812e342ef9bb9accfc60a8028bbae61fb4` | `ee4844c7d4c96a57ae3a01a1b52731812e342ef9bb9accfc60a8028bbae61fb4` | Yes |
| Symbol master | `d70d53143a6809d0bea61d68238b40d6a7d3a063e8a5f0f5d703f234d9899847` | Not copied or modified | Not applicable |
| Wordmark master | `74ed72373b89a0818628469d5a6ff5fdf7080316d9338018f6bf70ae9fec4f91` | Not copied or modified | Not applicable |

Direct byte comparison confirms that each source candidate SVG and its master
counterpart are identical.

## What was locked

- A transparent-background light lockup master with the dark wordmark treatment.
- A transparent-background dark lockup master with the gold wordmark treatment.
- The v0.3 composition, including its approved scale, gap, alignment, and slight
  downward optical overhang.
- Provenance, approval, integrity hashes, palette intent, and scope controls in
  the master manifest.

The gold symbol remains `#DCA645`. The light-context wordmark is `#272827`; the
dark-context wordmark is `#E0AA47`. The paper and dark context colors recorded
in the manifest express intended review contexts only; backgrounds are not
embedded in either transparent master.

## Out of scope

No export profile, PNG or other production export, favicon, app icon,
monochrome treatment, small-size variant, CSS, component, public asset, or
website integration is created or approved here. This lock changes no runtime,
database, Supabase, payment, credit, membership, reader, editor, parser, or
environment behavior.

## Why this is not runtime integration

The files remain controlled brand masters under `brand/artales/masters/`.
Nothing copies them to a public asset directory, imports them into application
code, or selects them through runtime styling or configuration. Locking a
source master establishes the approved design input; it does not authorize a
deployment or public use.

## Next steps

1. Define export profiles.
2. Create production export assets.
3. Create favicon, app-icon, and small-size variants separately.
4. Perform runtime/public integration only in a later explicit pull request.
