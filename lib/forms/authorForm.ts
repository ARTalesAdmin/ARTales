import { slugify } from "@/lib/slug"
import type { AuthorEditItem } from "@/lib/dbAuthors"

export type AuthorFormValues = {
  name: string
  slug: string
  author_type: "person" | "collective" | "unknown"
  bio: string
  birth_year: string
  death_year: string
  country: string
  primary_language: string
  is_public_visible: boolean
}

export function getDefaultAuthorFormValues(): AuthorFormValues {
  return {
    name: "",
    slug: "",
    author_type: "person",
    bio: "",
    birth_year: "",
    death_year: "",
    country: "",
    primary_language: "",
    is_public_visible: false,
  }
}

export function mapAuthorToFormValues(author: AuthorEditItem): AuthorFormValues {
  return {
    name: author.name,
    slug: author.slug,
    author_type: author.author_type,
    bio: author.bio ?? "",
    birth_year: author.birth_year?.toString() ?? "",
    death_year: author.death_year?.toString() ?? "",
    country: author.country ?? "",
    primary_language: author.primary_language ?? "",
    is_public_visible: author.is_public_visible,
  }
}

export function parseAuthorFormData(formData: FormData): AuthorFormValues {
  const name = String(formData.get("name") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()

  return {
    name,
    slug: rawSlug ? slugify(rawSlug) : slugify(name),
    author_type: String(formData.get("author_type") ?? "person") as
      | "person"
      | "collective"
      | "unknown",
    bio: String(formData.get("bio") ?? "").trim(),
    birth_year: String(formData.get("birth_year") ?? "").trim(),
    death_year: String(formData.get("death_year") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    primary_language: String(formData.get("primary_language") ?? "").trim(),
    is_public_visible: formData.get("is_public_visible") === "on",
  }
}

function toNullableString(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

function toNullableNumber(value: string): number | null {
  if (value.trim() === "") return null

  const parsed = Number(value)

  if (!Number.isInteger(parsed)) return null

  return parsed
}

export function validateAuthorFormValues(values: AuthorFormValues): string | null {
  if (!values.name) {
    return "name_missing"
  }

  if (!values.slug) {
    return "slug_missing"
  }

  if (!/^[a-z0-9-]+$/.test(values.slug)) {
    return "slug_invalid"
  }

  if (
    values.birth_year &&
    (!Number.isInteger(Number(values.birth_year)) || values.birth_year.length !== 4)
  ) {
    return "birth_year_invalid"
  }

  if (
    values.death_year &&
    (!Number.isInteger(Number(values.death_year)) || values.death_year.length !== 4)
  ) {
    return "death_year_invalid"
  }

  return null
}

export function mapAuthorFormValuesToInsertPayload(
  values: AuthorFormValues,
  profileId: string
) {
  return {
    name: values.name,
    slug: values.slug,
    author_type: values.author_type,
    bio: toNullableString(values.bio),
    birth_year: toNullableNumber(values.birth_year),
    death_year: toNullableNumber(values.death_year),
    country: toNullableString(values.country),
    primary_language: toNullableString(values.primary_language),
    is_public_visible: values.is_public_visible,
    created_by: profileId,
    updated_by: profileId,
  }
}

export function mapAuthorFormValuesToUpdatePayload(
  values: AuthorFormValues,
  profileId: string
) {
  return {
    name: values.name,
    slug: values.slug,
    author_type: values.author_type,
    bio: toNullableString(values.bio),
    birth_year: toNullableNumber(values.birth_year),
    death_year: toNullableNumber(values.death_year),
    country: toNullableString(values.country),
    primary_language: toNullableString(values.primary_language),
    is_public_visible: values.is_public_visible,
    updated_by: profileId,
  }
}