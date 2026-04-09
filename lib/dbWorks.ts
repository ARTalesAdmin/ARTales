import { supabase } from "./supabase"

export type WorkOriginType =
  | "public_domain"
  | "original"
  | "translation"
  | "other"

export type WorkStatus = "draft" | "review" | "published" | "archived"

export type WorkSourceLabel = "gutenberg" | "web" | "manual" | "original"

export type WorkAuthorRef = {
  id: string
  name: string
  slug: string
  bio?: string | null
} | null

export type WorkCollectionRef = {
  id: string
  title: string
  slug: string
  description?: string | null
} | null

export type GalleryWorkItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  canonical_language: string
  origin_type: WorkOriginType
  status: WorkStatus
  author: WorkAuthorRef
  collection: WorkCollectionRef
}

export type WorkDetailItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  content: string
  canonical_language: string
  origin_type: WorkOriginType
  source_label: WorkSourceLabel
  source_reference: string | null
  status: WorkStatus
  author: WorkAuthorRef
  collection: WorkCollectionRef
}

type RawRelationAuthor =
  | {
      id: unknown
      name: unknown
      slug: unknown
      bio?: unknown
    }
  | null
  | undefined

type RawRelationCollection =
  | {
      id: unknown
      title: unknown
      slug: unknown
      description?: unknown
    }
  | null
  | undefined

type RawGalleryWorkRow = {
  id: unknown
  title: unknown
  slug: unknown
  subtitle: unknown
  summary: unknown
  canonical_language: unknown
  origin_type: unknown
  status: unknown
  authors?: RawRelationAuthor | RawRelationAuthor[]
  collections?: RawRelationCollection | RawRelationCollection[]
}

type RawWorkDetailRow = {
  id: unknown
  title: unknown
  slug: unknown
  subtitle: unknown
  summary: unknown
  content: unknown
  canonical_language: unknown
  origin_type: unknown
  source_label: unknown
  source_reference: unknown
  status: unknown
  authors?: RawRelationAuthor | RawRelationAuthor[]
  collections?: RawRelationCollection | RawRelationCollection[]
}

function normalizeAuthorRelation(
  value: RawRelationAuthor | RawRelationAuthor[] | undefined
): WorkAuthorRef {
  const relation = Array.isArray(value) ? value[0] : value

  if (!relation) return null

  return {
    id: String(relation.id),
    name: String(relation.name),
    slug: String(relation.slug),
    bio: relation.bio == null ? null : String(relation.bio),
  }
}

function normalizeCollectionRelation(
  value: RawRelationCollection | RawRelationCollection[] | undefined
): WorkCollectionRef {
  const relation = Array.isArray(value) ? value[0] : value

  if (!relation) return null

  return {
    id: String(relation.id),
    title: String(relation.title),
    slug: String(relation.slug),
    description:
      relation.description == null ? null : String(relation.description),
  }
}

function mapGalleryWork(row: RawGalleryWorkRow): GalleryWorkItem {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    summary: String(row.summary),
    canonical_language: String(row.canonical_language),
    origin_type: row.origin_type as WorkOriginType,
    status: row.status as WorkStatus,
    author: normalizeAuthorRelation(row.authors),
    collection: normalizeCollectionRelation(row.collections),
  }
}

function mapWorkDetail(row: RawWorkDetailRow): WorkDetailItem {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    summary: String(row.summary),
    content: String(row.content),
    canonical_language: String(row.canonical_language),
    origin_type: row.origin_type as WorkOriginType,
    source_label: row.source_label as WorkSourceLabel,
    source_reference:
      row.source_reference == null ? null : String(row.source_reference),
    status: row.status as WorkStatus,
    author: normalizeAuthorRelation(row.authors),
    collection: normalizeCollectionRelation(row.collections),
  }
}

export async function getWorksForGallery(): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      origin_type,
      status,
      authors:primary_author_id (
        id,
        name,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug
      )
    `)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("DB error in getWorksForGallery:", error)
    throw new Error(`Failed to load gallery works: ${error.message}`)
  }

  return (data ?? []).map((row) => mapGalleryWork(row as RawGalleryWorkRow))
}

export async function getWorkBySlug(
  slug: string
): Promise<WorkDetailItem | null> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      content,
      canonical_language,
      origin_type,
      source_label,
      source_reference,
      status,
      authors:primary_author_id (
        id,
        name,
        slug,
        bio
      ),
      collections:collection_id (
        id,
        title,
        slug,
        description
      )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (error) {
    console.error("DB error in getWorkBySlug:", error)
    throw new Error(`Failed to load work detail: ${error.message}`)
  }

  if (!data) return null

  return mapWorkDetail(data as RawWorkDetailRow)
}

export async function getPublishedWorksByAuthorId(
  authorId: string
): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      origin_type,
      status,
      authors:primary_author_id (
        id,
        name,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug
      )
    `)
    .eq("primary_author_id", authorId)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("DB error in getPublishedWorksByAuthorId:", error)
    throw new Error(`Failed to load author's works: ${error.message}`)
  }

  return (data ?? []).map((row) => mapGalleryWork(row as RawGalleryWorkRow))
}

export async function getPublishedWorksByCollectionId(
  collectionId: string
): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      origin_type,
      status,
      authors:primary_author_id (
        id,
        name,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug
      )
    `)
    .eq("collection_id", collectionId)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("DB error in getPublishedWorksByCollectionId:", error)
    throw new Error(`Failed to load collection works: ${error.message}`)
  }

  return (data ?? []).map((row) => mapGalleryWork(row as RawGalleryWorkRow))
}