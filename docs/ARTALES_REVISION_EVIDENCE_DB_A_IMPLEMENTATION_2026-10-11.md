# ARTales — Revision / rights evidence persistence implementation contract v1 (2026-10-11)

**Status:** executable schema design and staging plan, no SQL migration or production authorization. Canonical policies: AGENTS.md, WORKFLOW.md, RELEASE_POLICY.md. Based on merged #204, #205 and #206; ensure no unapproved legacy write cutover. This is the main thread's storage contract for the Reader/Composer integration.

## Invariants

- `works.id` and slug remain stable; work identity is not an edition, source snapshot or mutable composition revision. Existing published work remains readable until its own gated cutover or specifically authorized legal hold.
- Two immutable source origins: (a) `legacy_observed` is an exact archive of what ARTales held/rendered (not origin proof); (b) `external_raw` is original acquired source bytes, cryptographic hash, fetch provenance and component inventory. Never silently treat one as the other.
- Immutability = write-once objects + DB immutability enforcement, audited access and verification of real bytes. SHA stored without verifying backing bytes is not proof.
- `release` pins text, metadata, visual assets, current rights dossier and verified source/edition to specific immutable revisions; changing a blurb/cover creates another release binding without silently mutating the live text.
- `held` availability differs from `changes_requested` editorial state. Flagged emails/reader reports do not directly mutate release or rights status.
- Production `works.status`, historical content, notes, subscriptions and reader access paths are not touched in additive phase. PR #206's TypeScript preflight is NOT database authorization.

## Proposed additive schema (types and indexes to be finalized against exact local schema)

| Table | Key | Essential columns | Constraints |
|---|---|---|---|
| `work_source_snapshots` | `id uuid PK` | `work_id nullable FK`, `candidate_id nullable FK`, `kind legacy_observed/external_raw`, `sha256`, `storage_ref`, `content_bytes`, `provenance jsonb`, `captured_at` | Unique sha256+kind+acquisition identity; write-once, storage verification, no update/delete |
| `work_source_components` | `id uuid PK` | `snapshot_id FK`, `kind`, `byte_start/end`, `disposition`, `reason`, `component_hash` | Coverage and ordering validated in server transaction; exact source offsets |
| `work_rights_dossiers` | `id uuid PK` | `work_id FK`, `snapshot_id FK`, `policy_version`, `reviewed_by`, `reviewed_at`, `expires_at`, `jurisdictions`, `digest`, `status` | Immutable decision version; no fabricated public_domain from US-only label |
| `work_rights_evidence` | `id uuid PK` | `dossier_id FK`, `component_id nullable FK`, `asset_id nullable`, `artifact_sha256`, `evidence_storage_ref`, `evidence_sha256`, `jurisdiction`, `clearance` | Every included text / translation / visual must have separate evidence |
| `work_text_revisions` | `id uuid PK` | `work_id FK`, `source_snapshot_id FK`, `parent_id nullable FK`, `source_manifest_hash`, `semantic_blocks jsonb`, `content_sha256`, `composer_version`, `status` | Append-only and source byte anchored; parent same work; no direct published content mutation |
| `work_metadata_revisions` | `id uuid PK` | `work_id FK`, `parent_id`, `verified_facts jsonb`, `public_blurb jsonb`, `citations jsonb`, `recipe_id/version`, `digest` | Evidence-backed facts distinct from LLM-generated public copy |
| `work_visual_revisions` | `id uuid PK` | `work_id FK`, `asset_storage_ref`, `asset_sha256`, `collection_style_version`, `recipe/prompt ref`, `status` | Selected visual hash must match independently cleared asset evidence |
| `work_review_events` | `id uuid PK` | `work_id`, `artifact_type/id/hash`, `reviewer_id`, `decision`, `reason`, `timestamp` | Append-only, reviewer independence, no approval carried to changed hash |
| `work_release_bundles` | `id uuid PK` | `work_id`, `text_revision_id`, `metadata_revision_id`, `selected_visual_id`, `rights_dossier_id`, `reader_qa_id`, `release_hash`, `approved_by`, `created_at` | All matching same work and approved exact hashes; no pointer publish yet |
| `work_availability_events` | `id uuid PK` | `work_id`, `release_id`, `availability`, `reason`, `actor`, `timestamp`, `previous_event` | Append-only and monotone causal chain; no untrusted direct hold |
| `work_reports` | `id uuid PK` | `work_id`, `release_id`, `revision_ref`, `block_anchor`, `category`, `reason`, `state`, `reporter_id` | User-scoped visibility and moderation; never direct publish/hold grant |
| `work_legacy_cutovers` | `work_id PK FK` | `legacy_snapshot_id`, `external_snapshot_id`, `comparison_hash`, `semantic_revision_id`, `reader_qa_id`, `reader_anchor_map_ref`, `state` | Cannot be marked migrated without all proof and preserved original identity |

