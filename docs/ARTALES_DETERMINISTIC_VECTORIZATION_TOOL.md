# ARTales deterministic vectorization tool v0.1

## Purpose

Earlier manual and generative SVG attempts drifted from the approved raster references. A visually plausible redraw was not sufficient: small changes in the symbol geometry, wordmark, spacing, or edge character could become a new interpretation rather than a faithful extraction.

This scaffold replaces subjective reconstruction with a repeatable, reference-first process:

> source raster/crop → color and background segmentation → binary mask → cleaned mask → optional vector trace candidate → overlay and diagnostic report → human review

The approved raster reference remains the authority throughout the process. The tool records its inputs and parameters so that the same configuration can be rerun and reviewed. It does not claim that deterministic output is automatically correct.

## Architecture and approval boundary

The intended lifecycle is:

1. **Source reference:** an approved or review-authorized raster and its direct crop provide the evidence.
2. **Deterministic tool:** checked-in thresholds and cleanup parameters produce reproducible diagnostic artifacts.
3. **Comparison:** masks, source overlays, basic metrics, and an optional trace expose differences for inspection.
4. **Human approval:** a reviewer accepts, rejects, or requests a parameter revision. Tool execution itself grants no approval.
5. **Later promotion:** only a separately reviewed change can promote an accepted candidate into the controlled brand system.

Version 0.1 uses RGB-distance segmentation and simple morphological cleanup. Pillow produces raster artifacts. If the optional local `potrace` executable is present, it produces an SVG trace candidate; otherwise the pipeline completes its masks and overlay and records a skipped trace in the report.

## Asset vocabulary

| Term | Meaning |
| --- | --- |
| **Candidate** | An unapproved working result generated for visual comparison and review. It may be discarded or regenerated. |
| **Master** | A human-approved, governed source asset. The tool never creates or promotes a master by itself. |
| **Export** | A derived file made from an approved master for a defined delivery format, size, or color context. |
| **Runtime asset** | A file deliberately integrated into the website or application and subject to runtime testing and release policy. |

These states are not interchangeable. In particular, an SVG emitted by a tracing backend remains a candidate even if it is technically valid and visually close.

## Repository scope

The v0.1 change contains only a local CLI, three configs, documentation, and an empty output directory placeholder. It does not:

- create or approve a brand master;
- replace a source reference or extracted crop;
- commit generated SVG or PNG candidates;
- integrate an asset into the website;
- change runtime code, CSS, public assets, icons, favicons, dependencies, environment, or database behavior.

Runtime integration is intentionally out of scope because reference analysis and asset approval must happen before delivery decisions. Keeping generated diagnostics outside runtime assets prevents an experimental trace from being mistaken for a production logo.

## Operation and review

Usage and optional local requirements are documented in `tools/brand/vectorize-reference/README.md`. The three configs address the standalone symbol, the light lockup, and the dark lockup. Generated artifacts live under the ignored tool output directory and should be inspected locally.

A reviewer should compare at minimum:

- silhouette and interior negative spaces;
- fine strokes and antialiased boundaries;
- accidental background or compression-noise selection;
- cleaned-mask differences from the raw mask;
- wordmark spacing and separation in lockups;
- the report's foreground ratios and cleanup-change count between runs.

Approval should identify the exact config version and reviewed artifacts. Promotion to a master belongs in a later, explicit pull request.

## Future Brand Lab / Asset Lab direction

A future non-technical interface could provide a controlled flow to:

1. upload or select a reference;
2. choose a segmentation preset and adjust bounded parameters;
3. run vectorization in an isolated worker;
4. compare source, mask, cleaned mask, overlay, and optional trace side by side;
5. record reviewer feedback and approval state;
6. prepare a pull request containing a reviewed candidate and its provenance;
7. promote it only through a separate governed master-asset review.

The UI should consume the CLI's JSON report rather than reproducing hidden processing rules in the browser. It should show trace-backend absence as a normal partial result, keep candidate and master states visibly distinct, and never publish an upload directly to runtime assets.
