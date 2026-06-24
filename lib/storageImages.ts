export const ARTALES_IMAGES_BUCKET = "artales-images"

export type StorageImageSource = {
  path?: string | null
  alt?: string | null
  caption?: string | null
}

function trimSlashes(value: string) {
  return value.replace(/^\/+/, "").replace(/\/+$/, "")
}

export function normalizeStoragePath(path?: string | null): string | null {
  if (!path) return null

  const trimmed = path.trim()
  if (!trimmed) return null

  // Allow editors to paste either a clean storage path or a public Supabase URL.
  // Public URLs are converted back to the path inside the bucket.
  const publicMarker = `/storage/v1/object/public/${ARTALES_IMAGES_BUCKET}/`
  const markerIndex = trimmed.indexOf(publicMarker)

  if (markerIndex >= 0) {
    return decodeURIComponent(
      trimmed.slice(markerIndex + publicMarker.length).split("?")[0]
    )
  }

  return trimSlashes(trimmed)
}

export function getPublicStorageImageUrl(path?: string | null): string | null {
  const normalizedPath = normalizeStoragePath(path)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!normalizedPath || !supabaseUrl) return null

  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${ARTALES_IMAGES_BUCKET}/${encodeURI(
    normalizedPath
  )}`
}

export const ARTALES_IMAGE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const WORK_COVER_MAX_UPLOAD_BYTES = ARTALES_IMAGE_MAX_UPLOAD_BYTES

export const ARTALES_IMAGE_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export function isAllowedArtalesImageMimeType(type: string) {
  return ARTALES_IMAGE_UPLOAD_MIME_TYPES.includes(
    type as (typeof ARTALES_IMAGE_UPLOAD_MIME_TYPES)[number]
  )
}

export function getExtensionFromMimeType(type: string) {
  if (type === "image/png") return "png"
  if (type === "image/webp") return "webp"
  return "jpg"
}

export function safeStorageSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || "draft"
}

export function createStorageVersionSegment() {
  const randomSegment =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `${Date.now()}-${randomSegment}`
}

export function buildWorkCoverStoragePath({
  workSlug,
  mimeType,
  version = createStorageVersionSegment(),
}: {
  workSlug: string
  fileName?: string
  mimeType: string
  version?: string
}) {
  const slugSegment = safeStorageSegment(workSlug)
  const versionSegment = safeStorageSegment(version)
  const extension = getExtensionFromMimeType(mimeType)

  return `works/${slugSegment}/cover/cover-${versionSegment}.${extension}`
}

export function buildAuthorPortraitStoragePath({
  authorSlug,
  mimeType,
  version = createStorageVersionSegment(),
}: {
  authorSlug: string
  mimeType: string
  version?: string
}) {
  const slugSegment = safeStorageSegment(authorSlug)
  const versionSegment = safeStorageSegment(version)
  const extension = getExtensionFromMimeType(mimeType)

  return `authors/${slugSegment}/portrait/portrait-${versionSegment}.${extension}`
}

export function buildCollectionCoverStoragePath({
  collectionSlug,
  mimeType,
  version = createStorageVersionSegment(),
}: {
  collectionSlug: string
  mimeType: string
  version?: string
}) {
  const slugSegment = safeStorageSegment(collectionSlug)
  const versionSegment = safeStorageSegment(version)
  const extension = getExtensionFromMimeType(mimeType)

  return `collections/${slugSegment}/cover/cover-${versionSegment}.${extension}`
}

export function buildWorkInlineImageStoragePath({
  workSlug,
  blockId,
  mimeType,
}: {
  workSlug: string
  blockId: string
  mimeType: string
}) {
  const slugSegment = safeStorageSegment(workSlug)
  const blockSegment = safeStorageSegment(blockId)
  const extension = getExtensionFromMimeType(mimeType)

  return `works/${slugSegment}/inline/${blockSegment}.${extension}`
}

export function isWorkCoverStoragePath(path?: string | null) {
  const normalizedPath = normalizeStoragePath(path)

  return Boolean(normalizedPath?.match(/^works\/[^/]+\/cover\/[^/]+$/))
}
