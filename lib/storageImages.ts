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
