# ARTales small-size symbol review decision v0.1

## Summary

Human visual review accepts the v0.1 small-size symbol direction with size-dependent limitations. The candidates are a review-approved direction for contexts at 24px, where the symbol is already known, and for general use at 32px and above. This decision does not lock a production favicon or app-icon master and does not approve binary export or public/runtime integration.

## Source candidate set

This decision covers the review-only candidate set in `brand/artales/small-size/candidates/v0.1/`, described by `artales-small-size-candidates.v0.1.json`. The review board simulates the candidates at 16, 24, 32, 48, 64, and 128px.

No candidate SVG geometry or other visual asset is changed by this decision record.

## Human feedback

> Za mě je to přijatelné. Je tam v svg vždy 6 velikostí, první dvě, tedy ty nejmenší, jsou hraniční, na úplně nejmenší není moc dobře vidět, ta druhá nejmenší je přijatelnější, byť taky trochu hůř rozpoznatelná. 3-6 je ok. 2 je ok, pokud vím, na co se dívám.

## Interpretation by size

| Simulated size | Assessment | Interpretation |
| --- | --- | --- |
| 16px | Borderline; poor recognizability | The smallest rendering is not clearly readable. It should not be relied on unless a dedicated simplified micro-variant is created and reviewed. |
| 24px | Acceptable with context | The second-smallest rendering can work when viewers already know what they are looking at, but recognition remains reduced. |
| 32px and above | Acceptable | Simulated sizes 3–6 provide an acceptable direction for small-size use. |

## Decision and limitations

- The v0.1 small-size direction is accepted with limitations.
- The current candidates are review-approved as a direction for 24px contextual use and 32px-and-above general use.
- They are not a locked production favicon master or production app-icon master.
- They are not final binary favicon or app-icon outputs.
- No PNG, ICO, app-icon, or other binary generation is approved by this record.
- No asset placement under `public/`, metadata/manifest change, or runtime integration is approved by this record.
- A special simplified 16px micro-variant may be needed before the symbol is relied on at that size.

## Recommendation

- Treat 32px and above as the safe direction for general use.
- Use 24px only where the ARTales symbol is already recognizable from context.
- Do not rely on the current geometry at 16px; create and review a simplified micro-variant first if dependable 16px recognition is required.
- Keep master selection and production export deferred until separately and explicitly approved.

## Out of scope

- PNG, ICO, WEBP, JPG, app-icon, or other binary generation.
- Copying or integrating assets under `public/`.
- Runtime, app, component, style, metadata, or manifest integration.
- Locking a production favicon or app-icon master.
- Database, environment, or Supabase changes.

## Next steps

1. Optionally create a simplified 16px micro-variant candidate in a separate, explicit review task.
2. Later choose and lock a dedicated small-size master once explicitly approved.
3. Later generate PNG/ICO and app-icon outputs manually or through approved tooling.
4. Later perform public/runtime integration in a separate, explicit pull request.
