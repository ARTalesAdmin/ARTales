# ARTales small-size micro candidates v0.1

## Why this step exists

The approved ARTales standard symbol direction remains the source of truth. Human review found it acceptable at 32px and above, and acceptable at 24px when the viewer already knows the mark. At 16px, its delicate four-part interior feature loses separation and the symbol becomes too weak to identify reliably. This package therefore tests controlled, master-first optical simplifications specifically for tiny rendering.

## Relationship to the approved symbol

All three candidates are direct derivatives of the locked `symbol-pen-drop.master.v1.svg`. They preserve its outer pen-and-drop silhouette verbatim. Changes are limited to the central interior feature that collapses under pixel sampling; no new shape family, decoration, wordmark, or free reinterpretation is introduced.

The candidates are review artifacts, not replacements for the approved standard symbol. The existing standard direction remains appropriate from roughly 24/32px upward, subject to its recorded size limitations.

## Candidate set

| Candidate | Philosophy | Expected strength | Expected weakness |
| --- | --- | --- | --- |
| A | Minimal simplification, closest to master | Strongest fidelity: four familiar interior lozenges remain and receive slight optical weight. | The interior can still become crowded or indistinct at 16px. |
| B | Strong simplification for 16px | One enlarged diamond should produce the clearest interior signal at the smallest samples. | It removes the most master detail and therefore needs careful identity review. |
| C | Balanced compromise | Three enlarged forms retain a subdivided interior while reducing micro-detail. | Its reduced arrangement is less symmetrical than the locked master. |

## Review board

`brand/artales/small-size/micro-candidates/v0.1/artales-symbol-micro-review-board.v0.1.svg` places every candidate side by side at exact 16px, 20px, 24px, and 32px heights on both light and dark backgrounds. It is intended for human comparison only and does not select a winner.

Review should prioritize silhouette recognition first, then the survival and clarity of the interior feature. Candidate B deliberately defines the strongest simplification boundary; A defines the fidelity boundary; C tests the middle ground.

## Status and out of scope

This step does **not** create or approve:

- a locked micro master;
- a favicon or favicon integration;
- ICO, PNG, or other binary exports;
- public or runtime integration;
- app, component, CSS, metadata, or manifest changes;
- wordmark or lockup changes;
- database, environment, or Supabase changes.

All candidates remain `review_only` with `pending_human_review` status. A later explicit decision may select, revise, or reject a candidate. Production export and integration, if approved, must remain separate controlled work.

## Risk and rollback

- **Risk:** low — isolated SVG and documentation review assets only.
- **Target:** develop first.
- **Runtime impact:** none.
- **DB:** no.
- **Env:** no.
- **Rollback:** revert the candidate-set commit; no runtime, data, configuration, or generated binary cleanup is required.
