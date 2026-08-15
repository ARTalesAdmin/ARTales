# Reader Phase 4 — markers and note navigation polish v0.1

## UX problem and approach

Saved notes previously existed only in the compact menu, so a page did not visibly read as a saved place and larger collections produced a nested scrolling list. This develop-first polish adds a slim, theme-compatible marker inside the paper margin. A page with several notes uses one marker with a count; its color follows the first or currently selected note on that page. In spread, the left sheet uses its left outside edge and the right sheet uses its right outside edge. The marker is absolutely positioned and does not alter prose, reflow content, or participate in pagination.

## Navigation and selection

The always-visible notes controls provide previous/current/next navigation in reading order: `pageIndex`, then `progressPercent`, then `createdAt`, all ascending. Navigation does not wrap and disables both empty and boundary actions. The first loaded note is the initial local UI selection. Adding, jumping from the list, using previous/next, or activating a marker all converge on the same select-and-jump behavior: the Reader moves to the note page, the index changes, and the matching list item and page marker are highlighted. Selection is conveyed with `aria-current`/`aria-pressed` as well as a quiet visual treatment and is not persisted.

## Notes list

The full list remains available below add and navigation controls. It is expanded by default for up to three notes and collapsed by default for larger collections. The toggle exposes `aria-expanded`; when collapsed the list is not rendered, so hidden actions cannot receive keyboard focus. A compact selected-note summary remains visible while collapsed. Previous/next still jumps without expanding the list. A page-marker click selects and jumps to the first note on that page, opens the compact Reader menu, expands the list, and highlights the selected item so the marker is a direct entry point rather than decoration. Jump and single-note delete remain available when expanded.

## Mobile and limitations

Markers stay within the paper boundary to avoid horizontal overflow and become narrower on small viewports. The count remains compact but the notes navigation is the primary mobile route. A multi-note marker consistently selects the first note on that page; individual notes remain reachable from navigation and the full list.

## Unchanged scope

Persistence, offline/reconnect sync, API, RLS, database schema, legacy import, progress/settings restore, account preferences, parser, page slicing, content blocks, and go-to-page are unchanged. There is no production promotion in this work.

## Develop preview checklist

- Open preview/full Reader in pagedFlow and spread; verify restore, page navigation and account preferences.
- Add one and several same-page notes; verify marker side, count, color, selection, text clearance and no overflow.
- Exercise previous/next, disabled boundaries, list jump, collapse/expand, add and single delete with keyboard and pointer.
- Click a page marker and verify that it selects/jumps to the first page note, opens the panel/list, updates the marker/list highlight and current/total indicator.
- Verify previous, next and list **Go to** use the same page jump and selection behavior in pagedFlow and spread, including while the list starts collapsed.
- Check light, script and dark themes plus a narrow mobile viewport.
- Reload signed-in and local/offline sessions; reconnect and confirm existing Phase 4 synchronization behavior.
- Confirm Czech uses **Poznámky**, English uses **Notes**, and no bookmark terminology appears in the new UI.

## Rollback

Revert the Phase 4 polish commit/PR. No data, schema, environment, storage-key, or API rollback is required; saved notes remain compatible with the preceding Phase 4 implementation.
