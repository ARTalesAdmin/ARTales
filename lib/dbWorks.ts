import { supabase } from "./supabase"
import { createClient } from "@/lib/supabase/server"
import { sanitizeWorkBlocks, type WorkBlock } from "@/lib/blocks"
import type { TagType } from "@/lib/tagTypes"

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
  name_cs?: string | null
  name_en?: string | null
  slug: string
  bio?: string | null
  bio_cs?: string | null
  bio_en?: string | null
} | null

export type WorkCollectionRef = {
  id: string
  title: string
  slug: string
  description?: string | null
  title_cs?: string | null
  title_en?: string | null
  description_cs?: string | null
  description_en?: string | null
} | null

export type WorkTagRef = {
  id: string
  slug: string
  label_cs: string
  label_en: string | null
  type: TagType
} | null

export type GalleryWorkItem = {
  id: string
  title: string
  title_cs: string | null
  title_en: string | null
  slug: string
  subtitle: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  summary: string
  summary_cs: string | null
  summary_en: string | null
  canonical_language: string
  origin_type: WorkOriginType
  status: WorkStatus
  author: WorkAuthorRef
  collection: WorkCollectionRef
  collections: WorkCollectionRef[]
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
}

export type WorkDetailItem = {
  id: string
  title: string
  title_cs: string | null
  title_en: string | null
  slug: string
  subtitle: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  summary: string
  summary_cs: string | null
  summary_en: string | null
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
  collections: WorkCollectionRef[]
  tags: WorkTagRef[]
  cover_image_request: string | null
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
}

export type MemberWorkListItem = {
  id: string
  title: string
  title_cs: string | null
  title_en: string | null
  slug: string
  subtitle: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  summary: string
  summary_cs: string | null
  summary_en: string | null
  canonical_language: string
  status: WorkStatus
  origin_type: WorkOriginType
  author: {
    id: string
    name: string
    name_cs?: string | null
    name_en?: string | null
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
  title_cs: string | null
  title_en: string | null
  slug: string
  subtitle: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  summary: string
  summary_cs: string | null
  summary_en: string | null
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
  collection_ids: string[]
  tag_ids: string[]
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
      name_cs?: unknown
      name_en?: unknown
      slug: unknown
      bio?: unknown
      bio_cs?: unknown
      bio_en?: unknown
    }
  | null
  | undefined

type RawRelationCollection =
  | {
      id: unknown
      title: unknown
      slug: unknown
      description?: unknown
      title_cs?: unknown
      title_en?: unknown
      description_cs?: unknown
      description_en?: unknown
      is_public_visible?: unknown
    }
  | null
  | undefined

type RawRelationTag =
  | {
      id: unknown
      slug: unknown
      label_cs: unknown
      label_en?: unknown
      type: unknown
      is_public_visible?: unknown
    }
  | null
  | undefined

type RawGalleryWorkRow = {
  id: unknown
  title: unknown
  title_cs: unknown
  title_en: unknown
  slug: unknown
  subtitle: unknown
  subtitle_cs: unknown
  subtitle_en: unknown
  summary: unknown
  summary_cs: unknown
  summary_en: unknown
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
  title_cs: unknown
  title_en: unknown
  slug: unknown
  subtitle: unknown
  subtitle_cs: unknown
  subtitle_en: unknown
  summary: unknown
  summary_cs: unknown
  summary_en: unknown
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
  title_cs: unknown
  title_en: unknown
  slug: unknown
  subtitle: unknown
  subtitle_cs: unknown
  subtitle_en: unknown
  summary: unknown
  summary_cs: unknown
  summary_en: unknown
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
    name_cs: relation.name_cs == null ? null : String(relation.name_cs),
    name_en: relation.name_en == null ? null : String(relation.name_en),
    slug: String(relation.slug),
    bio: relation.bio == null ? null : String(relation.bio),
    bio_cs: relation.bio_cs == null ? null : String(relation.bio_cs),
    bio_en: relation.bio_en == null ? null : String(relation.bio_en),
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
    title_cs: relation.title_cs == null ? null : String(relation.title_cs),
    title_en: relation.title_en == null ? null : String(relation.title_en),
    description_cs:
      relation.description_cs == null ? null : String(relation.description_cs),
    description_en:
      relation.description_en == null ? null : String(relation.description_en),
  }
}

function normalizeTagRelation(
  value: RawRelationTag | RawRelationTag[] | undefined
): WorkTagRef {
  const relation = Array.isArray(value) ? value[0] : value

  if (!relation) return null

  return {
    id: String(relation.id),
    slug: String(relation.slug),
    label_cs: String(relation.label_cs),
    label_en: relation.label_en == null ? null : String(relation.label_en),
    type: String(relation.type) as TagType,
  }
}

