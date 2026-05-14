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
  updatedAt: string;
};

export type ReaderBookmark = {
  slug: string;
  mode: "preview" | "full";
  progressPercent: number;
  scrollY: number;
  createdAt: string;
};

const settingsKey = "artales.reader.settings";
const savedWorksKey = "artales.reader.savedWorks";

export function getReaderProgressKey(slug: string) {
  return `artales.reader.progress:${slug}`;
}

export function getReaderBookmarkKey(slug: string) {
  return `artales.reader.bookmark:${slug}`;
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
