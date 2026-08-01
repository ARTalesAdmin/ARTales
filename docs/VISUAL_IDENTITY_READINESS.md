# Visual Identity Readiness

This document defines the readiness model for the ARTales Visual Identity Builder Lite pilot.

The scope is intentionally limited to visual identity. It does not lock the full ARTales brand, message house, legal policy, product strategy or wider Syrael governance model.

## Purpose

The readiness model answers a simple question: what is still missing before a visual identity can be treated as a locked, reusable and exportable pack?

It prevents reference material from being mistaken for production masters.

## Scope

Included:

- wordmark;
- logo lockup;
- symbol or mark;
- monogram;
- color palette;
- typography;
- graphic motifs;
- backgrounds and textures;
- export profiles;
- brand sheet;
- visual approval state.

Excluded from this model:

- full message house;
- launch messaging;
- editorial policy;
- legal policy;
- finance;
- people or HR;
- IT or AI system governance;
- Domain Core approval tooling beyond a placeholder approval owner.

Wider brand and identity documents can be used as context references. They are not directly locked by this visual identity readiness checklist.

## Readiness states

### missing

The required item is not available yet.

### reference

There is useful material, such as a sketch, moodboard, raster image, concept board or prior generative output. It can guide decisions, but it is not a production source.

Reference material is not a production master.

### draft

A working definition exists, but it has not been selected or approved as final.

### candidate

The item is ready for human review and could become approved after a decision.

### approved

A human owner has approved the item as the correct input. It may still need technical preparation before it becomes a locked master.

### locked

The item is a versioned source of truth. Locked masters can be used to generate exports and token seeds.

## Input types

Expected input types include:

- `text_reference`;
- `visual_reference`;
- `raster_reference`;
- `vector_master`;
- `color_definition`;
- `typography_definition`;
- `export_profile`;
- `approval_record`;
- `generated_export`;
- `runtime_asset`.

## Project-specific and reusable layers

Project-specific visual identity data should live with the project that uses it. For ARTales, that means `brand/artales/` in this repository.

Generic tooling may later move to a separate Syrael or Identity Builder repository. That future tooling can validate manifests, generate exports and render readiness checklists, but the approved ARTales masters and manifests should remain versioned with ARTales.

## ARTales current direction

The current ARTales materials provide a strong visual direction and cultural context, but they should not yet be treated as a locked Brand Pack v1.

Known gaps before lock include:

- selected primary logo and secondary variants;
- vector masters;
- transparent variants;
- final color token roles;
- typography decision and license notes;
- clear space and minimum size rules;
- export profiles;
- do-not-use rules;
- brand sheet;
- explicit approval record.

## Lock rule

A visual identity pack can be locked only when required blocks are approved or intentionally deferred, source masters are present where needed, export profiles are defined, and a human approval record exists.

Generated exports should come from locked masters, not directly from reference images.
