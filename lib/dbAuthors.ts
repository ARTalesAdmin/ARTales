import { supabase } from "./supabase"
import { getPublishedWorksByAuthorId, type GalleryWorkItem } from "./dbWorks"
import { createAdminClient } from "./supabase/admin"

export type AuthorType = "person" | "collective" | "unknown"

export type AuthorDetailItem = {
  id: string
  name: string
  slug: string
  author_type: AuthorType
  bio: string | null
  portrait_image_path: string | null
  portrait_image_alt: string | null
  portrait_image_caption: string | null
  birth_year: number | null
  death_year: number | null
  country: string | null
  primary_language: string | null
  writing_languages: string[]
  is_public_visible: boolean
  works: GalleryWorkItem[]
}

export type AuthorListItem = {
  id: string
  name: string
  slug: string
  author_type: AuthorType
  portrait_image_path: string | null
  portrait_image_alt: string | null
  portrait_image_caption: string | null
  birth_year: number | null
  death_year: number | null
  country: string | null
  primary_language: string | null
  writing_languages: string[]
  is_public_visible: boolean
}

export type AuthorEditItem = {
  id: string
  name: string
  slug: string
  author_type: AuthorType
  bio: string | null
  portrait_image_path: string | null
  portrait_image_alt: string | null
  portrait_image_caption: string | null
  birth_year: number | null
  death_year: number | null
  country: string | null
  primary_language: string | null
  writing_languages: string[]
  is_public_visible: boolean
}

type RawAuthorRow = {
  id: unknown
  name: unknown
  slug: unknown
  author_type: unknown
  bio: unknown
  portrait_image_path: unknown
  portrait_image_alt: unknown
  portrait_image_caption: unknown
  birth_year: unknown
  death_year: unknown
  country: unknown
  primary_language: unknown
  writing_languages: unknown
  is_public_visible: unknown
}

function mapRawAuthor(row: RawAuthorRow): AuthorEditItem {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    author_type: row.author_type as AuthorType,
    bio: row.bio == null ? null : String(row.bio),
    portrait_image_path:
      row.portrait_image_path == null ? null : String(row.portrait_image_path),
    portrait_image_alt:
      row.portrait_image_alt == null ? null : String(row.portrait_image_alt),
    portrait_image_caption:
      row.portrait_image_caption == null
        ? null
        : String(row.portrait_image_caption),
    birth_year: row.birth_year == null ? null : Number(row.birth_year),
    death_year: row.death_year == null ? null : Number(row.death_year),
    country: row.country == null ? null : String(row.country),
    primary_language:
      row.primary_language == null ? null : String(row.primary_language),
    writing_languages: Array.isArray(row.writing_languages)
      ? row.writing_languages.map((value) => String(value))
      : [],
    is_public_visible: Boolean(row.is_public_visible),
  }
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
      portrait_image_path,
      portrait_image_alt,
      portrait_image_caption,
      birth_year,
      death_year,
      country,
      primary_language,
      writing_languages,
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
  const mapped = mapRawAuthor(row)

  return {
    ...mapped,
    works,
  }
}

export async function getAuthorsForMember(): Promise<AuthorListItem[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("authors")
    .select(`
      id,
      name,
      slug,
      author_type,
      portrait_image_path,
      portrait_image_alt,
      portrait_image_caption,
      birth_year,
      death_year,
      country,
      primary_language,
      writing_languages,
      is_public_visible
    `)
    .order("name", { ascending: true })

  if (error) {
    console.error("DB error in getAuthorsForMember:", error)
    throw new Error(`Failed to load authors: ${error.message}`)
  }

  return ((data ?? []) as RawAuthorRow[]).map((row) => {
    const mapped = mapRawAuthor(row)

    return {
      id: mapped.id,
      name: mapped.name,
      slug: mapped.slug,
      author_type: mapped.author_type,
      portrait_image_path: mapped.portrait_image_path,
      portrait_image_alt: mapped.portrait_image_alt,
      portrait_image_caption: mapped.portrait_image_caption,
      birth_year: mapped.birth_year,
      death_year: mapped.death_year,
      country: mapped.country,
      primary_language: mapped.primary_language,
      writing_languages: mapped.writing_languages,
      is_public_visible: mapped.is_public_visible,
    }
  })
}

export async function getAuthorForEditBySlug(
  slug: string
): Promise<AuthorEditItem | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("authors")
    .select(`
      id,
      name,
      slug,
      author_type,
      bio,
      portrait_image_path,
      portrait_image_alt,
      portrait_image_caption,
      birth_year,
      death_year,
      country,
      primary_language,
      writing_languages,
      is_public_visible
    `)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("DB error in getAuthorForEditBySlug:", error)
    throw new Error(`Failed to load author for edit: ${error.message}`)
  }

  if (!data) return null

  return mapRawAuthor(data as RawAuthorRow)
}
export async function getAuthorsForPublicGallery(): Promise<AuthorListItem[]> {
  const { data, error } = await supabase
    .from("authors")
    .select(`
      id,
      name,
      slug,
      author_type,
      portrait_image_path,
      portrait_image_alt,
      portrait_image_caption,
      birth_year,
      death_year,
      country,
      primary_language,
      writing_languages,
      is_public_visible
    `)
    .eq("is_public_visible", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("DB error in getAuthorsForPublicGallery:", error);
    throw new Error(`Failed to load public authors: ${error.message}`);
  }

  return ((data ?? []) as RawAuthorRow[]).map((row) => {
    const mapped = mapRawAuthor(row);

    return {
      id: mapped.id,
      name: mapped.name,
      slug: mapped.slug,
      author_type: mapped.author_type,
      portrait_image_path: mapped.portrait_image_path,
      portrait_image_alt: mapped.portrait_image_alt,
      portrait_image_caption: mapped.portrait_image_caption,
      birth_year: mapped.birth_year,
      death_year: mapped.death_year,
      country: mapped.country,
      primary_language: mapped.primary_language,
      writing_languages: mapped.writing_languages,
      is_public_visible: mapped.is_public_visible,
    };
  });
}