function mapGalleryWork(row: RawGalleryWorkRow): GalleryWorkItem {
  return {
    id: String(row.id),
    title: String(row.title),
    title_cs: row.title_cs == null ? null : String(row.title_cs),
    title_en: row.title_en == null ? null : String(row.title_en),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    subtitle_cs: row.subtitle_cs == null ? null : String(row.subtitle_cs),
    subtitle_en: row.subtitle_en == null ? null : String(row.subtitle_en),
    summary: String(row.summary),
    summary_cs: row.summary_cs == null ? null : String(row.summary_cs),
    summary_en: row.summary_en == null ? null : String(row.summary_en),
    canonical_language: String(row.canonical_language),
    origin_type: row.origin_type as WorkOriginType,
    status: row.status as WorkStatus,
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    author: normalizeAuthorRelation(row.authors),
    collection: normalizeCollectionRelation(row.collections),
    collections: [],
  }
}

function mapWorkDetail(row: RawWorkDetailRow): WorkDetailItem {
  return {
    id: String(row.id),
    title: String(row.title),
    title_cs: row.title_cs == null ? null : String(row.title_cs),
    title_en: row.title_en == null ? null : String(row.title_en),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    subtitle_cs: row.subtitle_cs == null ? null : String(row.subtitle_cs),
    subtitle_en: row.subtitle_en == null ? null : String(row.subtitle_en),
    summary: String(row.summary),
    summary_cs: row.summary_cs == null ? null : String(row.summary_cs),
    summary_en: row.summary_en == null ? null : String(row.summary_en),
    content: String(row.content),
    content_blocks: mapRawContentBlocks(row.content_blocks),
    canonical_language: String(row.canonical_language),
    origin_type: row.origin_type as WorkOriginType,
    source_label: row.source_label as WorkSourceLabel,
    source_reference:
      row.source_reference == null ? null : String(row.source_reference),
    edition_title: row.edition_title == null ? null : String(row.edition_title),
    edition_version:
      row.edition_version == null ? null : String(row.edition_version),
    edition_language:
      row.edition_language == null ? null : String(row.edition_language),
    original_language:
      row.original_language == null ? null : String(row.original_language),
    edition_source_url:
      row.edition_source_url == null ? null : String(row.edition_source_url),
    edition_license:
      row.edition_license == null ? null : String(row.edition_license),
    edition_publisher:
      row.edition_publisher == null ? null : String(row.edition_publisher),
    publication_year:
      row.publication_year == null ? null : String(row.publication_year),
    isbn: row.isbn == null ? null : String(row.isbn),
    isbn_status: row.isbn_status == null ? "not_required" : String(row.isbn_status),
    isbn_note: row.isbn_note == null ? null : String(row.isbn_note),
    edition_note_public:
      row.edition_note_public == null ? null : String(row.edition_note_public),
    edition_note_internal:
      row.edition_note_internal == null ? null : String(row.edition_note_internal),
    contributor_summary:
      row.contributor_summary == null ? null : String(row.contributor_summary),
    status: row.status as WorkStatus,
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    author: normalizeAuthorRelation(row.authors),
    collection: normalizeCollectionRelation(row.collections),
    collections: [],
    tags: [],
  }
}

function mapRawContentBlocks(value: unknown): WorkBlock[] {
  return sanitizeWorkBlocks(value)
}

type RawWorkContentBlockBatchRow = {
  blocks: unknown
  metadata?: unknown
}

function getInsertionAnchorFromBatchMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return { hasExplicitAnchor: false, insertAfterBlockId: null }
  }

  if (!Object.prototype.hasOwnProperty.call(metadata, "insert_after_block_id")) {
    return { hasExplicitAnchor: false, insertAfterBlockId: null }
  }

  const value = (metadata as { insert_after_block_id?: unknown }).insert_after_block_id

  return {
    hasExplicitAnchor: true,
    insertAfterBlockId:
      typeof value === "string" && value.trim() !== "" ? value.trim() : null,
  }
}

function getDeletedBlockIdsFromBatchMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return []

  const rawValue = (metadata as { deleted_block_ids?: unknown }).deleted_block_ids

  if (!Array.isArray(rawValue)) return []

  return rawValue
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
}

