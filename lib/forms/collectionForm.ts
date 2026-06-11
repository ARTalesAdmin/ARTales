import { slugify } from "@/lib/slug"
import type { CollectionEditItem } from "@/lib/dbCollections"

export type CollectionFormValues = {
  title: string
  slug: string
  description: string
  cover_image_path: string
  cover_image_alt: string
  cover_image_caption: string
  is_public_visible: boolean
}

export function getDefaultCollectionFormValues(): CollectionFormValues {
  return {
    title: "",
    slug: "",
    description: "",
    cover_image_path: "",
    cover_image_alt: "",
    cover_image_caption: "",
    is_public_visible: false,
  }
}

export function mapCollectionToFormValues(
  collection: CollectionEditItem
): CollectionFormValues {
  return {
    title: collection.title,
    slug: collection.slug,
    description: collection.description ?? "",
    cover_image_path: collection.cover_image_path ?? "",
    cover_image_alt: collection.cover_image_alt ?? "",
    cover_image_caption: collection.cover_image_caption ?? "",
    is_public_visible: collection.is_public_visible,
  }
}

export function parseCollectionFormData(formData: FormData): CollectionFormValues {
  const title = String(formData.get("title") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()

  return {
    title,
    slug: rawSlug ? slugify(rawSlug) : slugify(title),
    description: String(formData.get("description") ?? "").trim(),
    cover_image_path: String(formData.get("cover_image_path") ?? "").trim(),
    cover_image_alt: String(formData.get("cover_image_alt") ?? "").trim(),
    cover_image_caption: String(formData.get("cover_image_caption") ?? "").trim(),
    is_public_visible: formData.get("is_public_visible") === "on",
  }
}

function toNullableString(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

export function validateCollectionFormValues(
  values: CollectionFormValues
): string | null {
  if (!values.title) {
    return "title_missing"
  }

  if (!values.slug) {
    return "slug_missing"
  }

  if (!/^[a-z0-9-]+$/.test(values.slug)) {
    return "slug_invalid"
  }

  return null
}

export function mapCollectionFormValuesToInsertPayload(
  values: CollectionFormValues,
  profileId: string
) {
  return {
    title: values.title,
    slug: values.slug,
    description: toNullableString(values.description),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
    is_public_visible: values.is_public_visible,
    created_by: profileId,
    updated_by: profileId,
  }
}

export function mapCollectionFormValuesToUpdatePayload(
  values: CollectionFormValues,
  profileId: string
) {
  return {
    title: values.title,
    slug: values.slug,
    description: toNullableString(values.description),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
    is_public_visible: values.is_public_visible,
    updated_by: profileId,
  }
}