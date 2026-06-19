import { slugify } from "@/lib/slug"
import type { CollectionEditItem } from "@/lib/dbCollections"
import { isCollectionType } from "@/lib/collectionTypes"

export type CollectionFormValues = {
  title_cs: string
  title_en: string
  subtitle_cs: string
  subtitle_en: string
  slug: string
  description_cs: string
  description_en: string
  curator_note_cs: string
  curator_note_en: string
  cover_image_path: string
  cover_image_alt: string
  cover_image_caption: string
  collection_type: string
  is_featured: boolean
  sort_order: string
  is_public_visible: boolean
}

export function getDefaultCollectionFormValues(): CollectionFormValues {
  return {
    title_cs: "",
    title_en: "",
    subtitle_cs: "",
    subtitle_en: "",
    slug: "",
    description_cs: "",
    description_en: "",
    curator_note_cs: "",
    curator_note_en: "",
    cover_image_path: "",
    cover_image_alt: "",
    cover_image_caption: "",
    collection_type: "curated",
    is_featured: false,
    sort_order: "100",
    is_public_visible: false,
  }
}

export function mapCollectionToFormValues(
  collection: CollectionEditItem
): CollectionFormValues {
  return {
    title_cs: collection.title_cs ?? collection.title ?? "",
    title_en: collection.title_en ?? collection.title ?? "",
    subtitle_cs: collection.subtitle_cs ?? "",
    subtitle_en: collection.subtitle_en ?? "",
    slug: collection.slug,
    description_cs: collection.description_cs ?? collection.description ?? "",
    description_en: collection.description_en ?? collection.description ?? "",
    curator_note_cs: collection.curator_note_cs ?? "",
    curator_note_en: collection.curator_note_en ?? "",
    cover_image_path: collection.cover_image_path ?? "",
    cover_image_alt: collection.cover_image_alt ?? "",
    cover_image_caption: collection.cover_image_caption ?? "",
    collection_type: collection.collection_type ?? "curated",
    is_featured: collection.is_featured,
    sort_order: String(collection.sort_order ?? 100),
    is_public_visible: collection.is_public_visible,
  }
}

export function parseCollectionFormData(formData: FormData): CollectionFormValues {
  const titleCs = String(formData.get("title_cs") ?? "").trim()
  const titleEn = String(formData.get("title_en") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()

  return {
    title_cs: titleCs,
    title_en: titleEn,
    subtitle_cs: String(formData.get("subtitle_cs") ?? "").trim(),
    subtitle_en: String(formData.get("subtitle_en") ?? "").trim(),
    slug: rawSlug ? slugify(rawSlug) : slugify(titleEn || titleCs),
    description_cs: String(formData.get("description_cs") ?? "").trim(),
    description_en: String(formData.get("description_en") ?? "").trim(),
    curator_note_cs: String(formData.get("curator_note_cs") ?? "").trim(),
    curator_note_en: String(formData.get("curator_note_en") ?? "").trim(),
    cover_image_path: String(formData.get("cover_image_path") ?? "").trim(),
    cover_image_alt: String(formData.get("cover_image_alt") ?? "").trim(),
    cover_image_caption: String(formData.get("cover_image_caption") ?? "").trim(),
    collection_type: String(formData.get("collection_type") ?? "curated").trim(),
    is_featured: formData.get("is_featured") === "on",
    sort_order: String(formData.get("sort_order") ?? "100").trim(),
    is_public_visible: formData.get("is_public_visible") === "on",
  }
}

function toNullableString(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

export function validateCollectionFormValues(
  values: CollectionFormValues
): string | null {
  if (!values.title_cs && !values.title_en) {
    return "title_missing"
  }

  if (!values.slug) {
    return "slug_missing"
  }

  if (!/^[a-z0-9-]+$/.test(values.slug)) {
    return "slug_invalid"
  }

  if (!isCollectionType(values.collection_type)) {
    return "collection_type_invalid"
  }

  if (values.sort_order && Number.isNaN(Number(values.sort_order))) {
    return "sort_order_invalid"
  }

  return null
}

export function mapCollectionFormValuesToInsertPayload(
  values: CollectionFormValues,
  profileId: string
) {
  const fallbackTitle = values.title_en || values.title_cs
  const fallbackDescription = values.description_en || values.description_cs

  return {
    title: fallbackTitle,
    slug: values.slug,
    description: toNullableString(fallbackDescription),
    title_cs: toNullableString(values.title_cs),
    title_en: toNullableString(values.title_en),
    subtitle_cs: toNullableString(values.subtitle_cs),
    subtitle_en: toNullableString(values.subtitle_en),
    description_cs: toNullableString(values.description_cs),
    description_en: toNullableString(values.description_en),
    curator_note_cs: toNullableString(values.curator_note_cs),
    curator_note_en: toNullableString(values.curator_note_en),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
    collection_type: values.collection_type,
    is_featured: values.is_featured,
    sort_order: values.sort_order ? Number(values.sort_order) : 100,
    is_public_visible: values.is_public_visible,
    created_by: profileId,
    updated_by: profileId,
  }
}

export function mapCollectionFormValuesToUpdatePayload(
  values: CollectionFormValues,
  profileId: string
) {
  const fallbackTitle = values.title_en || values.title_cs
  const fallbackDescription = values.description_en || values.description_cs

  return {
    title: fallbackTitle,
    slug: values.slug,
    description: toNullableString(fallbackDescription),
    title_cs: toNullableString(values.title_cs),
    title_en: toNullableString(values.title_en),
    subtitle_cs: toNullableString(values.subtitle_cs),
    subtitle_en: toNullableString(values.subtitle_en),
    description_cs: toNullableString(values.description_cs),
    description_en: toNullableString(values.description_en),
    curator_note_cs: toNullableString(values.curator_note_cs),
    curator_note_en: toNullableString(values.curator_note_en),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
    collection_type: values.collection_type,
    is_featured: values.is_featured,
    sort_order: values.sort_order ? Number(values.sort_order) : 100,
    is_public_visible: values.is_public_visible,
    updated_by: profileId,
  }
}
