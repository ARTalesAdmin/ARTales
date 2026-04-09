import { supabase } from "./supabase"
import {
  getPublishedWorksByCollectionId,
  type GalleryWorkItem,
} from "./dbWorks"

export type CollectionDetailItem = {
  id: string
  title: string
  slug: string
  description: string | null
  is_public_visible: boolean
  works: GalleryWorkItem[]
}

type RawCollectionRow = {
  id: unknown
  title: unknown
  slug: unknown
  description: unknown
  is_public_visible: unknown
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

  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    is_public_visible: Boolean(row.is_public_visible),
    works,
  }
}