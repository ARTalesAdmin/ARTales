import { supabase } from "./supabase"
import { createClient } from "@/lib/supabase/server"
import {
  getPublishedWorksByCollectionId,
  type GalleryWorkItem,
} from "./dbWorks"

export type CollectionDetailItem = {
  id: string
  title: string
  slug: string
  description: string | null
  title_cs: string | null
  title_en: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  description_cs: string | null
  description_en: string | null
  curator_note_cs: string | null
  curator_note_en: string | null
  collection_type: string
  is_featured: boolean
  sort_order: number
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
  is_public_visible: boolean
  works: GalleryWorkItem[]
}

export type CollectionListItem = {
  id: string
  title: string
  slug: string
  description: string | null
  title_cs: string | null
  title_en: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  description_cs: string | null
  description_en: string | null
  collection_type: string
  is_featured: boolean
  sort_order: number
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
  is_public_visible: boolean
}

export type CollectionEditItem = {
  id: string
  title: string
  slug: string
  description: string | null
  title_cs: string | null
  title_en: string | null
  subtitle_cs: string | null
  subtitle_en: string | null
  description_cs: string | null
  description_en: string | null
  curator_note_cs: string | null
  curator_note_en: string | null
  collection_type: string
  is_featured: boolean
  sort_order: number
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
  is_public_visible: boolean
}

export type CollectionWorkAssignment = {
  work_id: string
  sort_order: number
  is_primary: boolean
}

type RawCollectionRow = {
  id: unknown
  title: unknown
  slug: unknown
  description: unknown
  title_cs: unknown
  title_en: unknown
  subtitle_cs: unknown
  subtitle_en: unknown
  description_cs: unknown
  description_en: unknown
  curator_note_cs: unknown
  curator_note_en: unknown
  collection_type: unknown
  is_featured: unknown
  sort_order: unknown
  cover_image_path: unknown
  cover_image_alt: unknown
  cover_image_caption: unknown
  is_public_visible: unknown
}

function mapRawCollection(row: RawCollectionRow): CollectionEditItem {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    title_cs: row.title_cs == null ? null : String(row.title_cs),
    title_en: row.title_en == null ? null : String(row.title_en),
    subtitle_cs: row.subtitle_cs == null ? null : String(row.subtitle_cs),
    subtitle_en: row.subtitle_en == null ? null : String(row.subtitle_en),
    description_cs:
      row.description_cs == null ? null : String(row.description_cs),
    description_en:
      row.description_en == null ? null : String(row.description_en),
    curator_note_cs:
      row.curator_note_cs == null ? null : String(row.curator_note_cs),
    curator_note_en:
      row.curator_note_en == null ? null : String(row.curator_note_en),
    collection_type:
      row.collection_type == null ? "curated" : String(row.collection_type),
    is_featured: Boolean(row.is_featured),
    sort_order: Number(row.sort_order ?? 100),
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    is_public_visible: Boolean(row.is_public_visible),
  }
}

const COLLECTION_SELECT = `
  id,
  title,
  slug,
  description,
  title_cs,
  title_en,
  subtitle_cs,
  subtitle_en,
  description_cs,
  description_en,
  curator_note_cs,
  curator_note_en,
  collection_type,
  is_featured,
  sort_order,
  cover_image_path,
  cover_image_alt,
  cover_image_caption,
  is_public_visible
`

export async function getCollectionBySlug(
  slug: string
): Promise<CollectionDetailItem | null> {
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("slug", slug)
    .eq("is_public_visible", true)
    .maybeSingle()

  if (error) {
    console.error("DB error in getCollectionBySlug:", error)
    throw new Error(`Failed to load collection detail: ${error.message}`)
  }

  if (!data) return null

  const row = data as RawCollectionRow
  const works = await getPublishedWorksByCollectionId(String(row.id))
  const mapped = mapRawCollection(row)

  return {
    ...mapped,
    works,
  }
}

export async function getCollectionsForMember(): Promise<CollectionListItem[]> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("collections")
    .select(COLLECTION_SELECT)
    .order("sort_order", { ascending: true })
    .order("title_cs", { ascending: true })

  if (error) {
    console.error("DB error in getCollectionsForMember:", error)
    throw new Error(`Failed to load collections: ${error.message}`)
  }

  return ((data ?? []) as RawCollectionRow[]).map((row) => mapRawCollection(row))
}

export async function getCollectionForEditBySlug(
  slug: string
): Promise<CollectionEditItem | null> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("DB error in getCollectionForEditBySlug:", error)
    throw new Error(`Failed to load collection for edit: ${error.message}`)
  }

  if (!data) return null

  return mapRawCollection(data as RawCollectionRow)
}

export async function getCollectionsForPublicGallery(): Promise<CollectionListItem[]> {
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("is_public_visible", true)
    .order("sort_order", { ascending: true })
    .order("title_en", { ascending: true })

  if (error) {
    console.error("DB error in getCollectionsForPublicGallery:", error)
    throw new Error(`Failed to load public collections: ${error.message}`)
  }

  return ((data ?? []) as RawCollectionRow[]).map((row) => mapRawCollection(row))
}

export async function getCollectionWorkAssignments(
  collectionId: string
): Promise<CollectionWorkAssignment[]> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("work_collections")
    .select(`work_id, sort_order, is_primary`)
    .eq("collection_id", collectionId)

  if (error) {
    console.error("DB error in getCollectionWorkAssignments:", error)
    throw new Error(`Failed to load collection assignments: ${error.message}`)
  }

  return ((data ?? []) as {
    work_id: unknown
    sort_order: unknown
    is_primary: unknown
  }[]).map((row) => ({
    work_id: String(row.work_id),
    sort_order: Number(row.sort_order ?? 100),
    is_primary: Boolean(row.is_primary),
  }))
}
