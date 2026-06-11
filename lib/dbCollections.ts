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
  cover_image_path: string | null
  cover_image_alt: string | null
  cover_image_caption: string | null
  is_public_visible: boolean
}

type RawCollectionRow = {
  id: unknown
  title: unknown
  slug: unknown
  description: unknown
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
    cover_image_path:
      row.cover_image_path == null ? null : String(row.cover_image_path),
    cover_image_alt:
      row.cover_image_alt == null ? null : String(row.cover_image_alt),
    cover_image_caption:
      row.cover_image_caption == null ? null : String(row.cover_image_caption),
    is_public_visible: Boolean(row.is_public_visible),
  }
}

export async function getCollectionBySlug(
  slug: string
): Promise<CollectionDetailItem | null> {
  const { data, error } = await supabase
    .from("collections")
    .select(`
      id,
      title,
      slug,
      description,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
      is_public_visible
    `)
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
    .select(`
      id,
      title,
      slug,
      description,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
      is_public_visible
    `)
    .order("title", { ascending: true })

  if (error) {
    console.error("DB error in getCollectionsForMember:", error)
    throw new Error(`Failed to load collections: ${error.message}`)
  }

  return ((data ?? []) as RawCollectionRow[]).map((row) => {
    const mapped = mapRawCollection(row)

    return {
      id: mapped.id,
      title: mapped.title,
      slug: mapped.slug,
      description: mapped.description,
      cover_image_path: mapped.cover_image_path,
      cover_image_alt: mapped.cover_image_alt,
      cover_image_caption: mapped.cover_image_caption,
      is_public_visible: mapped.is_public_visible,
    }
  })
}

export async function getCollectionForEditBySlug(
  slug: string
): Promise<CollectionEditItem | null> {
  const supabaseServer = await createClient()

  const { data, error } = await supabaseServer
    .from("collections")
    .select(`
      id,
      title,
      slug,
      description,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
      is_public_visible
    `)
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
    .select(`
      id,
      title,
      slug,
      description,
      cover_image_path,
      cover_image_alt,
      cover_image_caption,
      is_public_visible
    `)
    .eq("is_public_visible", true)
    .order("title", { ascending: true });

  if (error) {
    console.error("DB error in getCollectionsForPublicGallery:", error);
    throw new Error(`Failed to load public collections: ${error.message}`);
  }

  return ((data ?? []) as RawCollectionRow[]).map((row) => {
    const mapped = mapRawCollection(row);

    return {
      id: mapped.id,
      title: mapped.title,
      slug: mapped.slug,
      description: mapped.description,
      cover_image_path: mapped.cover_image_path,
      cover_image_alt: mapped.cover_image_alt,
      cover_image_caption: mapped.cover_image_caption,
      is_public_visible: mapped.is_public_visible,
    };
  });
}
