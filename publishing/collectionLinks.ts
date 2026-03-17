export type CollectionLink = {
  id: string
  collectionId: string
  workId: string
}

export const collectionLinks: CollectionLink[] = [
  {
    id: "link-dracula-gothic",
    collectionId: "collection-gothic-classics",
    workId: "work-dracula",
  },
  {
    id: "link-dracula-public-domain",
    collectionId: "collection-public-domain",
    workId: "work-dracula",
  },
  {
    id: "link-pride-public-domain",
    collectionId: "collection-public-domain",
    workId: "work-pride-and-prejudice",
  },
  {
    id: "link-sherlock-public-domain",
    collectionId: "collection-public-domain",
    workId: "work-sherlock-holmes",
  },
  {
    id: "link-dracula-cz-artales",
    collectionId: "collection-artales-layers",
    workId: "work-dracula-cz-translation",
  }
]