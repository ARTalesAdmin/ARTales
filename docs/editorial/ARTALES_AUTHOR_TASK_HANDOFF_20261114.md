# ARTales author-task input/output handoff, 2026-11-14

**Producer:** linking an existing author stores a candidate-specific author ID. The `authors` table stores independent bilingual biography and portrait evidence.

**Consumer:** `author_bio` requires valid Czech and English texts, each 200–800 characters. `author_visual` requires a portrait path and alt text, with real Storage object evidence. Saving an author may attempt to finish either task independently, but **never** close an unfinished sibling. `artales_complete_editorial_task` and its database evidence trigger remain authoritative.

**Live evidence:** Carmilla has a linked existing author and full bios (526/586 characters). Its author bio task is claimed by Pavla, while the portrait is absent and the separate visual task remains with Ivana. The Raven has four open source-edition flags and its text QA belongs to Pavla; resolving these requires editor confirmation, not automated dismissal.

**Still pending:** publish RPC mismatch with bounded unique author matching; publish requirement for author tasks deliberately not created; cross-editor Snapshot Storage readback; and text/visual ownership policy for new tasks. This source-only patch intentionally does not change these database contracts.

**Verification:** independent bio/portrait readiness, wrong linked ID fails closed, DB guards stay in place, no mutations to unrelated tasks. Manual actor-specific test needed before production release.
