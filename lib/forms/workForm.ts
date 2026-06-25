import { slugify } from "@/lib/slug"
import { isLanguageCode } from "@/lib/dictionaries/language"
import { isStatusCode } from "@/lib/dictionaries/status"
import {
  sanitizeWorkBlocks,
  validateWorkBlocks,
  getUnresolvedImageBlocks,
  flattenBlocksToPlainText,
  type WorkBlock,
} from "@/lib/blocks"

export type WorkFormValues = {
  title: string
  title_cs: string
  title_en: string
  slug: string
  subtitle: string
  subtitle_cs: string
  subtitle_en: string
  summary: string
  summary_cs: string
  summary_en: string
  canonical_language: string
  origin_type: "public_domain" | "original" | "translation" | "other"
  source_label: "gutenberg" | "web" | "manual" | "original"
  source_reference: string
  edition_title: string
  edition_version: string
  edition_language: string
  original_language: string
  edition_source_url: string
  edition_license: string
  edition_publisher: string
  publication_year: string
  isbn: string
  isbn_status: string
  isbn_note: string
  edition_note_public: string
  edition_note_internal: string
  contributor_summary: string
  cover_image_request: string
  cover_image_path: string
  cover_image_alt: string
  cover_image_caption: string
  status: string
  primary_author_id: string
  collection_id: string
  tag_ids: string[]
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
    title_cs: String(formData.get("title_cs") ?? "").trim(),
    title_en: String(formData.get("title_en") ?? "").trim(),
    slug: rawSlug ? slugify(rawSlug) : slugify(title),
    subtitle: String(formData.get("subtitle") ?? "").trim(),
    subtitle_cs: String(formData.get("subtitle_cs") ?? "").trim(),
    subtitle_en: String(formData.get("subtitle_en") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    summary_cs: String(formData.get("summary_cs") ?? "").trim(),
    summary_en: String(formData.get("summary_en") ?? "").trim(),
    canonical_language: String(formData.get("canonical_language") ?? "").trim(),
    origin_type: String(formData.get("origin_type") ?? "").trim() as WorkFormValues["origin_type"],
    source_label: String(formData.get("source_label") ?? "").trim() as WorkFormValues["source_label"],
    source_reference: String(formData.get("source_reference") ?? "").trim(),
    edition_title: String(formData.get("edition_title") ?? "").trim(),
    edition_version: String(formData.get("edition_version") ?? "").trim(),
    edition_language: String(formData.get("edition_language") ?? "").trim(),
    original_language: String(formData.get("original_language") ?? "").trim(),
    edition_source_url: String(formData.get("edition_source_url") ?? "").trim(),
    edition_license: String(formData.get("edition_license") ?? "").trim(),
    edition_publisher: String(formData.get("edition_publisher") ?? "").trim(),
    publication_year: String(formData.get("publication_year") ?? "").trim(),
    isbn: String(formData.get("isbn") ?? "").trim(),
    isbn_status: String(formData.get("isbn_status") ?? "not_required").trim(),
    isbn_note: String(formData.get("isbn_note") ?? "").trim(),
    edition_note_public: String(formData.get("edition_note_public") ?? "").trim(),
    edition_note_internal: String(formData.get("edition_note_internal") ?? "").trim(),
    contributor_summary: String(formData.get("contributor_summary") ?? "").trim(),
    cover_image_request: String(formData.get("cover_image_request") ?? "").trim(),
    cover_image_path: String(formData.get("cover_image_path") ?? "").trim(),
    cover_image_alt: String(formData.get("cover_image_alt") ?? "").trim(),
    cover_image_caption: String(formData.get("cover_image_caption") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    primary_author_id: String(formData.get("primary_author_id") ?? "").trim(),
    collection_id: String(formData.get("collection_id") ?? "").trim(),
    tag_ids: formData.getAll("tag_ids").map((value) => String(value).trim()).filter(Boolean),
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

  if (values.summary.trim().length < 200) {
    return "summary_too_short"
  }

  if (values.summary.trim().length > 800) {
    return "summary_too_long"
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

  if (values.edition_language && !isLanguageCode(values.edition_language)) {
    return "edition_language_invalid"
  }

  if (values.original_language && !isLanguageCode(values.original_language)) {
    return "original_language_invalid"
  }

  if (values.isbn_status === "assigned" && !values.isbn) {
    return "isbn_missing"
  }

  const blocksError = validateWorkBlocks(values.content_blocks)

  if (blocksError) {
    return blocksError
  }

  if (values.status === "published" && getUnresolvedImageBlocks(values.content_blocks).length > 0) {
    return "image_blocks_missing_assets"
  }

  return null
}

export function mapWorkFormValuesToInsertPayload(
  values: WorkFormValues,
  profileId: string
) {
  return {
    title: values.title,
    title_cs: toNullableString(values.title_cs),
    title_en: toNullableString(values.title_en),
    slug: values.slug,
    subtitle: toNullableString(values.subtitle),
    subtitle_cs: toNullableString(values.subtitle_cs),
    subtitle_en: toNullableString(values.subtitle_en),
    summary: values.summary,
    summary_cs: toNullableString(values.summary_cs),
    summary_en: toNullableString(values.summary_en),
    content: values.content_plain_text,
    content_blocks: values.content_blocks,
    canonical_language: values.canonical_language,
    origin_type: values.origin_type,
    source_label: values.source_label,
    source_reference: toNullableString(values.source_reference),
    edition_title: toNullableString(values.edition_title),
    edition_version: toNullableString(values.edition_version),
    edition_language: toNullableString(values.edition_language),
    original_language: toNullableString(values.original_language),
    edition_source_url: toNullableString(values.edition_source_url),
    edition_license: toNullableString(values.edition_license),
    edition_publisher: toNullableString(values.edition_publisher),
    publication_year: toNullableString(values.publication_year),
    isbn: toNullableString(values.isbn),
    isbn_status: values.isbn_status || "not_required",
    isbn_note: toNullableString(values.isbn_note),
    edition_note_public: toNullableString(values.edition_note_public),
    edition_note_internal: toNullableString(values.edition_note_internal),
    contributor_summary: toNullableString(values.contributor_summary),
    cover_image_request: toNullableString(values.cover_image_request),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
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
    title_cs: toNullableString(values.title_cs),
    title_en: toNullableString(values.title_en),
    slug: values.slug,
    subtitle: toNullableString(values.subtitle),
    subtitle_cs: toNullableString(values.subtitle_cs),
    subtitle_en: toNullableString(values.subtitle_en),
    summary: values.summary,
    summary_cs: toNullableString(values.summary_cs),
    summary_en: toNullableString(values.summary_en),
    content: values.content_plain_text,
    content_blocks: values.content_blocks,
    canonical_language: values.canonical_language,
    origin_type: values.origin_type,
    source_label: values.source_label,
    source_reference: toNullableString(values.source_reference),
    edition_title: toNullableString(values.edition_title),
    edition_version: toNullableString(values.edition_version),
    edition_language: toNullableString(values.edition_language),
    original_language: toNullableString(values.original_language),
    edition_source_url: toNullableString(values.edition_source_url),
    edition_license: toNullableString(values.edition_license),
    edition_publisher: toNullableString(values.edition_publisher),
    publication_year: toNullableString(values.publication_year),
    isbn: toNullableString(values.isbn),
    isbn_status: values.isbn_status || "not_required",
    isbn_note: toNullableString(values.isbn_note),
    edition_note_public: toNullableString(values.edition_note_public),
    edition_note_internal: toNullableString(values.edition_note_internal),
    contributor_summary: toNullableString(values.contributor_summary),
    cover_image_request: toNullableString(values.cover_image_request),
    cover_image_path: toNullableString(values.cover_image_path),
    cover_image_alt: toNullableString(values.cover_image_alt),
    cover_image_caption: toNullableString(values.cover_image_caption),
    status: values.status,
    primary_author_id: values.primary_author_id,
    collection_id: toNullableForeignKey(values.collection_id),
    updated_by: profileId,
  }
}