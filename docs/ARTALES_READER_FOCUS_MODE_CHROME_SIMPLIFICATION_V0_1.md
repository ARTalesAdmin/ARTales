# ARTales Reader — Focus Mode Chrome Simplification v0.1

## Release metadata

- **Summary:** Focus mode now renders only the Reader identity, work title, reading progress, and the control that exits focus mode. Bookmark and settings interactions remain available in the normal Reader.
- **Changed files:** `components/reader/ReaderToolbar.tsx`, `components/reader/ReaderClient.tsx`, `components/reader/reader.css`, this document, and a follow-up note in `docs/ARTALES_READER_READING_MODE_HEADER_OVERLAP_FIX_V0_1.md`.
- **Risk:** `medium` — this is a small, state-gated Reader UI change, but the Reader is a key user journey and needs mobile and desktop preview coverage.
- **Target:** `develop first`; this change is for sandbox preview and is not approved for automatic promotion to `main`.
- **DB:** `no`.
- **Env:** `no`.

## Product decision

Focus mode is primarily a reading surface, not a second place to manage the Reader. A reader who wants to manage a bookmark, change typography, theme, width, density, or layout mode, or leave the Reader first exits focus mode and then uses the unchanged normal Reader controls.

## Focus-mode chrome

Focus mode keeps:

- the existing ARTales Reader identity;
- the work title;
- the reading progress indicator, including the existing page range in page and spread modes;
- the clearly labelled button for exiting focus mode.

Focus mode conditionally omits:

- the bookmark button and expanded bookmark action group;
- the saved-bookmark marker/action in scroll content;
- the settings disclosure;
- the expanded settings panel;
- font-size, layout mode, theme, width, and density controls;
- bookmark actions, preview continuation, and the separate leave-Reader link from the settings action row;
- secondary mode and author metadata in the toolbar.

Page and spread navigation remains available because it is required to continue reading rather than to configure or leave the Reader.

## Normal Reader preservation

The controls are gated only by the existing focus-mode state. In normal mode, bookmark creation and saved-bookmark actions, settings disclosure, font/theme/width/density/layout controls, preview continuation, and the leave-Reader link render exactly as before. Their event handlers, storage format, and persistence behavior are unchanged. Exiting focus mode returns to that normal control set without resetting the expanded/collapsed settings preference.

## Accessibility

Hidden controls are conditionally omitted from the React tree rather than moved offscreen or made transparent. They therefore cannot receive keyboard focus while focus mode is active. The focus-mode exit control remains a native button with its existing visible label, pressed state, keyboard behavior, and handler. The work title is kept visible at narrow breakpoints as well as on desktop.

## Mobile and desktop layout

The existing responsive toolbar and progress layouts are retained. Removing the optional controls reduces wrapping and persistent chrome on both narrow and wide screens. The existing in-flow sticky toolbar treatment for page and spread modes continues to reserve the toolbar's actual height, and the existing scroll-mode focus layout remains unchanged. No paper width, page sizing, overflow, or pagination rules are modified.

## Relationship to the header-overlap fix

This is the planned UX follow-up to the separate reading-mode header-overlap fix. That fix remains responsible for ensuring page and spread content begins after the real toolbar height. This change only reduces what the toolbar renders in focus mode; it does not replace, revert, or broaden the overlap fix.

## Intentionally unchanged

- parser behavior and page slicing/pagination logic;
- work content and editor block models;
- bookmark data, actions, and persistence;
- Reader settings values, actions, and persistence;
- page/spread navigation and reading progress calculations;
- access, entitlement, media upload, Supabase, database, and environment behavior;
- package files and brand assets;
- public, account, member, and internal surfaces.

## Preview checklist

- [ ] Normal Reader mode: bookmark is visible.
- [ ] Normal Reader mode: settings disclosure is visible.
- [ ] Normal Reader mode: width, font, theme, and mode controls work.
- [ ] Normal Reader mode: leave Reader is still available.
- [ ] Focus mode: title is visible.
- [ ] Focus mode: progress is visible.
- [ ] Focus mode: exit focus mode is visible and keyboard accessible.
- [ ] Focus mode: bookmark controls and saved-bookmark marker are absent.
- [ ] Focus mode: settings disclosure and settings controls are absent.
- [ ] Focus mode: no omitted control is keyboard-focusable.
- [ ] Focus mode: scroll mode reads and progresses normally.
- [ ] Focus mode: page mode reads and navigates normally.
- [ ] Focus mode: spread mode reads and navigates normally.
- [ ] Mobile/narrow focus mode preserves the title and has no overlap.
- [ ] Desktop focus mode preserves the title and has no overlap.
- [ ] Exit focus mode returns to the normal Reader.
- [ ] Bookmark and settings controls return after exiting focus mode.
- [ ] No text is hidden behind the chrome.
- [ ] No horizontal overflow regression is present.

## Validation checklist

- [ ] `git diff --check` passes.
- [ ] Targeted ESLint passes for the changed TSX files.
- [ ] The changed CSS parses successfully.
- [ ] Changed-file audit contains no DB, env, package, asset, parser, pagination, persistence, public, account, member, or internal changes.
- [ ] Preview checklist is completed on the `develop` deployment before any production decision.

## Rollback path

Revert the single focus-mode chrome simplification commit or its PR. No database, environment, dependency, asset, bookmark, or settings migration needs reversal. After rollback, smoke-test focus-mode exit and the normal Reader bookmark/settings controls; the separate header-overlap fix remains in place.
