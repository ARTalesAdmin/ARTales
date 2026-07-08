import { slugify } from "@/lib/slug"
import type { AuthorEditItem } from "@/lib/dbAuthors"
import {
  isLanguageCode,
  normalizeLanguageCodes,
  type LanguageCode,
} from "@/lib/dictionaries/language"

export type AuthorFormValues = {
  name: string
  name_cs: string
  name_en: string
  slug: string
  author_type: "person" | "collective" | "unknown"
  bio: string
  bio_cs: string
  bio_en: string
  portrait_image_path: string
  portrait_image_alt: string
  portrait_image_caption: string
  birth_year: string
  death_year: string
  country: string
  primary_language: string
  writing_languages: LanguageCode[]
  is_public_visible: boolean
}

export function getDefaultAuthorFormValues(): AuthorFormValues {
  return {
    name: "",
    name_cs: "",
    name_en: "",
    slug: "",
    author_type: "person",
    bio: "",
    bio_cs: "",
    bio_en: "",
    portrait_image_path: "",
    portrait_image_alt: "",
    portrait_image_caption: "",
    birth_year: "",
    death_year: "",
    country: "",
    primary_language: "",
    writing_languages: [],
    is_public_visible: false,
  }
}

function getOptionalLocalizedValue(
  localizedValue: string | null,
  fallbackValue: string | null
): string {
  if (!localizedValue) return ""

  if (fallbackValue && localizedValue.trim() === fallbackValue.trim()) {
    return ""
  }

  return localizedValue
}

export function mapAuthorToFormValues(author: AuthorEditItem): AuthorFormValues {
  const englishName = author.name_en ?? author.name
  const englishBio = author.bio_en ?? author.bio ?? ""

  return {
    name: englishName,
    name_cs: getOptionalLocalizedValue(author.name_cs, englishName),
    name_en: englishName,
    slug: author.slug,
    author_type: author.author_type,
    bio: englishBio,
    bio_cs: getOptionalLocalizedValue(author.bio_cs, englishBio),
    bio_en: englishBio,
    portrait_image_path: author.portrait_image_path ?? "",
    portrait_image_alt: author.portrait_image_alt ?? "",
    portrait_image_caption: author.portrait_image_caption ?? "",
    birth_year: author.birth_year?.toString() ?? "",
    death_year: author.death_year?.toString() ?? "",
    country: author.country ?? "",
    primary_language: author.primary_language ?? "",
    writing_languages: normalizeLanguageCodes(author.writing_languages ?? []),
    is_public_visible: author.is_public_visible,
  }
}

export function parseAuthorFormData(formData: FormData): AuthorFormValues {
  const nameCs = String(formData.get("name_cs") ?? "").trim()
  const nameEn = String(formData.get("name_en") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()
  const rawLanguage = String(formData.get("primary_language") ?? "").trim()
  const rawWritingLanguages = formData
    .getAll("writing_languages")
    .map((value) => String(value).trim())
  const bioEn = String(formData.get("bio_en") ?? "").trim()
  const bioCs = String(formData.get("bio_cs") ?? "").trim()

  return {
    name: nameEn,
    name_cs: nameCs,
    name_en: nameEn,
    slug: rawSlug ? slugify(rawSlug) : slugify(nameEn),
    author_type: String(formData.get("author_type") ?? "person") as
      | "person"
      | "collective"
      | "unknown",
    bio: bioEn,
    bio_cs: bioCs,
    bio_en: bioEn,
    portrait_image_path: String(formData.get("portrait_image_path") ?? "").trim(),
    portrait_image_alt: String(formData.get("portrait_image_alt") ?? "").trim(),
    portrait_image_caption: String(formData.get("portrait_image_caption") ?? "").trim(),
    birth_year: String(formData.get("birth_year") ?? "").trim(),
    death_year: String(formData.get("death_year") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    primary_language: rawLanguage,
    writing_languages: normalizeLanguageCodes(rawWritingLanguages),
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
  if (!values.name_en) {
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

  if (values.primary_language && !isLanguageCode(values.primary_language)) {
    return "primary_language_invalid"
  }

  return null
}

export function mapAuthorFormValuesToInsertPayload(
  values: AuthorFormValues,
  profileId: string
) {
  return {
    name: values.name_en,
    name_cs: toNullableString(values.name_cs),
    name_en: values.name_en,
    slug: values.slug,
    author_type: values.author_type,
    bio: toNullableString(values.bio_en),
    bio_cs: toNullableString(values.bio_cs),
    bio_en: toNullableString(values.bio_en),
    portrait_image_path: toNullableString(values.portrait_image_path),
    portrait_image_alt: toNullableString(values.portrait_image_alt),
    portrait_image_caption: toNullableString(values.portrait_image_caption),
    birth_year: toNullableNumber(values.birth_year),
    death_year: toNullableNumber(values.death_year),
    country: toNullableString(values.country),
    primary_language: toNullableString(values.primary_language),
    writing_languages: values.writing_languages,
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
    name: values.name_en,
    name_cs: toNullableString(values.name_cs),
    name_en: values.name_en,
    slug: values.slug,
    author_type: values.author_type,
    bio: toNullableString(values.bio_en),
    bio_cs: toNullableString(values.bio_cs),
    bio_en: toNullableString(values.bio_en),
    portrait_image_path: toNullableString(values.portrait_image_path),
    portrait_image_alt: toNullableString(values.portrait_image_alt),
    portrait_image_caption: toNullableString(values.portrait_image_caption),
    birth_year: toNullableNumber(values.birth_year),
    death_year: toNullableNumber(values.death_year),
    country: toNullableString(values.country),
    primary_language: toNullableString(values.primary_language),
    writing_languages: values.writing_languages,
    is_public_visible: values.is_public_visible,
    updated_by: profileId,
  }
}
