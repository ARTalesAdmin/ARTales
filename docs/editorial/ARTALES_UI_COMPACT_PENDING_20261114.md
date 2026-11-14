# Editorial interaction simplification, 2026-11-14

Reuses the existing publisher, author, collection and visual task functions; UI only. Candidate/author/collection forms expose `useFormStatus` state and disable repeat server-action submission, with live text "Ukládám změny. Není třeba klikat znovu." Cover and portrait uploads already have busy checks; the photo uploader now exposes visible pending status and disables removal while saving. The cover's success state hides retry/confirm unless a different old uploaded picture is selected or save failed.

Technical alt/caption editing is collapsed and visible only to admin, yet existing fields, stored values, accessibility fallbacks, Storage and evidence rules are preserved. Nonadmins see a file selector and task state, not alt/SEO/credits. Admin can expand advanced metadata. No schema/migration/RLS changes.

Werther is Ivana's manually originated work and its text assignments remain intact. The Raven's existing QA findings are NOT auto-resolved; QA evidence and Pavla's editorial review remain authoritative. No manufactured completion.
