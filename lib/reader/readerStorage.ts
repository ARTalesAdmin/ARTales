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
  return safeParse<ReaderProgress>(
    window.localStorage.getItem(getReaderProgressKey(slug)),
  );
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
  if (legacy && !notes.some((note) => note.source === "legacy")) {
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
