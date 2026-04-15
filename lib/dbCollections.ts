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
  is_public_visible: boolean
  works: GalleryWorkItem[]
}

export type CollectionListItem = {
  id: string
  title: string
  slug: string
  description: string | null
  is_public_visible: boolean
}

export type CollectionEditItem = {
  id: string
  title: string
  slug: string
  description: string | null
  is_public_visible: boolean
}

type RawCollectionRow = {
  id: unknown
  title: unknown
  slug: unknown
  description: unknown
  is_public_visible: unknown
}

function mapRawCollection(row: RawCollectionRow): CollectionEditItem {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
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