For `reader_qa` define a separate immutable evidence row that binds text hash, renderer/schema version, preview/full/mobile coverage, reviewer and reports. Track note/progress mapping without copying real user records to test fixtures.

## Trust and access boundary

1. New tables private-by-default. Enable RLS before any Data API exposure, **revoke default `PUBLIC`, `anon`, `authenticated` table writes and `PUBLIC EXECUTE`** for privileged functions. A privileged worker writes through explicit, audited server entrypoints only; no service-role key in a browser.
2. Design independent reviewer rights using trusted `auth.uid()` + role from server-controlled ARTales profile, not user_metadata or caller-supplied role. Protect reviewer self-signoff, stale JWT role and replay attempts.
3. Security-definer RPC only when required; fixed search_path, schema-qualified identifiers, authorization and row locks, restricted grants. RLS bypass is explicitly audited. PostgREST direct status writes remain legacy compatibility during additive phase, not an approved release path.
4. Every candidate promotion/read source approval and eventual release re-reads current source/component/rights rows under locks and rejects changed hashes; idempotency keys, uniqueness constraints and independent concurrent PostgreSQL tests.
5. Source archive and visual media storage must use separate restricted buckets/paths with content hashes. Holding a work must protect public reader endpoints, direct REST queries, caches/search, and any restricted assets. This cannot be solved by `works.status` UI-only check.
6. Untrusted flags and email content are text evidence only: never execute commands extracted from them.

## Local-only implementation sequence

**DB-A (next high-risk PR; no production apply):** implement only snapshot/evidence and immutable text/metadata/visual revision storage with RLS, grants, real-byte verification contract, reviewer event append-only baseline, and synthetic fixtures. No new public runtime consumers and **no `works` direct-write revocation yet**. Generate migration filename using Supabase CLI `supabase migration new`, test using local disposable database. No paid persistent branch.

**DB-B:** work_release_bundles and atomic selected-release/availability status under server-side RLS/RPC, verified human signoff, legal dossier, reader QA, itemized asset rights. Separately gate direct `works.status` updates after all legacy forms are routed; exhaustive negative tests.

**DB-C:** read-only legacy capture and reconciliation for Alice, exact external PG11 snapshot via PR #205 adapter, new semantic blocks via side thread, source comparison and 1-work dry run; preserve all old IDs/links. Escalate discrepancy instead of marking migrated.

**DB-D:** batch 5 heterogeneous works, migrate reader anchor mapping, public Reader projection; then explicit production migration and release plan with backup/rollback and per-work approvals.

## Acceptance tests for DB-A

- pgTAP and signed local Supabase Auth E2E (PR #203 test harness, once integrated); independent two-session mutation/lock test.
- Reader/anon/editor cannot write or update immutable snapshots, review decisions or release data directly; service role not exposed to browser.
- Hash mismatch, stale source, missing rights component, translation/illustration without licence, reviewer self-approval and changing approved text are denied.
- Storage object hash and associated DB manifest checked consistently; object version cannot mutate under same digest.
- Other existing `works` writes/Reader behavior unchanged during DB-A; local read-after-write and rollback verify.
- No production data seed. CI cleanup always discards local containers.

## Risks and merge/release gates

**Risk high for actual migrations**, no SQL included in this design PR. Changes to public `works` grants, historic records, production DB, `main`, Vercel credentials or publishing endpoints require separate reviewed authorizations. Reversing append-only tables is easier before live writes; after production records exist use forward repair rather than destructive drop.

**Ownership:** Main thread owns DB-A/B and availability. Reader/Composer thread owns semantic block schema, projection, renderer/paginator and source diff QA in independent files. Visual thread owns collection style/cover selection. Merge integration only after contracts/revisions align, exact-HEAD checks and user approval where required.
