import { slugify } from "@/lib/slug"
import { isTagType } from "@/lib/tagTypes"
import type { TagListItem } from "@/lib/dbTags"

export type TagFormValues = {
  label_cs: string
  label_en: string
  slug: string
  description_cs: string
  description_en: string
  type: string
  canonical_tag_id: string
  is_public_visible: boolean
  sort_order: string
}

export function getDefaultTagFormValues(): TagFormValues {
  return {
    label_cs: "",
    label_en: "",
    slug: "",
    description_cs: "",
    description_en: "",
    type: "theme",
    canonical_tag_id: "",
    is_public_visible: true,
    sort_order: "100",
  }
}

export function mapTagToFormValues(tag: TagListItem): TagFormValues {
  return {
    label_cs: tag.label_cs,
    label_en: tag.label_en ?? "",
    slug: tag.slug,
    description_cs: tag.description_cs ?? "",
    description_en: tag.description_en ?? "",
    type: tag.type,
    canonical_tag_id: tag.canonical_tag_id ?? "",
    is_public_visible: tag.is_public_visible,
    sort_order: String(tag.sort_order ?? 100),
  }
}

export function parseTagFormData(formData: FormData): TagFormValues {
  const labelCs = String(formData.get("label_cs") ?? "").trim()
  const labelEn = String(formData.get("label_en") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()

  return {
    label_cs: labelCs,
    label_en: labelEn,
    slug: rawSlug ? slugify(rawSlug) : slugify(labelEn || labelCs),
    description_cs: String(formData.get("description_cs") ?? "").trim(),
    description_en: String(formData.get("description_en") ?? "").trim(),
    type: String(formData.get("type") ?? "other").trim(),
    canonical_tag_id: String(formData.get("canonical_tag_id") ?? "").trim(),
    is_public_visible: formData.get("is_public_visible") === "on",
    sort_order: String(formData.get("sort_order") ?? "100").trim(),
  }
}

function toNullableString(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

function toNullableForeignKey(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

export function validateTagFormValues(values: TagFormValues): string | null {
  if (!values.label_cs) return "label_cs_missing"
  if (!values.slug) return "slug_missing"
  if (!/^[a-z0-9-]+$/.test(values.slug)) return "slug_invalid"
  if (!isTagType(values.type)) return "type_invalid"
  if (values.sort_order && Number.isNaN(Number(values.sort_order))) {
    return "sort_order_invalid"
  }
  return null
}

export function mapTagFormValuesToInsertPayload(
  values: TagFormValues,
  profileId: string
) {
  return {
    slug: values.slug,
    label_cs: values.label_cs,
    label_en: toNullableString(values.label_en),
    description_cs: toNullableString(values.description_cs),
    description_en: toNullableString(values.description_en),
    type: values.type,
    canonical_tag_id: toNullableForeignKey(values.canonical_tag_id),
    is_public_visible: values.is_public_visible,
    sort_order: values.sort_order ? Number(values.sort_order) : 100,
    created_by: profileId,
    updated_by: profileId,
  }
}

export function mapTagFormValuesToUpdatePayload(
  values: TagFormValues,
  profileId: string
) {
  return {
    slug: values.slug,
    label_cs: values.label_cs,
    label_en: toNullableString(values.label_en),
    description_cs: toNullableString(values.description_cs),
    description_en: toNullableString(values.description_en),
    type: values.type,
    canonical_tag_id: toNullableForeignKey(values.canonical_tag_id),
    is_public_visible: values.is_public_visible,
    sort_order: values.sort_order ? Number(values.sort_order) : 100,
    updated_by: profileId,
  }
}
