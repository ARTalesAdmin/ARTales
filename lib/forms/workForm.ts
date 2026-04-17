import { slugify } from "@/lib/slug"
import { isLanguageCode } from "@/lib/dictionaries/language"
import { isStatusCode } from "@/lib/dictionaries/status"
import {
  sanitizeWorkBlocks,
  validateWorkBlocks,
  flattenBlocksToPlainText,
  type WorkBlock,
} from "@/lib/blocks"

export type WorkFormValues = {
  title: string
  slug: string
  subtitle: string
  summary: string
  canonical_language: string
  origin_type: "public_domain" | "original" | "translation" | "other"
  source_label: "gutenberg" | "web" | "manual" | "original"
  source_reference: string
  status: string
  primary_author_id: string
  collection_id: string
  content_blocks: WorkBlock[]
  content_plain_text: string
}

function toNullableString(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

function toNullableForeignKey(value: string): string | null {
  return value.trim() === "" ? null : value.trim()
}

function isOriginType(value: string): value is WorkFormValues["origin_type"] {
  return ["public_domain", "original", "translation", "other"].includes(value)
}

function isSourceLabel(value: string): value is WorkFormValues["source_label"] {
  return ["gutenberg", "web", "manual", "original"].includes(value)
}

export function parseWorkFormData(formData: FormData): WorkFormValues {
  const title = String(formData.get("title") ?? "").trim()
  const rawSlug = String(formData.get("slug") ?? "").trim()
  const rawBlocks = String(formData.get("content_blocks_json") ?? "[]")

  let parsedBlocks: unknown = []

  try {
    parsedBlocks = JSON.parse(rawBlocks)
  } catch {
    parsedBlocks = []
  }

  const content_blocks = sanitizeWorkBlocks(parsedBlocks)
  const content_plain_text = flattenBlocksToPlainText(content_blocks)

  return {
    title,
    slug: rawSlug ? slugify(rawSlug) : slugify(title),
    subtitle: String(formData.get("subtitle") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    canonical_language: String(formData.get("canonical_language") ?? "").trim(),
    origin_type: String(formData.get("origin_type") ?? "").trim() as WorkFormValues["origin_type"],
    source_label: String(formData.get("source_label") ?? "").trim() as WorkFormValues["source_label"],
    source_reference: String(formData.get("source_reference") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    primary_author_id: String(formData.get("primary_author_id") ?? "").trim(),
    collection_id: String(formData.get("collection_id") ?? "").trim(),
    content_blocks,
    content_plain_text,
  }
}

export function validateWorkFormValues(values: WorkFormValues): string | null {
  if (!values.title) {
    return "title_missing"
  }

  if (!values.slug) {
    return "slug_missing"
  }

  if (!/^[a-z0-9-]+$/.test(values.slug)) {
    return "slug_invalid"
  }

  if (!values.summary) {
    return "summary_missing"
  }

  if (!values.primary_author_id) {
    return "primary_author_missing"
  }

  if (!values.canonical_language || !isLanguageCode(values.canonical_language)) {
    return "canonical_language_invalid"
  }

  if (!values.status || !isStatusCode(values.status)) {
    return "status_invalid"
  }

  if (!isOriginType(values.origin_type)) {
    return "origin_type_invalid"
  }

  if (!isSourceLabel(values.source_label)) {
    return "source_label_invalid"
  }

  const blocksError = validateWorkBlocks(values.content_blocks)

  if (blocksError) {
    return blocksError
  }

  return null
}

export function mapWorkFormValuesToInsertPayload(
  values: WorkFormValues,
  profileId: string
) {
  return {
    title: values.title,
    slug: values.slug,
    subtitle: toNullableString(values.subtitle),
    summary: values.summary,
    content: values.content_plain_text,
    content_blocks: values.content_blocks,
    canonical_language: values.canonical_language,
    origin_type: values.origin_type,
    source_label: values.source_label,
    source_reference: toNullableString(values.source_reference),
    status: values.status,
    primary_author_id: values.primary_author_id,
    collection_id: toNullableForeignKey(values.collection_id),
    created_by: profileId,
    updated_by: profileId,
  }
}

export function mapWorkFormValuesToUpdatePayload(
  values: WorkFormValues,
  profileId: string
) {
  return {
    title: values.title,
    slug: values.slug,
    subtitle: toNullableString(values.subtitle),
    summary: values.summary,
    content: values.content_plain_text,
    content_blocks: values.content_blocks,
    canonical_language: values.canonical_language,
    origin_type: values.origin_type,
    source_label: values.source_label,
    source_reference: toNullableString(values.source_reference),
    status: values.status,
    primary_author_id: values.primary_author_id,
    collection_id: toNullableForeignKey(values.collection_id),
    updated_by: profileId,
  }
}