import { Edition } from "./types"

export const editions: Edition[] = [
  {
    id: "edition-dracula-web",
    workId: "work-dracula",
    title: "Dracula — Web Edition",
    slug: "dracula-web",
    format: "web",
    status: "published",
    language: "en",
    versionId: "version-dracula-v1",
    createdAt: "2026-03-16",
  },

  {
    id: "edition-dracula-cz-web",
    workId: "work-dracula-cz-translation",
    title: "Dracula — Český překlad (Web Edition)",
    slug: "dracula-cz-web",
    format: "web",
    status: "published",
    language: "cs",
    versionId: "version-dracula-cz-v1",
    createdAt: "2026-03-16",
  },

  {
    id: "edition-pride-web",
    workId: "work-pride-and-prejudice",
    title: "Pride and Prejudice — Web Edition",
    slug: "pride-web",
    format: "web",
    status: "published",
    language: "en",
    versionId: "version-pride-v1",
    createdAt: "2026-03-16",
  }
]