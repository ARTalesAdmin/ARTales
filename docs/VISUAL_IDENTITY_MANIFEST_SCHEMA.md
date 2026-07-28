# Visual Identity Manifest Schema

This document describes the intended manifest shape for future ARTales visual identity assets.

The manifest is a record of origin, version, usage and approval. It is not a design file and it is not a substitute for source masters.

## Purpose

A generated asset should answer these questions:

- what is it;
- where is it stored;
- what source master it came from;
- which version of the source it used;
- what export rule produced it;
- what it is intended for;
- which backgrounds it supports;
- whether it is approved;
- whether it can be used by runtime code.

## Top-level fields

Recommended fields:

- `schemaVersion` - version of this manifest structure;
- `project` - project name, such as `ARTales`;
- `scope` - should be `visual_identity_pack` for this model;
- `packVersion` - locked visual identity pack version, or `not_locked_yet`;
- `status` - manifest state, such as `example_only`, `draft`, `approved` or `locked`;
- `generatedAt` - timestamp for generated outputs, if applicable;
- `assets` - list of generated or planned assets;
- `sourceMasters` - list of locked or candidate source masters;
- `exportProfiles` - rules for generating outputs;
- `approvalRecord` - human approval state.

## Asset fields

Each asset should include:

- `id` - stable unique asset identifier;
- `type` - asset type, such as `wordmark`, `logo_lockup`, `symbol`, `monogram`, `favicon`, `social_avatar`, `watermark` or `brand_sheet`;
- `status` - `example_only`, `draft`, `candidate`, `approved`, `locked` or `runtime`;
- `sourceMaster` - source master identifier;
- `sourceVersion` - version of the source master;
- `path` - repository path of the asset;
- `format` - `svg`, `png`, `webp`, `ico`, `json`, `css` or another explicit format;
- `intendedUsage` - usage list, such as `web_header`, `browser_tab`, `social_profile`, `reader_mark` or `brand_sheet`;
- `background` - suitable backgrounds: `dark`, `light`, `transparent`;
- `dimensions` - width, height and unit if applicable;
- `checksum` - file checksum for change detection once generated;
- `exportRule` - rule or script version that produced the file;
- `approval` - approval state, approver and timestamp;
- `notes` - human notes.

## Source master fields

A source master should record:

- `id`;
- `type`;
- `version`;
- `path`;
- `format`;
- `status`;
- `approvedBy`;
- `approvedAt`;
- `sourceNotes`.

Examples of future source masters:

- `artales-wordmark-primary`;
- `artales-logo-lockup-primary`;
- `artales-symbol-primary`;
- `artales-monogram-primary`.

## Export profile fields

An export profile should record:

- `id`;
- `sourceType`;
- `outputType`;
- `format`;
- `dimensions`;
- `background`;
- `namingRule`;
- `destinationPath`;
- `quality` if applicable;
- `usage`;
- `notes`.

Examples of future export profiles:

- favicon SVG;
- favicon PNG sizes;
- web header logo for dark background;
- web header logo for light background;
- social avatar;
- watermark;
- brand sheet.

## Runtime use

A file should not be treated as a runtime asset until it is generated from a locked source master, recorded in the manifest and explicitly marked as approved or runtime-ready.

## Future tooling

Generic validation and export tooling may later move to a separate Syrael or Identity Builder repository. The ARTales manifest remains project-specific and versioned with ARTales.
