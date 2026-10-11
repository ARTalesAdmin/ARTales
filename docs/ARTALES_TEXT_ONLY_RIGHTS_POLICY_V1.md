# Text-only rights decision v1 — Alice pilot

Decision separates **editorial draft eligibility** from **publication**. For the pinned English Gutenberg #11 source, Carroll (d. 1898) passes the basic CZ/EU term check; the immutable 2016 GITenberg byte snapshot and exact literary span are preserved. The source wrapper, Millennium Fulcrum front/tail matter, license and uncaptured cover are excluded from the new book. The result is `eligible_for_editorial_draft`, **never** release authorization.

Store `checked_at`, source URI, source and component SHA-256, included/excluded components and exclusions in the candidate snapshot. Translation, illustrations, novel editorial adaptations, unknown rights or changed source always require separate assessment and may block their own component without blocking unrelated original text. A component-specific specialist review is needed only for genuine ambiguity; no blanket lawyer gate for old original literary text.

Important: `assessAliceTextOnlyDraft` is specifically pinned to Gutenberg #11, not a generic public-domain adjudicator. It does not mutate the legacy `evaluateRightsScan` structural result (which remains `needs_specialist_review` until independent evidentiary records are archived); editorial eligibility and scan evidence completeness are separate statuses. The actual external source of digitization must be checked before release if substantive newly created material was introduced. Do not confuse absence of evidence with guaranteed freedom of a newer translation.

Risk: medium (legal policy, isolated pure function); target: develop first; DB: no; Env: no; rollback: revert PR. Verify pinned SHA, 12 chapters, exclusions, source mutation failure, TS and lint. No main, prod apply, reader cutover or release permission.
