# ARTales Reader mode, chrome and notes redesign audit v0.1

**Status:** design and technical audit only; no runtime decision is implemented by this document
**Target:** `develop first`
**Risk of this PR:** low (documentation only)
**Risk of the proposed Reader work:** high (critical reading path; deliver in isolated phases)
**DB:** no
**Env:** no

## 1. Executive recommendation

Make the calm reading surface the Reader default rather than a mode the reader must enter. Replace the public three-mode choice (`scroll`, `page`, `spread`) with:

1. **`pagedFlow` (default):** all existing sliced `ReaderPage` objects rendered as a vertical sequence of page-like sheets. The browser scrolls normally; the active sheet supplies page, progress, resume, bookmark and go-to-page state.
2. **`spread` (optional):** the existing two-sheet, step-by-two reading experience on suitable screens, using the same page array. On narrow screens it may render a single visible sheet, but it remains semantically spread mode and retains spread position.

Remove focus mode as a user-visible state. Its calmness becomes the baseline visual contract, without requesting browser fullscreen. Reduce the persistent chrome to identity/title and a progress/page row; put preferences, notes/bookmarks, spread selection and exit in one accessible menu. Add a compact go-to-page interaction only after `pagedFlow` has a reliable active-sheet contract.

Keep legacy layout values readable during migration: `scroll -> pagedFlow`, `page -> pagedFlow`, and `spread -> spread`. Write only the new values after normalization. Do not combine this work with changes to block slicing, tables, parser behavior or database sync.

## 2. Scope and audit sources

This audit inspected:

- `lib/reader/readerSettings.ts` (setting types, defaults and normalization);
- `lib/reader/readerStorage.ts` (local settings, progress and single bookmark records);
- `lib/reader/paginateBlocks.ts` (the shared heuristic page slicer);
- `components/reader/ReaderClient.tsx` (rendering, restoration, progress, navigation, focus and bookmark behavior);
- `components/reader/ReaderToolbar.tsx` (current chrome and controls);
- `components/reader/reader.css` (layout, focus, responsive and recent overflow rules);
- `app/account/settings/page.tsx` and `app/account/settings/actions.ts` (profile-backed reading preferences).

The account page stores profile preferences, while `ReaderClient` initializes from `loadReaderSettings()` in local storage and receives no profile preferences. The current code therefore exposes two preference stores without an explicit hydration/precedence bridge. That must be resolved before presenting account settings as authoritative Reader behavior.

## 3. Current state

### 3.1 Layout settings and defaults

`ReaderLayoutModeId` currently permits `scroll`, `page`, and `spread`. `defaultReaderSettings.layoutMode` is `scroll`. Settings use the single local-storage key `artales.reader.settings`; invalid layout values normalize to the default. `pageFit` still exists in the stored/type shape, but normalization always returns `paper`; the old screen-fit control has already been removed. `controlsCollapsed` persists the expanded/collapsed settings panel and also participates in focus-mode behavior.

Current representation:

| Mode | Content source | Position | Progress | Navigation |
| --- | --- | --- | --- | --- |
| `scroll` | Original unsliced `blocks`/fallback content in one paper | document `scrollY` | document scroll divided by scrollable document height | native vertical scroll |
| `page` | `paginateReaderBlocks()` result | zero-based `pageIndex` | `pageIndex / (pageCount - 1)` | side buttons and Left/Right/PageUp/PageDown, step 1 |
| `spread` | Same sliced page array | even, zero-based spread start index | spread start index divided by `pageCount - 1` | same controls, step 2 |

`readerPages` and `pageCount` are calculated for every mode from blocks plus all settings, even though scroll mode renders the original block stream. Width, density and font scale influence the slicer's estimated page budget, so changing any of them can change `pageCount` and page boundaries.

### 3.2 Progress and restoration

- Scroll progress uses the whole document (`documentElement.scrollHeight - innerHeight`), not the Reader paper alone. Sticky/fixed chrome and content outside the paper can therefore affect the percentage.
- Page progress is `100` for a one-page work; otherwise it is based on the zero-based active index. The first page reports `0%` and the last reports `100%`.
- Spread coerces an index to an even start. For an odd final page, progress can remain below `100%` because the final spread starts at `pageCount - 1` only when that index is even; the formula is based on a page index rather than completed/visible range.
- Full-mode progress is saved per slug in `artales.reader.progress:<slug>`. Scroll saves `scrollY`; page/spread save `pageIndex`, `pageCount`, layout and also copy the index into `scrollY`.
- Restoration is split into mutually exclusive scroll and paged effects. Scroll restoration rejects stored page/spread records. Paged restoration accepts only page/spread records with a numeric index; spread aligns it to an even page.
- A changed page count is handled only by clamping the old index. There is no stable content anchor, block ID or text anchor, so typography/content changes may resume at a different passage.

