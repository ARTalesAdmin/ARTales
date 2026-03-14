import { Version } from "./types"

export const versions: Version[] = [
  {
    id: "version-dracula-v1",
    workId: "work-dracula",
    versionNumber: 1,
    content: `Chapter I

Jonathan Harker's Journal.

3 May. Bistritz.—Left Munich at 8:35 P.M...`,
    versionType: "published",
    isCurrent: true,
    createdAt: "2026-03-06",
  },
  {
    id: "version-pride-v1",
    workId: "work-pride-and-prejudice",
    versionNumber: 1,
    content: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.`,
    versionType: "published",
    isCurrent: true,
    createdAt: "2026-03-06",
  },
  {
    id: "version-sherlock-v1",
    workId: "work-sherlock-holmes",
    versionNumber: 1,
    content: `To Sherlock Holmes she is always the woman...`,
    versionType: "published",
    isCurrent: true,
    createdAt: "2026-03-06",
  },
  {
    id: "version-dracula-cz-v1",
    workId: "work-dracula-cz-translation",
    versionNumber: 1,
    content: `Kapitola I

Deník Jonathana Harkera.

3. května. Bystřice...`,
    versionType: "draft",
    isCurrent: true,
    createdAt: "2026-03-06",
  }
]