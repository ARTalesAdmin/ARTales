# ARTales Visual Pack v0.1 Candidate Spec

This document records the first confirmed candidate decisions for the ARTales visual identity. It is not a locked production brand pack. It is a controlled candidate baseline for preparing vector masters, export profiles and later design tokens.

## Scope

This specification covers only the visual identity pack:

- primary symbol
- primary logo lockup
- dark and light logo variants
- monogram role
- candidate palette
- texture/materiality rule
- missing items before locked masters

It does not define the full brand, message house, editorial policy, product strategy, legal structure or runtime web design.

## Source references

This candidate spec is based on the latest three provided logo references:

1. standalone gold pen/drop symbol on dark background;
2. gold symbol plus dark ARTales wordmark on warm paper background;
3. gold symbol plus gold ARTales wordmark on dark background.

These images are treated as candidate references, not production masters. They support the visual direction but do not replace clean SVG/vector masters.

## Confirmed candidate decisions

### 1. Primary symbol

**Decision:** the primary symbol candidate is the gold pen/drop mark.

The symbol reads as a pen nib up close and as a gold drop from distance. This makes it strong for ARTales because it connects writing, stories, cultural value and a memorable animated silhouette.

**Candidate status:** confirmed candidate.

**Recommended uses:** favicon base, avatar, app icon base, loading animation, standalone brand mark and possible watermark.

**Still missing before locked master:** SVG/vector master, transparent export, flat clean master, minimum size rule and small-size legibility test.

### 2. Primary logo

**Decision:** the primary logo candidate is the symbol on the left plus the ARTales wordmark on the right.

This horizontal lockup should be treated as the main candidate for official use, web header use, brand sheet use and presentation graphics.

**Candidate status:** confirmed candidate.

**Still missing before locked master:** SVG/vector master, transparent variants, exact symbol-to-wordmark ratio, spacing rule, clear-space rule and minimum size rule.

### 3. Dark variant

**Decision:** the dark variant candidate is gold symbol plus gold wordmark on a dark background.

This variant supports the calm cultural/gallery tone and should be the leading candidate for dark brand surfaces.

**Candidate status:** confirmed candidate direction.

### 4. Light variant

**Decision:** the light variant candidate is gold symbol plus dark wordmark on warm paper background.

This variant supports a literary, editorial and paper-like presentation.

**Candidate status:** confirmed candidate direction.

### 5. Monogram

**Decision:** the monogram remains a reserve candidate, not the primary mark.

The monogram should not replace the pen/drop symbol at this stage. It may later be useful for internal avatars, a seal-like secondary mark, small fallback uses or admin-only branding.

**Candidate status:** reserve candidate.

### 6. Texture

**Decision:** texture is a presentation layer, not the production master.

The references show gold depth, paper warmth and subtle materiality. This is suitable for presentation, marketing and high-touch visual surfaces. However, locked masters must also exist as clean, reproducible vector/flat assets.

**Candidate status:** confirmed candidate rule.

## Candidate palette

The following values are approximated from the raster references. They are suitable for candidate documentation and future testing, but are not locked design tokens yet.

| Candidate color | Hex | Intended role |
| --- | --- | --- |
| Ink / Night | `#0F1315` | main dark brand background |
| Deep Dark | `#141414` | alternate dark background / deep neutral |
| Paper | `#FDF3E2` | warm paper-like light background |
| Text Dark | `#272827` | dark wordmark or text on light background |
| Primary Gold | `#E0AA47` | primary gold identity accent candidate |
| Warm Gold | `#E3AA46` | warm highlight gold candidate |
| Darker Gold | `#D19738` | darker gold candidate for depth/shadow |
| Gold Shade | `#B58636` | support gold shade for presentation texture |

### Palette rules

- Gold is an accent, not a broad decorative surface.
- The first token implementation should use a small number of core colors.
- Derived gold shades can support depth and presentation, but should not create uncontrolled visual noise.
- Contrast checks are required before runtime use.

## Typography direction

The wordmark direction is a high-contrast literary serif with editorial and cultural character. It feels closer to a book/gallery identity than to a technical SaaS interface.

This direction is strong, but not technically locked. Before the wordmark becomes a production master, the project needs either:

- the exact font name and license status, or
- confirmation that the wordmark is custom lettering and will be stored as vector outlines.

For broader site typography, this candidate spec does not yet choose heading, body or UI fonts. ARTales is a reading platform, so site typography must be tested in long text, catalogue surfaces, account surfaces and reader-adjacent UI before final tokenization.

## Variant principle

The dark and light variants should be variants of the same underlying identity, not separate logos.

The geometry should stay the same:

- same primary symbol shape;
- same wordmark drawing;
- same primary lockup relationship;
- approved color changes based on background.

## What is not locked yet

The following items are still missing before ARTales can create a locked Visual Identity Pack v1:

- SVG/vector master for the primary symbol;
- SVG/vector master for the primary logo lockup;
- vector wordmark or confirmed custom lettering;
- transparent light and dark exports;
- final exact color tokens;
- font or lettering license confirmation;
- clear-space rule;
- minimum-size rule;
- export profiles;
- brand sheet;
- runtime usage in the website.

## Recommended next steps

1. Prepare or obtain clean SVG/vector masters for the primary symbol and primary logo lockup.
2. Confirm whether the wordmark is font-based or custom lettering.
3. Confirm final core color tokens after light/dark contrast checks.
4. Define export profiles before generating production assets.
5. Create a brand sheet after vector masters and candidate tokens are ready.
6. Only then proceed to token skeleton and runtime visual updates.

## Risk and production note

This candidate spec does not change the runtime website and does not approve final production masters. It records the current confirmed candidate direction so that future asset and token work can proceed in a controlled, reversible way.