### 3.3 Desktop and mobile rendering

- `scroll` renders one continuous paper with original content.
- `page` renders one sliced page sheet and replaces it on page turns.
- `spread` renders two adjacent sliced sheets on wide layouts; the right sheet becomes a blank visual page when the work ends on an unmatched left page.
- Spread switches to a single-column presentation below the existing responsive breakpoint, while preserving the spread mode data and step semantics. Recent CSS adds explicit overflow containment and content-sized sheets on narrow screens.
- Page/spread use generated sheet header/footer page numbers, side navigation and turn animation. Scroll uses none of these.
- Focus mode is transient React state, requests browser fullscreen when possible, collapses controls, changes toolbar/stage positioning and suppresses some title metadata/bookmark UI. It is not a stored layout preference.

### 3.4 Current toolbar/chrome

The top row currently combines the ARTales lockup, mode label (`preview` or “online reader”), title, author, progress/page label, bookmark actions, focus toggle and settings toggle. An expanded second panel contains font size, layout mode, theme, width and density, then bookmark actions, preview continuation and exit. Bookmark commands can therefore appear in both rows. Responsive CSS has accumulated several generations of wrapping, focus and overflow corrections around this dense structure.

### 3.5 Current bookmark

There is exactly one `ReaderBookmark` per slug under `artales.reader.bookmark:<slug>`. Saving overwrites it; clearing deletes the key. It records slug, preview/full mode, percentage, `scrollY`, optional page fields/layout and creation time. In scroll mode a calculated marker is placed approximately within the paper; in page/spread the bookmark is an index. It has no ID, text, color, update time, content anchor, ordering, ownership or sync state.

### 3.6 Account reading settings

The account settings form currently stores theme, width, density, font scale and collapsed-controls alongside locale in the `profiles` table. All presentation is flat; there is no simple/advanced grouping, spread preference, notes setting or “show advanced controls in Reader” preference. The Reader's local settings and profile settings are not reconciled in the inspected path.

## 4. Target mode model

### 4.1 Semantics

Use this target type conceptually in the implementation phase:

```ts
type ReaderLayoutModeId = "pagedFlow" | "spread";
```

`pagedFlow` is not the old scroll mode renamed. It uses the sliced page array, renders every page in document order, and scrolls vertically between sheets. It therefore combines the spatial continuity of scroll with the addressable page model of page/spread. `spread` continues to use that same array and exposes an active spread start.

Recommended invariant shared by both modes:

```text
pageCount = readerPages.length
activePageIndex = clamped, zero-based index of the active/leading sheet
displayPage = activePageIndex + 1
progress = pageCount <= 1 ? 100 : activePageIndex / (pageCount - 1) * 100
```

For spread, the visible label should be `pages N–M / total`, navigation remains step 2, and “go to page N” should align to the spread containing N (normally `N - 1`, then even-align). Product should explicitly decide whether spread completion displays `100%` when the last visible spread contains the final page; recommendation: yes, calculate spread progress from the last visible page rather than only the start index.

For `pagedFlow`, select the active sheet with an `IntersectionObserver` over stable sheet elements/ref registrations. Prefer the sheet crossing a reading line below the chrome; use largest visible intersection only as a fallback. Update the active index without forced scrolling. Clicking/jumping should use `scrollIntoView` with a chrome-aware `scroll-margin-top`, and reduced-motion preference must be respected.

### 4.2 Compatibility and migration

Normalization should be the migration boundary, not a destructive one-time local-storage rewrite:

| Stored value | Normalized runtime value | Reason |
| --- | --- | --- |
| missing/invalid | `pagedFlow` | new calm default |
| `scroll` | `pagedFlow` | closest continuous-reading successor |
| `page` | `pagedFlow` | single-sheet experience is absorbed by vertical sheets |
| `spread` | `spread` | preserved second mode |
| `pagedFlow` | `pagedFlow` | new canonical value |

