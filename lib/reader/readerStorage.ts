import {
  defaultReaderSettings,
  normalizeReaderSettings,
  type ReaderSettings,
} from "./readerSettings";

export type ReaderProgress = {
  slug: string;
  mode: "preview" | "full";
  progressPercent: number;
  scrollY: number;
  pageIndex?: number;
  pageCount?: number;
  layoutMode?: "pagedFlow" | "spread" | "scroll" | "page";
  updatedAt: string;
};

export type ReaderBookmark = {
  slug: string;
  mode: "preview" | "full";
  progressPercent: number;
  scrollY: number;
  pageIndex?: number;
  pageCount?: number;
  layoutMode?: "pagedFlow" | "spread" | "scroll" | "page";
  createdAt: string;
};

export const readerNoteColors = ["gold", "blue", "green", "rose", "violet"] as const;
export type ReaderNoteColor = (typeof readerNoteColors)[number];

export type ReaderNote = {
  id: string;
  slug: string;
  userId?: string | null;
  title?: string | null;
  body?: string | null;
  color: ReaderNoteColor;
  progressPercent: number;
  scrollY: number;
  pageIndex?: number;
  pageCount?: number;
  layoutMode?: "pagedFlow" | "spread" | "scroll" | "page";
  createdAt: string;
  updatedAt: string;
  source: "local" | "legacy" | "synced";
};

const settingsKey = "artales.reader.settings";
const savedWorksKey = "artales.reader.savedWorks";

export function getReaderProgressKey(slug: string) {
  return `artales.reader.progress:${slug}`;
}

export function getReaderBookmarkKey(slug: string) {
  return `artales.reader.bookmark:${slug}`;
}

export function getReaderNotesKey(slug: string) {
  return `artales.reader.notes:${slug}`;
}

export function getReaderLegacyNoteImportKey(slug: string) {
  return `artales.reader.notesLegacyImported:${slug}`;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadReaderSettings(): ReaderSettings {
  if (typeof window === "undefined") return defaultReaderSettings;
  return normalizeReaderSettings(
    safeParse(window.localStorage.getItem(settingsKey)),
  );
}

export function saveReaderSettings(settings: ReaderSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function loadReaderProgress(slug: string): ReaderProgress | null {
  if (typeof window === "undefined") return null;
  return normalizeReaderProgress(
    window.localStorage.getItem(getReaderProgressKey(slug)),
    slug,
  );
}

export function normalizeReaderProgress(
  value: string | ReaderProgress | null,
  slug: string,
): ReaderProgress | null {
  const parsed = typeof value === "string" ? safeParse<unknown>(value) : value;
  if (!parsed || typeof parsed !== "object") return null;
  const progress = parsed as Partial<ReaderProgress>;
  const updatedAt = Date.parse(progress.updatedAt ?? "");
  const validLayout = progress.layoutMode === undefined ||
    ["pagedFlow", "spread", "scroll", "page"].includes(progress.layoutMode);
  if (
    progress.slug !== slug ||
    (progress.mode !== "preview" && progress.mode !== "full") ||
    !Number.isFinite(progress.progressPercent) || progress.progressPercent! < 0 ||
    progress.progressPercent! > 100 || !Number.isFinite(progress.scrollY) ||
    (progress.pageIndex !== undefined && (!Number.isInteger(progress.pageIndex) || progress.pageIndex < 0)) ||
    (progress.pageCount !== undefined && (!Number.isInteger(progress.pageCount) || progress.pageCount < 0)) ||
    !validLayout ||
    !Number.isFinite(updatedAt)
  ) return null;
  return progress as ReaderProgress;
}

export function saveReaderProgress(progress: ReaderProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getReaderProgressKey(progress.slug),
    JSON.stringify(progress),
  );
}

export function loadReaderBookmark(slug: string): ReaderBookmark | null {
  if (typeof window === "undefined") return null;
  return safeParse<ReaderBookmark>(
    window.localStorage.getItem(getReaderBookmarkKey(slug)),
  );
}

export function saveReaderBookmark(bookmark: ReaderBookmark) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getReaderBookmarkKey(bookmark.slug),
    JSON.stringify(bookmark),
  );
}

export function clearReaderBookmark(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getReaderBookmarkKey(slug));
}

function isReaderNote(value: unknown): value is ReaderNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<ReaderNote>;
  return typeof note.id === "string" && typeof note.slug === "string" &&
    typeof note.createdAt === "string" && typeof note.updatedAt === "string";
}

export function loadReaderNotes(slug: string, importedTitle: string): ReaderNote[] {
  if (typeof window === "undefined") return [];
  const stored = safeParse<unknown[]>(window.localStorage.getItem(getReaderNotesKey(slug)));
  const notes = Array.isArray(stored) ? stored.filter(isReaderNote) : [];
  const legacy = loadReaderBookmark(slug);
  const legacyImportKey = getReaderLegacyNoteImportKey(slug);
  const legacyAlreadyImported = window.localStorage.getItem(legacyImportKey) === "1";
  if (legacy && !legacyAlreadyImported) {
    const timestamp = legacy.createdAt || new Date().toISOString();
    notes.push({
      id: crypto.randomUUID(),
      slug,
      title: importedTitle,
      body: null,
      color: "gold",
      progressPercent: legacy.progressPercent,
      scrollY: legacy.scrollY,
      pageIndex: legacy.pageIndex,
      pageCount: legacy.pageCount,
      layoutMode: legacy.layoutMode,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "legacy",
    });
    saveReaderNotes(slug, notes);
    // Keep the old bookmark as a backup, but persist migration completion
    // separately because account sync normalizes the imported note to "synced".
    window.localStorage.setItem(legacyImportKey, "1");
  }
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveReaderNotes(slug: string, notes: ReaderNote[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getReaderNotesKey(slug), JSON.stringify(notes));
}

export function getSavedWorks(): string[] {
  if (typeof window === "undefined") return [];
  const value = safeParse<string[]>(window.localStorage.getItem(savedWorksKey));
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

export function isWorkSaved(slug: string) {
  return getSavedWorks().includes(slug);
}

export function setWorkSaved(slug: string, saved: boolean) {
  if (typeof window === "undefined") return;
  const current = new Set(getSavedWorks());
  if (saved) current.add(slug);
  else current.delete(slug);
  window.localStorage.setItem(savedWorksKey, JSON.stringify([...current]));
}