function insertBlocksAfterAnchor(
  merged: WorkBlock[],
  blocksToInsert: WorkBlock[],
  anchor: { hasExplicitAnchor: boolean; insertAfterBlockId: string | null },
) {
  if (blocksToInsert.length === 0) return merged

  if (!anchor.hasExplicitAnchor) {
    return [...merged, ...blocksToInsert]
  }

  if (!anchor.insertAfterBlockId) {
    return [...blocksToInsert, ...merged]
  }

  const anchorIndex = merged.findIndex((block) => block.id === anchor.insertAfterBlockId)

  if (anchorIndex < 0) {
    return [...merged, ...blocksToInsert]
  }

  const next = [...merged]
  next.splice(anchorIndex + 1, 0, ...blocksToInsert)
  return next
}

function mergeContentBlockBatches(
  baseBlocks: WorkBlock[],
  batches: RawWorkContentBlockBatchRow[],
) {
  if (batches.length === 0) return baseBlocks

  const seenIds = new Set(baseBlocks.map((block) => block.id))
  const deletedIds = new Set<string>()
  let merged = [...baseBlocks]

  batches.forEach((batch) => {
    const deletedBlockIds = getDeletedBlockIdsFromBatchMetadata(batch.metadata)

    if (deletedBlockIds.length > 0) {
      deletedBlockIds.forEach((blockId) => deletedIds.add(blockId))
      merged = merged.filter((block) => !deletedIds.has(block.id))
    }

    const blocksToInsert = mapRawContentBlocks(batch.blocks).filter((block) => {
      if (deletedIds.has(block.id)) return false
      if (seenIds.has(block.id)) return false
      seenIds.add(block.id)
      return true
    })

    const anchor = getInsertionAnchorFromBatchMetadata(batch.metadata)
    merged = insertBlocksAfterAnchor(merged, blocksToInsert, anchor)
  })

  return merged
}

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  return code === "42P01"
}

export async function getAppendedContentBlocks(
  client: SupabaseLike,
  workId: string,
): Promise<RawWorkContentBlockBatchRow[]> {
  const { data, error } = await client
    .from("work_content_block_batches")
    .select("blocks, metadata")
    .eq("work_id", workId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error) {
    if (isMissingRelationError(error)) return []
    console.error("DB error in getAppendedContentBlocks:", error)
    return []
  }

  return (data ?? []) as RawWorkContentBlockBatchRow[]
}

export async function getCombinedContentBlocksForWorkId(
  client: SupabaseLike,
  workId: string,
  baseBlocks?: WorkBlock[],
): Promise<WorkBlock[]> {
  let resolvedBaseBlocks = baseBlocks

  if (!resolvedBaseBlocks) {
    const { data, error } = await client
      .from("works")
      .select("content_blocks")
      .eq("id", workId)
      .maybeSingle()

    if (error) {
      console.error("DB error in getCombinedContentBlocksForWorkId:", error)
      return []
    }

    resolvedBaseBlocks = mapRawContentBlocks(
      (data as { content_blocks?: unknown } | null)?.content_blocks,
    )
  }

  const appendedBlockBatches = await getAppendedContentBlocks(client, workId)
  return mergeContentBlockBatches(resolvedBaseBlocks, appendedBlockBatches)
}

async function mergeAppendedBlocksForWork<T extends { id: string; content_blocks: WorkBlock[] }>(
  client: SupabaseLike,
  item: T,
): Promise<T> {
  const contentBlocks = await getCombinedContentBlocksForWorkId(
    client,
    item.id,
    item.content_blocks,
  )

  if (contentBlocks === item.content_blocks) return item

  return {
    ...item,
    content_blocks: contentBlocks,
  }
}

type SupabaseLike = typeof supabase | Awaited<ReturnType<typeof createClient>>

async function getCollectionRelationsMap(
  client: SupabaseLike,
  workIds: string[],
  publicOnly = false
): Promise<Map<string, WorkCollectionRef[]>> {
  const map = new Map<string, WorkCollectionRef[]>()
  if (workIds.length === 0) return map

  const { data, error } = await client
    .from("work_collections")
    .select(`
      work_id,
      sort_order,
      collections:collection_id (
        id,
        title,
        slug,
        description,
        title_cs,
        title_en,
        description_cs,
        description_en,
        is_public_visible
      )
    `)
    .in("work_id", workIds)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("DB error in getCollectionRelationsMap:", error)
    throw new Error(`Failed to load work collections: ${error.message}`)
  }

  ;((data ?? []) as { work_id: unknown; collections?: RawRelationCollection | RawRelationCollection[] }[]).forEach(
    (row) => {
      const collection = normalizeCollectionRelation(row.collections)
      if (!collection) return
      if (publicOnly) {
        const raw = Array.isArray(row.collections) ? row.collections[0] : row.collections
        if (raw && raw.is_public_visible === false) return
      }
      const workId = String(row.work_id)
      const current = map.get(workId) ?? []
      current.push(collection)
      map.set(workId, current)
    }
  )

  return map
}