For at least one compatibility release, `normalizeReaderSettings` should accept legacy strings in an explicit legacy input union even though the canonical output type contains only new values. Do not leave legacy values in the exported canonical ID array used to render choices. Once loaded, save the normalized canonical value on the next ordinary settings write; do not require an eager migration flag.

Progress needs equivalent tolerant reading. Introduce a versioned position shape (recommended `version: 2`) while continuing to parse existing records:

- legacy scroll record: derive an approximate target page from `progressPercent` (`round(percent / 100 * (pageCount - 1))`) because its `scrollY` cannot address a newly sliced sheet; after render, scroll to that sheet;
- legacy page record: retain/clamp `pageIndex`, then use it as the `pagedFlow` active sheet;
- legacy spread record: retain/clamp and even-align for spread;
- a record whose saved mode differs from the current mode should still restore the same logical page, not be discarded;
- future records should store `pageIndex`, `pageCount`, canonical layout, percentage and, where available, a content anchor (block ID plus offset/fragment) to survive re-pagination.

The same mapping applies to the existing bookmark during its later migration. Never interpret legacy scroll `scrollY` as a page index.

### 4.3 Assumptions that break when scroll and page merge

1. **Two rendering sources:** scroll uses unsliced blocks/fallback; paged modes use sliced blocks and no fallback in individual pages. `pagedFlow` makes slicer output the default, so empty/staged/fallback behavior must be verified before rollout.
2. **Boolean `isPagedMode`:** today it means “do not listen to scroll; show one/two page navigation; restore index.” `pagedFlow` is simultaneously sliced and scroll-driven, so this boolean must be decomposed (for example `usesSlicedPages`, `usesDocumentFlow`, `usesDiscreteTurns`, `isSpread`).
3. **One active page in the DOM:** page mode can equate state with the sole rendered page. `pagedFlow` renders all sheets and must observe which is active without rerender loops.
4. **Scroll persistence:** document `scrollY` is not a stable logical page and current progress includes document geometry. The new mode needs sheet-index persistence and a fallback scroll offset only for visual refinement.
5. **Bookmark marker:** the approximate absolute marker is tied to one continuous paper. Each note should instead attach to a sheet/content anchor.
6. **Page count stability:** the heuristic slicer depends on typography settings and is not measured layout. A preference change can move content between pages, invalidating raw indices.
7. **Page controls:** side buttons and global arrow interception suit discrete turns, not native vertical flow. In `pagedFlow`, PageUp/PageDown and arrows must retain browser behavior; go-to-page is the explicit jump control.
8. **Preview CTA and footnotes:** rendering each slice separately can repeat or relocate renderer-level structures. Preview end state and footnote behavior need explicit regression coverage.
9. **CSS mode assumptions:** many selectors pair `layout-page` and `layout-spread`, while recent mobile overflow/focus fixes target those names. A new class cannot safely inherit behavior by simple rename; rules must be audited and consolidated in the runtime PR.

## 5. Header and chrome recommendation

### 5.1 Target hierarchy

**Top row**

- ARTales identity (link behavior should be explicit and not cause accidental reader exit);
- work title, with truncation/wrapping that does not overlap content.

**Second row**

- progress bar;
- page indicator (`Page N / total`, or spread range);
- compact, optional go-to-page trigger/input;
- one menu button for remaining actions.

**Menu**

- notes/bookmarks entry and add-note/bookmark action;
- theme;
- spread on/off (label it as a concrete view, not a three-way “reading mode”);
- settings entry;
- width, font size and density only when advanced Reader controls are enabled;
- continue full reading in preview when applicable;
- leave Reader.

Remove the focus toggle, browser-fullscreen request and focus-only CSS state as a separate product concept. Also remove “online reader”/mode labels that add chrome without helping orientation. Author can remain available in work context or menu, but the persistent header should prioritize title. Do not hide exit or notes solely because advanced controls are disabled.

### 5.2 Menu accessibility

Prefer a native popover/dialog pattern already supported by the application, or implement a button with `aria-expanded`, `aria-controls` and a labelled panel. Define initial focus, logical tab order, Escape close, outside-click behavior and focus return. Do not create an ARIA `menu` unless full menu keyboard semantics are implemented; a labelled popover containing ordinary buttons/forms is likely safer. The menu must not trap reading keyboard navigation after close.

## 6. Go to page

### 6.1 Feasibility

The Reader already has `pageIndex` and `pageCount` for the sliced page array, so page/spread jumps are straightforward. `pagedFlow` adds the missing link: DOM refs for every sheet and an observer-maintained active index. The feature should not ship against old scroll mode because its displayed percentage has no exact page target.

