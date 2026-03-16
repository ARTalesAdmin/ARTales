export type EditionFormat =
  | "web"
  | "pdf"
  | "epub"
  | "print"
  | "annotated"

export type EditionStatus =
  | "draft"
  | "published"
  | "archived"

export type ProductType =
  | "digital_download"
  | "paperback"
  | "hardcover"
  | "subscription_access"

export type ProductStatus =
  | "active"
  | "inactive"
  | "archived"

export type CollectionStatus =
  | "active"
  | "archived"

export type Edition = {
  id: string
  workId: string
  title: string
  slug: string
  format: EditionFormat
  status: EditionStatus
  language: string
  versionId?: string
  createdAt: string
}

export type Product = {
  id: string
  editionId: string
  title: string
  slug: string
  productType: ProductType
  status: ProductStatus
  priceCzk?: number
  currency?: string
  createdAt: string
}

export type Collection = {
  id: string
  title: string
  slug: string
  description: string
  status: CollectionStatus
  createdAt: string
}