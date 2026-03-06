export type Work = {
  id: string
  title: string
  author: string
  year?: number
  language: string
  sourceType: "gutenberg" | "user" | "remix" | "commission"
  status: "free" | "in_process" | "closed"
  shortDesc: string
  tags: string[]
  text: string
}

export const works: Work[] = [
  {
    id: "dracula",
    title: "Dracula",
    author: "Bram Stoker",
    year: 1897,
    language: "en",
    sourceType: "gutenberg",
    status: "free",
    shortDesc: "A gothic novel about fear, blood, and the unknown.",
    tags: ["gothic", "horror", "classic"],
    text: `Chapter I

Jonathan Harker's Journal.

3 May. Bistritz.—Left Munich at 8:35 P.M...`
  },
  {
    id: "pride-and-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    year: 1813,
    language: "en",
    sourceType: "gutenberg",
    status: "free",
    shortDesc: "A classic novel of manners, love, and social tension.",
    tags: ["romance", "classic", "society"],
    text: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.`
  },
  {
    id: "sherlock-holmes",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    year: 1892,
    language: "en",
    sourceType: "gutenberg",
    status: "free",
    shortDesc: "Mystery stories featuring Sherlock Holmes and Dr. Watson.",
    tags: ["mystery", "detective", "classic"],
    text: `To Sherlock Holmes she is always the woman...`
  }
]