### 6.2 MVP interaction

- The page indicator is a button. Activating it reveals a small numeric input adjacent to progress (or a compact anchored popover on narrow screens).
- Input uses a visible label such as “Go to page”, `inputMode="numeric"`, `min=1`, `max=pageCount`, and announces the total in help text.
- Seed it with the current displayed page and select the value.
- **Enter** validates and confirms; **Escape** cancels, restores the prior value and returns focus to the trigger.
- Empty, non-integer, below-1 and above-total values do not navigate. Keep the editor open and show/announce an inline error; optionally clamp only after an explicit product decision, not silently.
- In `pagedFlow`, jump to the requested sheet and focus should normally remain on/return to the indicator rather than move into prose. In spread, jump to the containing spread and display its range.
- On mobile, use a numeric keyboard and a sufficiently large target; do not allow the input/menu to widen the viewport or obscure the title.
- Announce the resulting page/range with a polite live region. Do not announce every IntersectionObserver update while the reader naturally scrolls.

## 7. Account settings: simple and advanced

Keep site theme and interface language conceptually separate from Reader preferences. Within **Reading settings**, recommend:

### Simple (default presentation)

- Reader theme;
- notes/bookmarks entry or management link (not a claim that notes are synced until sync exists);
- optional “open in spread on larger screens” preference, after responsive semantics are finalized.

### Advanced (explicitly revealed)

- font size;
- reading width;
- density/line height (product copy should explain the effect);
- **Show advanced controls in Reader**.

Advanced values should always continue to affect rendering, even when their controls are hidden. The new boolean controls only whether font/width/density appear in the Reader menu. Theme, notes, exit and spread remain available. Default recommendation is `false` for a calm Reader; existing users can be grandfathered to `true` if preserving control discoverability is preferred.

Before implementation, define preference precedence:

1. authenticated profile is the durable baseline;
2. device-local changes may update the current session immediately;
3. authenticated changes should be persisted to the profile through an explicit, non-destructive API/action;
4. anonymous settings remain local and may be offered for import after sign-in;
5. conflicts use a documented timestamp/field strategy, not unconditional profile overwrite.

This likely needs a schema field for layout preference and advanced-controls visibility. That is **not approved by this audit**: any DB migration must be a separately authorized phase. If schema work is deferred, keep these preferences local and label that limitation clearly.

## 8. From one bookmark to multiple notes/bookmarks

### 8.1 Product model

Treat a bookmark as a note whose text is optional. A reader can create many entries per work, navigate them in document order, color-code them, delete one entry and jump to its anchored location. “Notes” can be the umbrella UI label; a textless entry is a bookmark.

Recommended local MVP envelope (illustrative, not runtime code):

```ts
type ReaderNoteCollectionV1 = {
  version: 1;
  slug: string;
  notes: Array<{
    id: string;
    kind: "bookmark" | "note";
    pageIndex: number;
    pageCountAtCreation: number;
    progressPercent: number;
    layoutModeAtCreation: "pagedFlow" | "spread";
    anchor?: { blockId: string; fragmentOffset?: number };
    text?: string;
    color: "gold" | "blue" | "green" | "rose";
    createdAt: string;
    updatedAt: string;
  }>;
};
```

Use a versioned per-work key such as `artales.reader.notes:v1:<slug>`. IDs should be collision-resistant and stable. Limit note text length and collection size explicitly; handle quota/write errors instead of implying persistence succeeded. Colors must use approved design tokens, have text labels, and never be the sole way to distinguish notes.

Sort navigation by resolved reading position, then creation time. The compact navigator should expose **Previous · current/total · Next**, disable controls at the boundaries (no wrap for MVP), and provide jump, edit text/color and delete-current actions. Individual deletion requires a clear confirmation/undo pattern and must not clear the entire collection. Empty, orphaned and invalid-anchor states need defined UI.

### 8.2 Legacy bookmark migration

On first notes load, if no versioned collection exists and a valid legacy `artales.reader.bookmark:<slug>` exists:

1. map page/spread `pageIndex` directly after clamping;
2. map scroll bookmarks from `progressPercent` to an approximate page, never from raw `scrollY`;
3. create one textless default-color bookmark with a new ID and preserve `createdAt` when valid;
4. write the new collection successfully before marking migration complete;
5. retain the legacy key for one compatibility release (or until a verified write), so rollback can still read it;
6. make migration idempotent with a deterministic migration marker/source to avoid duplicates.