async function getTagRelationsMap(
  client: SupabaseLike,
  workIds: string[],
  publicOnly = false
): Promise<Map<string, WorkTagRef[]>> {
  const map = new Map<string, WorkTagRef[]>()
  if (workIds.length === 0) return map

  const { data, error } = await client
    .from("work_tags")
    .select(`
      work_id,
      sort_order,
      tags:tag_id (
        id,
        slug,
        label_cs,
        label_en,
        type,
        is_public_visible
      )
    `)
    .in("work_id", workIds)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("DB error in getTagRelationsMap:", error)
    throw new Error(`Failed to load work tags: ${error.message}`)
  }

  ;((data ?? []) as { work_id: unknown; tags?: RawRelationTag | RawRelationTag[] }[]).forEach(
    (row) => {
      const tag = normalizeTagRelation(row.tags)
      if (!tag) return
      if (publicOnly) {
        const raw = Array.isArray(row.tags) ? row.tags[0] : row.tags
        if (raw && raw.is_public_visible === false) return
      }
      const workId = String(row.work_id)
      const current = map.get(workId) ?? []
      current.push(tag)
      map.set(workId, current)
    }
  )

  return map
}

function firstCollection(
  primary: WorkCollectionRef,
  collections: WorkCollectionRef[]
): WorkCollectionRef {
  return primary ?? collections[0] ?? null
}

export async function getWorksForGallery(): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      title_cs,
      title_en,
      slug,
      subtitle,
      subtitle_cs,
      subtitle_en,
      summary,
      summary_cs,
      summary_en,
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
        name_cs,
        name_en,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug,
        description,
        title_cs,
        title_en,
        description_cs,
        description_en
      )
    `)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("DB error in getWorksForGallery:", error)
    throw new Error(`Failed to load gallery works: ${error.message}`)
  }

  const works = (data ?? []).map((row) => mapGalleryWork(row as RawGalleryWorkRow))
  const collectionsMap = await getCollectionRelationsMap(
    supabase,
    works.map((work) => work.id),
    true
  )

  return works.map((work) => {
    const collections = collectionsMap.get(work.id) ?? (work.collection ? [work.collection] : [])
    return {
      ...work,
      collections,
      collection: firstCollection(work.collection, collections),
    }
  })
}

export async function getWorkBySlug(
  slug: string
): Promise<WorkDetailItem | null> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      title_cs,
      title_en,
      slug,
      subtitle,
      subtitle_cs,
      subtitle_en,
      summary,
      summary_cs,
      summary_en,
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
        name_cs,
        name_en,
        slug,
        bio,
        bio_cs,
        bio_en
      ),
      collections:collection_id (
        id,
        title,
        slug,
        description,
        title_cs,
        title_en,
        description_cs,
        description_en
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

  const item = mapWorkDetail(data as RawWorkDetailRow)
  const [collectionsMap, tagsMap] = await Promise.all([
    getCollectionRelationsMap(supabase, [item.id], true),
    getTagRelationsMap(supabase, [item.id], true),
  ])
  const collections = collectionsMap.get(item.id) ?? (item.collection ? [item.collection] : [])

  return mergeAppendedBlocksForWork(supabase, {
    ...item,
    collection: firstCollection(item.collection, collections),
    collections,
    tags: tagsMap.get(item.id) ?? [],
  })
}

export async function getPublishedWorksByAuthorId(
  authorId: string
): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("works")
    .select(`
      id,
      title,
      title_cs,
      title_en,
      slug,
      subtitle,
      subtitle_cs,
      subtitle_en,
      summary,
      summary_cs,
      summary_en,
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
        name_cs,
        name_en,
        slug
      ),
      collections:collection_id (
        id,
        title,
        slug,
        description,
        title_cs,
        title_en,
        description_cs,
        description_en
      )
    `)
    .eq("primary_author_id", authorId)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (error) {
    console.error("DB error in getPublishedWorksByAuthorId:", error)
    throw new Error(`Failed to load author's works: ${error.message}`)
  }

  const works = (data ?? []).map((row) => mapGalleryWork(row as RawGalleryWorkRow))
  const collectionsMap = await getCollectionRelationsMap(
    supabase,
    works.map((work) => work.id),
    true
  )

  return works.map((work) => {
    const collections = collectionsMap.get(work.id) ?? (work.collection ? [work.collection] : [])
    return {
      ...work,
      collections,
      collection: firstCollection(work.collection, collections),
    }
  })
}

