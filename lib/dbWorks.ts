import { supabase } from "./supabase"
import { createClient } from "@/lib/supabase/server"
import { sanitizeWorkBlocks, type WorkBlock } from "@/lib/blocks"

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
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
}

export type WorkDetailItem = {
  id: string
  title: string
  slug: string
  subtitle: string | null
  summary: string
  content: string
  content_blocks: WorkBlock[]
  canonical_language: string
  origin_type: WorkOriginType
  source_label: WorkSourceLabel
  source_reference: string | null
  edition_title: string | null
  edition_version: string | null
  edition_language: string | null
  original_language: string | null
  edition_source_url: string | null
  edition_license: string | null
  edition_publisher: string | null
  publication_year: string | null
  isbn: string | null
  isbn_status: string
  isbn_note: string | null
  edition_note_public: string | null
  edition_note_internal: string | null
  contributor_summary: string | null
  status: WorkStatus
  author: WorkAuthorRef
  collection: WorkCollectionRef
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
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
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
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
  edition_title: string | null
  edition_version: string | null
  edition_language: string | null
  original_language: string | null
  edition_source_url: string | null
  edition_license: string | null
  edition_publisher: string | null
  publication_year: string | null
  isbn: string | null
  isbn_status: string
  isbn_note: string | null
  edition_note_public: string | null
  edition_note_internal: string | null
  contributor_summary: string | null
  status: WorkStatus
  primary_author_id: string | null
  collection_id: string | null
  content: string
  content_blocks: WorkBlock[]
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
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
  cover_image_request: unknown
  cover_image_path: unknown
  cover_image_alt: unknown
  cover_image_caption: unknown
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
  content_blocks: unknown
  canonical_language: unknown
  origin_type: unknown
  source_label: unknown
  source_reference: unknown
  edition_title: unknown
  edition_version: unknown
  edition_language: unknown
  original_language: unknown
  edition_source_url: unknown
  edition_license: unknown
  edition_publisher: unknown
  publication_year: unknown
  isbn: unknown
  isbn_status: unknown
  isbn_note: unknown
  edition_note_public: unknown
  edition_note_internal: unknown
  contributor_summary: unknown
  status: unknown
  cover_image_request: unknown
  cover_image_path: unknown
  cover_image_alt: unknown
  cover_image_caption: unknown
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
  edition_title: unknown
  edition_version: unknown
  edition_language: unknown
  original_language: unknown
  edition_source_url: unknown
  edition_license: unknown
  edition_publisher: unknown
  publication_year: unknown
  isbn: unknown
  isbn_status: unknown
  isbn_note: unknown
  edition_note_public: unknown
  edition_note_internal: unknown
  contributor_summary: unknown
  status: unknown
  primary_author_id: unknown
  collection_id: unknown
  content: unknown
  content_blocks: unknown
  cover_image_request: unknown
  cover_image_path: unknown
  cover_image_alt: unknown
  cover_image_caption: unknown
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
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path: row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt: row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
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
    content_blocks: mapRawContentBlocks(row.content_blocks),
    canonical_language: String(row.canonical_language),
    origin_type: row.origin_type as WorkOriginType,
    source_label: row.source_label as WorkSourceLabel,
    source_reference:
      row.source_reference == null ? null : String(row.source_reference),
    edition_title: row.edition_title == null ? null : String(row.edition_title),
    edition_version: row.edition_version == null ? null : String(row.edition_version),
    edition_language: row.edition_language == null ? null : String(row.edition_language),
    original_language: row.original_language == null ? null : String(row.original_language),
    edition_source_url: row.edition_source_url == null ? null : String(row.edition_source_url),
    edition_license: row.edition_license == null ? null : String(row.edition_license),
    edition_publisher: row.edition_publisher == null ? null : String(row.edition_publisher),
    publication_year: row.publication_year == null ? null : String(row.publication_year),
    isbn: row.isbn == null ? null : String(row.isbn),
    isbn_status: row.isbn_status == null ? "not_required" : String(row.isbn_status),
    isbn_note: row.isbn_note == null ? null : String(row.isbn_note),
    edition_note_public: row.edition_note_public == null ? null : String(row.edition_note_public),
    edition_note_internal: row.edition_note_internal == null ? null : String(row.edition_note_internal),
    contributor_summary: row.contributor_summary == null ? null : String(row.contributor_summary),
    status: row.status as WorkStatus,
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path: row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt: row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    author: normalizeAuthorRelation(row.authors),
    collection: normalizeCollectionRelation(row.collections),
  }
}

function mapRawContentBlocks(value: unknown): WorkBlock[] {
  return sanitizeWorkBlocks(value)
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
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
      content_blocks,
      canonical_language,
      origin_type,
      source_label,
      source_reference,
      edition_title,
      edition_version,
      edition_language,
      original_language,
      edition_source_url,
      edition_license,
      edition_publisher,
      publication_year,
      isbn,
      isbn_status,
      isbn_note,
      edition_note_public,
      edition_note_internal,
      contributor_summary,
      status,
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path: row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt: row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
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
      edition_title,
      edition_version,
      edition_language,
      original_language,
      edition_source_url,
      edition_license,
      edition_publisher,
      publication_year,
      isbn,
      isbn_status,
      isbn_note,
      edition_note_public,
      edition_note_internal,
      contributor_summary,
      status,
      cover_image_request,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
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
    edition_title: row.edition_title == null ? null : String(row.edition_title),
    edition_version: row.edition_version == null ? null : String(row.edition_version),
    edition_language: row.edition_language == null ? null : String(row.edition_language),
    original_language: row.original_language == null ? null : String(row.original_language),
    edition_source_url: row.edition_source_url == null ? null : String(row.edition_source_url),
    edition_license: row.edition_license == null ? null : String(row.edition_license),
    edition_publisher: row.edition_publisher == null ? null : String(row.edition_publisher),
    publication_year: row.publication_year == null ? null : String(row.publication_year),
    isbn: row.isbn == null ? null : String(row.isbn),
    isbn_status: row.isbn_status == null ? "not_required" : String(row.isbn_status),
    isbn_note: row.isbn_note == null ? null : String(row.isbn_note),
    edition_note_public: row.edition_note_public == null ? null : String(row.edition_note_public),
    edition_note_internal: row.edition_note_internal == null ? null : String(row.edition_note_internal),
    contributor_summary: row.contributor_summary == null ? null : String(row.contributor_summary),
    status: String(row.status) as WorkStatus,
    primary_author_id:
      row.primary_author_id == null ? null : String(row.primary_author_id),
    collection_id:
      row.collection_id == null ? null : String(row.collection_id),
    content: String(row.content ?? ""),
    content_blocks: mapRawContentBlocks(row.content_blocks),
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path: row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt: row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
  }
}