### 8.3 Future account sync

Account sync should be a later, explicitly authorized data project. A server model will need user/work ownership, stable ID, anchor plus fallback page/percentage, text, color, created/updated/deleted timestamps and a revision or conflict strategy. Use tombstones or an equivalent deletion protocol for offline/multi-device correctness. Define privacy, export/deletion, authorization/RLS and quota behavior before schema design. Local-first records need a sync status and client-generated IDs so a sign-in/import cannot duplicate notes. Do not store note text in analytics or logs.

## 9. Safe implementation sequence

### Phase A — mode/model audit and docs (this PR)

**Tasks:** approve terminology, invariants, legacy mapping, chrome information architecture and phase boundaries. No runtime files.
**Exit gate:** product/engineering agree that `pagedFlow` uses current slicer output and that paginator/table changes are excluded.

**Preview/review checklist**

- [ ] Confirm this is proposal language, not a shipped-feature claim.
- [ ] Confirm all three legacy mappings and rollback compatibility.
- [ ] Confirm focus mode becomes default calmness, not a renamed toggle.
- [ ] Confirm DB/env/runtime are untouched.

### Phase B — implement `pagedFlow` default and `spread` only

**Tasks:** add canonical/legacy normalization; separate rendering capability flags; render all sliced sheets; add active-sheet observation; version progress; map old progress; keep spread and narrow-screen behavior; write canonical settings only. Do not redesign toolbar beyond the minimum mode selector compatibility required for testing.
**Suggested rollout:** isolated Reader PR into `develop`, with representative long/short/structured works in sandbox.

**Preview checklist**

- [ ] Fresh storage opens `pagedFlow`; stored scroll/page open at an approximately equivalent passage; stored spread stays spread.
- [ ] First, middle and last sheets report correct page/progress and resume after reload.
- [ ] Font/width/density changes do not produce blank, duplicated or unreachable content.
- [ ] Desktop spread advances by two, handles an odd last page and reaches complete progress.
- [ ] Mobile has no horizontal overflow at 360/390/560/720 px; long words, media, poems, letters, notes and newspaper blocks remain contained.
- [ ] Native vertical keyboard/touch scrolling works in flow; discrete keyboard turning works only in spread.
- [ ] Preview CTA, fallback/empty content, footnotes and reduced motion are verified.

### Phase C — simplify chrome and add go-to-page

**Tasks:** adopt two-row hierarchy; remove focus/fullscreen concept; add accessible popover; move actions; implement validated page jump/live announcement; remove obsolete focus rules only after visual comparison.
**Dependency:** stable active-sheet API from Phase B.

**Preview checklist**

- [ ] Identity/title never overlap content or controls across supported widths and zoom up to 200%.
- [ ] Menu opens/closes by pointer and keyboard, returns focus, has logical tab order and no keyboard trap.
- [ ] Go-to-page accepts 1 and final page; rejects empty, fractional, 0 and above-total input with announced error.
- [ ] Enter confirms, Escape cancels; mobile numeric keyboard and viewport remain usable.
- [ ] Spread jumps to the containing pair and labels the visible range.
- [ ] Exit, preview continuation, notes entry and all enabled preferences remain reachable.
- [ ] Browser fullscreen is never requested and no focus-mode label/state remains.

### Phase D — account simple/advanced settings

**Tasks:** agree local/profile precedence; group the settings UI; add advanced-controls visibility and optional spread preference. If new profile fields are required, stop for explicit SQL-migration approval and deliver schema/application changes in the approved order.
**Do not** silently imply that local and account values sync.

**Preview checklist**

- [ ] Simple view contains only agreed essentials and persists them using the documented store.
- [ ] Advanced values persist when the section/Reader controls are hidden.
- [ ] “Show advanced controls” changes only menu visibility, not typography values.
- [ ] Anonymous, newly signed-in and existing-profile precedence cases are tested.
- [ ] Czech/English copy, validation, success and failure states are reviewed.

### Phase E — notes/bookmarks model and UI

**Tasks:** first approve the local schema/migration and privacy limits; implement local multiple notes and navigation; separately design/authorize server sync. Avoid combining local MVP with a DB migration.
**Dependency:** stable sheet/content anchoring from Phase B.

**Preview checklist**