export async function getPublishedWorksByCollectionId(
  collectionId: string
): Promise<GalleryWorkItem[]> {
  const { data, error } = await supabase
    .from("work_collections")
    .select(`
      sort_order,
      works:work_id!inner (
        id,
        title,
        title_cs,
        title_en,
        slug,
        subtitle,
        subtitle_cs,
        subtitle_en,
        summary,
        summary_cs,
        summary_en,
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
          name_cs,
          name_en,
          slug
        ),
        collections:collection_id (
          id,
          title,
          slug,
          description,
          title_cs,
          title_en,
          description_cs,
          description_en
        )
      )
    `)
    .eq("collection_id", collectionId)
    .eq("works.status", "published")
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("DB error in getPublishedWorksByCollectionId:", error)
    throw new Error(`Failed to load collection works: ${error.message}`)
  }

  const works = ((data ?? []) as unknown as { works?: RawGalleryWorkRow | RawGalleryWorkRow[] }[])
    .map((row) => {
      const workRow = Array.isArray(row.works) ? row.works[0] : row.works
      return workRow ? mapGalleryWork(workRow) : null
    })
    .filter((item): item is GalleryWorkItem => item !== null)

  const collectionsMap = await getCollectionRelationsMap(
    supabase,
    works.map((work) => work.id),
    true
  )

  return works.map((work) => {
    const collections = collectionsMap.get(work.id) ?? (work.collection ? [work.collection] : [])
    return {
      ...work,
      collections,
      collection: firstCollection(work.collection, collections),
    }
  })
}

export async function getWorksForMember(): Promise<MemberWorkListItem[]> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("works")
    .select(`
      id,
      title,
      title_cs,
      title_en,
      slug,
      subtitle,
      subtitle_cs,
      subtitle_en,
      summary,
      summary_cs,
      summary_en,
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
        name_cs,
        name_en,
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
    title_cs: row.title_cs == null ? null : String(row.title_cs),
    title_en: row.title_en == null ? null : String(row.title_en),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    subtitle_cs: row.subtitle_cs == null ? null : String(row.subtitle_cs),
    subtitle_en: row.subtitle_en == null ? null : String(row.subtitle_en),
    summary: String(row.summary ?? ""),
    summary_cs: row.summary_cs == null ? null : String(row.summary_cs),
    summary_en: row.summary_en == null ? null : String(row.summary_en),
    canonical_language: String(row.canonical_language),
    status: String(row.status) as WorkStatus,
    origin_type: String(row.origin_type) as WorkOriginType,
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    author: (() => {
      const author = normalizeAuthorRelation(row.authors)
      return author
        ? {
            id: author.id,
            name: author.name,
            name_cs: author.name_cs,
            name_en: author.name_en,
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
      title_cs,
      title_en,
      slug,
      subtitle,
      subtitle_cs,
      subtitle_en,
      summary,
      summary_cs,
      summary_en,
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
  const id = String(row.id)
  const [collectionsMap, tagsMap] = await Promise.all([
    getCollectionRelationsMap(supabaseServer, [id], false),
    getTagRelationsMap(supabaseServer, [id], false),
  ])
  const collectionIds = (collectionsMap.get(id) ?? []).map((collection) => collection?.id).filter(Boolean) as string[]
  const tagIds = (tagsMap.get(id) ?? []).map((tag) => tag?.id).filter(Boolean) as string[]

  const editItem: WorkEditItem = {
    id,
    title: String(row.title),
    title_cs: row.title_cs == null ? null : String(row.title_cs),
    title_en: row.title_en == null ? null : String(row.title_en),
    slug: String(row.slug),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    subtitle_cs: row.subtitle_cs == null ? null : String(row.subtitle_cs),
    subtitle_en: row.subtitle_en == null ? null : String(row.subtitle_en),
    summary: String(row.summary ?? ""),
    summary_cs: row.summary_cs == null ? null : String(row.summary_cs),
    summary_en: row.summary_en == null ? null : String(row.summary_en),
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
      row.collection_id == null
        ? collectionIds[0] ?? null
        : String(row.collection_id),
    collection_ids: collectionIds,
    tag_ids: tagIds,
    content: String(row.content ?? ""),
    content_blocks: mapRawContentBlocks(row.content_blocks),
    cover_image_request:
      row.cover_image_request == null ? null : String(row.cover_image_request),
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
  }

  return mergeAppendedBlocksForWork(supabaseServer, editItem)
}
