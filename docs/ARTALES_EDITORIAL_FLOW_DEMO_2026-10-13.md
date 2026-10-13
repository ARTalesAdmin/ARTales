# ARTales editorial flow demonstration — 2026-10-13

Preview: `/preview/editorial-flow`. This is a **non-production synthetic walkthrough**, not editorial-system activation.

## Editor walkthrough

1. Open the preview (Vercel deployment authentication may apply).
2. On Candidates, select **Cesta za řekou**, click **Zahájit zpracování**.
3. See the bounded loading state and the **synthetic-only** component rights summary; no actual scan runs, no permission is granted.
4. Observe badge **1** beside the fake editor profile. Click the profile or Redakční práce to reach the demo inbox.
5. Open the one queued task and click visibly broken blocks in the right-hand Reader.
6. Write a note, click **Odeslat připomínku a opravit blok**. The deterministic fixture presentation corrects the selected block immediately. Original left-hand source never changes. The note isn't interpreted by AI.
7. Correct at least two blocks, click **Uložit a dokončit kontrolu**, return to the inbox and see **Dokončeno lokálně** and badge **0**.
8. Reset the walkthrough to allow the next editor to try.

## Safety and deliberately excluded

- Publicly reachable only in Vercel preview/dev, not production. No route under `/member`, no modifications to actual app header, profile, account, editor inbox, candidate records, or existing Reader.
- State exists only under versioned localStorage `artales:editorial-flow-demo:v1`, with strict parsing and fail-closed recovery. It is per browser, not per user; do not treat as a real notification, review history, audit log, signed revision or persistent record. Private-mode/storage-denied browser fails with an informative message.
- The single illustrative title `Cesta za řekou` reuses the existing project-authored synthetic exact-source fixture, avoiding Alice rights ambiguity. Three defects alter **presentation only** and cannot change source content. This is **not** free-text correction, OCR, live recomposition, a learned repair, or signed WorkBlock persistence.
- The rights summary is fabricated for demonstration and explicitly labeled as such. No Gutenberg source collection, AI inference, uploads, publication or rights clearance.
- No Supabase read/write/migration, no GitHub worker, no env variable, no extra paid sandbox/DB. No `main` merge or production deployment.

## Reviewer checklist

- Exact-head focused test and TypeScript/ESLint successful.
- Preview build READY; browser desktop/mobile check through the whole flow, including badge and automatic return.
- Refresh candidate/inbox/review and confirm local state persists; reset and verify the badge and repaired blocks clear.
- Directly open review with no task and confirm a route back to inbox, not an unauthorized workbench.
- Confirm production env returns 404 and no server access or real action is invoked.
- Check that unrelated current `/member/editorial-tasks`, existing candidate UI and `/preview/ingest-fixture` remain untouched.

**Risk:** medium (new isolated preview React UI), no backend or production code path modified.
**Target:** develop first, later release only by explicit architect authorization.
**DB:** no. **Env:** no.
**Rollback:** revert this branch/PR; local browser demo records can be cleared by resetting the UI. No DB rollback required.
**Limitations:** browser E2E and build are not claimed until checked. No actual editorial persistence.