- [ ] A legacy scroll/page/spread bookmark migrates once and remains jumpable.
- [ ] Multiple textless/text notes can be added at distinct positions, ordered and navigated previous/current/next.
- [ ] Jump survives reload, layout switch and typography repagination as well as the available anchor permits.
- [ ] Each approved color has a text label and adequate contrast.
- [ ] One note can be deleted without deleting others; cancellation/undo works as designed.
- [ ] Invalid/corrupt records and local-storage quota failures fail safely and visibly.
- [ ] No note text enters logs/analytics; account sync is not claimed before it exists.

## 10. Risk register and mitigations

| Risk | Impact | Mitigation / gate |
| --- | --- | --- |
| Heuristic page slicing becomes the default content path | Missing, duplicated, awkwardly split or overflowing content | Freeze slicer scope in Phase B; test a representative block corpus; do not revive canceled table/pagination work |
| Progress semantics differ across flow/spread | Incorrect resume, last spread below 100%, noisy announcements | Shared active-page contract; explicit last-visible-page spread formula; unit tests around 0/1/odd/even counts |
| Stored settings/progress migration | Reader opens in wrong mode or passage | Tolerant normalize-on-read, versioned records, preserve legacy read path for rollback, test fixtures |
| Mobile overflow regression | Reader becomes unusable on phones | Retain recent containment intent; test fixed widths, zoom and pathological content before merge |
| Desktop spread regression | Pairing, sizing or navigation breaks | Preserve shared page array/even-index invariant; visual and keyboard regression at wide breakpoints |
| Observer instability in `pagedFlow` | Page indicator flickers or saves the wrong page | One reading-line algorithm, throttled persistence, deterministic tie-breaks, observer tests |
| Accessible menu/go-to-page | Lost focus, keyboard trap, invalid values silently accepted | Prefer ordinary popover controls; specified focus/Escape/error/live-region behavior; keyboard + screen-reader review |
| Page indices drift after settings/content changes | Notes/resume point to a nearby but wrong passage | Add content anchors and retain percent/index fallbacks; surface orphan state rather than deleting data |
| Local notes loss/quota | Reader believes notes are durable when they are not | Versioning, limits, caught writes, visible failure, export/sync strategy before promises |
| Future sync conflicts/privacy | Duplicates, resurrected deletes or exposed private text | Client IDs, revision/tombstone design, RLS/privacy review, no note text in telemetry |
| Account/local preference split | Controls appear saved but Reader disagrees | Define precedence and hydration contract before Phase D; honest UI copy |

## 11. Non-goals

This audit does **not**:

- change runtime code, CSS, components, routes, i18n, packages or assets;
- change database/schema, Supabase behavior or environment variables;
- implement `pagedFlow`, chrome, go-to-page, account grouping, notes or sync;
- refactor `paginateReaderBlocks`, parser behavior, tables or Reader table pagination;
- revive **v0.10.15k — Table Pagination & Generated Header Fix**;
- promise pixel-accurate print pagination, cross-device note sync or offline conflict resolution;
- merge anything into `develop` or `main`.

## 12. Rollback strategy

### This documentation PR

Revert its single documentation commit or remove this file. There is no runtime, data, DB or environment rollback.

### Future runtime phases

- Keep each phase in an independent PR and do not delete legacy normalization/read paths in the same release that introduces canonical values.
- Phase B rollback restores the old default/render modes while legacy settings/progress keys remain readable. Do not destructively rewrite or delete them during rollout.
- Phase C rollback restores the old toolbar/focus UI without changing position records.
- Phase D rollback restores the flat UI; preserve existing profile columns/values and never require a destructive down migration.
- Phase E local rollback reads the retained single-bookmark key. Do not remove the new notes collection on rollback. A future sync rollback must stop writes first and preserve server/local data for recovery.
- After every rollback, verify open, resume, navigation and overflow in both the default Reader and spread before considering the Reader stable.

## 13. Decision checklist before Phase B

- [ ] Approve canonical name `pagedFlow` (code) and calm reader-facing label/copy.
- [ ] Approve legacy setting and progress mapping.
- [ ] Approve active-sheet selection rule and spread completion semantics.
- [ ] Confirm current heuristic slicing is acceptable as the initial flow foundation.
- [ ] Confirm focus mode and browser fullscreen are removed, not retained as hidden preferences.
- [ ] Confirm advanced-control default and preference ownership are deferred to Phase D.
- [ ] Confirm local notes precede any separately approved account-sync/database work.
