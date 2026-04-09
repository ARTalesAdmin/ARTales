import { supabase } from "./supabase"
import { getPublishedWorksByAuthorId, type GalleryWorkItem } from "./dbWorks"

export type AuthorType = "person" | "collective" | "unknown"

export type AuthorDetailItem = {
  id: string
  name: string
  slug: string
  author_type: AuthorType
  bio: string | null
  birth_year: number | null
  death_year: number | null
  country: string | null
  primary_language: string | null
  is_public_visible: boolean
  works: GalleryWorkItem[]
}

type RawAuthorRow = {
  id: unknown
  name: unknown
  slug: unknown
  author_type: unknown
  bio: unknown
  birth_year: unknown
  death_year: unknown
  country: unknown
  primary_language: unknown
  is_public_visible: unknown
}

export async function getAuthorBySlug(
  slug: string
): Promise<AuthorDetailItem | null> {
  const { data, error } = await supabase
    .from("authors")
    .select(`
      id,
      name,
      slug,
      author_type,
      bio,
      birth_year,
      death_year,
      country,
      primary_language,
      is_public_visible
    `)
    .eq("slug", slug)
    .eq("is_public_visible", true)
    .maybeSingle()

  if (error) {
    console.error("DB error in getAuthorBySlug:", error)
    throw new Error(`Failed to load author detail: ${error.message}`)
  }

  if (!data) return null

  const row = data as RawAuthorRow
  const works = await getPublishedWorksByAuthorId(String(row.id))

  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    author_type: row.author_type as AuthorType,
    bio: row.bio == null ? null : String(row.bio),
    birth_year: row.birth_year == null ? null : Number(row.birth_year),
    death_year: row.death_year == null ? null : Number(row.death_year),
    country: row.country == null ? null : String(row.country),
    primary_language:
      row.primary_language == null ? null : String(row.primary_language),
    is_public_visible: Boolean(row.is_public_visible),
    works,
  }
}