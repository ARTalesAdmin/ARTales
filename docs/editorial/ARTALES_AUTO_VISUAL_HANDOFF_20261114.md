# ARTales: automatic visual handoff and historical recovery, 2026-11-14

**Cover:** choosing a new image immediately uploads it, supplies a neutral accessible alt if absent, links using the existing actor-bound metadata RPC, independently reads back the exact link, then uses the evidence-guarded task completion RPC. Retry keeps the uploaded path without a second upload. Older orphan files retain an explicit selector.

**Portrait:** choosing a file for an existing author immediately uploads it, supplies a neutral alt when absent, persists only author portrait fields through existing authenticated author UPDATE RLS, checks Storage presence and DB readback, then closes only the upload actor's claimed `author_visual` task through the existing guarded RPC. No biography overwrite. The new-author form (author not yet inserted) retains its full-form save; after author creation, portrait editing uses the automatic path.

**Historical two-cover recovery:** The Great God Pan and The Sorrows of Young Werther had two identical ETag/size files per book, both uploaded by assigned editor Ivana. Authorized admin linked the original file, created candidate metadata when absent, wrote noninvented accessible alt, and completed each cover task. The task's original assignee remains Ivana, `completed_by` is truthfully the admin, and explicit audit events record provenance. No file deletion or fabricated editor activity.

**Accessibility:** Alternative text conveys the function/identity of the image to assistive tech and can be revised. Do not infer unseen visual details.
