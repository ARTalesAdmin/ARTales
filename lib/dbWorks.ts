import { supabase } from "./supabase"
import { createClient } from "@/lib/supabase/server"
import type { WorkBlock } from "@/lib/blocks"

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

export type MemberWorkListItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  canonical_language: string
  status: WorkStatus
  origin_type: WorkOriginType
  author: {
    id: string
    name: string
    slug: string
  } | null
  collection: {
    id: string
    title: string
    slug: string
  } | null
}

export type WorkEditItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  canonical_language: string
  origin_type: WorkOriginType
  source_label: WorkSourceLabel
  source_reference: string | null
  status: WorkStatus
  primary_author_id: string | null
  collection_id: string | null
  content: string
  content_blocks: WorkBlock[]
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

type RawWorkEditRow = {
  id: unknown
  title: unknown
  slug: unknown
  subtitle: unknown
  summary: unknown
  canonical_language: unknown
  origin_type: unknown
  source_label: unknown
  source_reference: unknown
  status: unknown
  primary_author_id: unknown
  collection_id: unknown
  content: unknown
  content_blocks: unknown
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

function mapRawContentBlocks(value: unknown): WorkBlock[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null

      const raw = item as Record<string, unknown>

      return {
        id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
        type: String(raw.type ?? "paragraph") as WorkBlock["type"],
        content: typeof raw.content === "string" ? raw.content : "",
        editor_note:
          typeof raw.editor_note === "string" && raw.editor_note.trim() !== ""
            ? raw.editor_note
            : null,
      }
    })
    .filter((item): item is WorkBlock => item !== null)
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

export async function getWorksForMember(): Promise<MemberWorkListItem[]> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      status,
      origin_type,
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
    .order("title", { ascending: true })

  if (error) {
    console.error("DB error in getWorksForMember:", error)
    throw new Error(`Failed to load works for member: ${error.message}`)
  }

  return ((data ?? []) as RawGalleryWorkRow[]).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    summary: String(row.summary ?? ""),
    canonical_language: String(row.canonical_language),
    status: String(row.status) as WorkStatus,
    origin_type: String(row.origin_type) as WorkOriginType,
    author: (() => {
      const author = normalizeAuthorRelation(row.authors)
      return author
        ? {
            id: author.id,
            name: author.name,
            slug: author.slug,
          }
        : null
    })(),
    collection: (() => {
      const collection = normalizeCollectionRelation(row.collections)
      return collection
        ? {
            id: collection.id,
            title: collection.title,
            slug: collection.slug,
          }
        : null
    })(),
  }))
}

export async function getWorkForEditBySlug(
  slug: string
): Promise<WorkEditItem | null> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("works")
    .select(`
      id,
      title,
      slug,
      subtitle,
      summary,
      canonical_language,
      origin_type,
      source_label,
      source_reference,
      status,
      primary_author_id,
      collection_id,
      content,
      content_blocks
    `)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("DB error in getWorkForEditBySlug:", error)
    throw new Error(`Failed to load work for edit: ${error.message}`)
  }

  if (!data) return null

  const row = data as RawWorkEditRow

  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    summary: String(row.summary ?? ""),
    canonical_language: String(row.canonical_language),
    origin_type: String(row.origin_type) as WorkOriginType,
    source_label: String(row.source_label) as WorkSourceLabel,
    source_reference:
      row.source_reference == null ? null : String(row.source_reference),
    status: String(row.status) as WorkStatus,
    primary_author_id:
      row.primary_author_id == null ? null : String(row.primary_author_id),
    collection_id:
      row.collection_id == null ? null : String(row.collection_id),
    content: String(row.content ?? ""),
    content_blocks: mapRawContentBlocks(row.content_blocks),
  }
}