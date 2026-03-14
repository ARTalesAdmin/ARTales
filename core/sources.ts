import { Source } from "./types"

export const sources: Source[] = [
  {
    id: "source-dracula-gutenberg",
    workId: "work-dracula",
    sourceType: "gutenberg",
    sourceLabel: "Project Gutenberg",
    sourceReference: "Public domain source text",
  },
  {
    id: "source-pride-gutenberg",
    workId: "work-pride-and-prejudice",
    sourceType: "gutenberg",
    sourceLabel: "Project Gutenberg",
    sourceReference: "Public domain source text",
  },
  {
    id: "source-sherlock-gutenberg",
    workId: "work-sherlock-holmes",
    sourceType: "gutenberg",
    sourceLabel: "Project Gutenberg",
    sourceReference: "Public domain source text",
  },
  {
    id: "source-dracula-cz-derived",
    workId: "work-dracula-cz-translation",
    sourceType: "internal_project",
    sourceLabel: "ARTales translation layer",
    sourceReference: "Derived from Dracula public domain source text",
  },
]