"use client"

import { useRef, useState } from "react"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client"
import StorageImageDisplay from "@/components/media/StorageImageDisplay"
import {
  ARTALES_IMAGES_BUCKET,
  ARTALES_IMAGE_MAX_UPLOAD_BYTES,
  buildAuthorPortraitStoragePath,
  buildCollectionCoverStoragePath,
  isAllowedArtalesImageMimeType,
  normalizeStoragePath,
} from "@/lib/storageImages"

type EditorialImageKind = "author-portrait" | "collection-cover"

type EditorialImageUploadFieldProps = {
  kind: EditorialImageKind
  title: string
  slugInputId: string
  titleInputId: string
  pathName: string
  altName: string
  captionName: string
  initialPath?: string | null
  initialAlt?: string | null
  initialCaption?: string | null
  heading: string
  description: string
  uploadLabel: string
  uploadingLabel: string
  removeLabel: string
  emptyHint: string
  readyHint: string
  altLabel: string
  altPlaceholder: string
  captionLabel: string
  captionPlaceholder: string
  defaultAltPrefix: string
}

function slugifyClient(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function getInputValue(id: string) {
  if (typeof document === "undefined") return ""

  const input = document.getElementById(id)
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.value
  }

  return ""
}

function buildStoragePath({
  kind,
  slug,
  mimeType,
}: {
  kind: EditorialImageKind
  slug: string
  mimeType: string
}) {
  if (kind === "author-portrait") {
    return buildAuthorPortraitStoragePath({ authorSlug: slug, mimeType })
  }

  return buildCollectionCoverStoragePath({ collectionSlug: slug, mimeType })
}

export default function EditorialImageUploadField({
  kind,
  title,
  slugInputId,
  titleInputId,
  pathName,
  altName,
  captionName,
  initialPath,
  initialAlt,
  initialCaption,
  heading,
  description,
  uploadLabel,
  uploadingLabel,
  removeLabel,
  emptyHint,
  readyHint,
  altLabel,
  altPlaceholder,
  captionLabel,
  captionPlaceholder,
  defaultAltPrefix,
}: EditorialImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadedPathsRef = useRef(new Set<string>())
  const [imagePath, setImagePath] = useState(normalizeStoragePath(initialPath) ?? "")
  const [altText, setAltText] = useState(initialAlt ?? "")
  const [caption, setCaption] = useState(initialCaption ?? "")
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function removeUnsavedUpload(path: string) {
    if (!uploadedPathsRef.current.has(path)) return

    try {
      const supabase = createBrowserSupabaseClient()
      const { error: removeError } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .remove([path])

      if (!removeError) {
        uploadedPathsRef.current.delete(path)
      }
    } catch {
      // Best-effort cleanup only. A failed cleanup must not block editing.
    }
  }

  async function uploadImage(file: File | null) {
    setError(null)
    setMessage(null)

    if (!file) return

    if (!isAllowedArtalesImageMimeType(file.type)) {
      setError("Podporované formáty jsou JPG, PNG a WebP.")
      return
    }

    if (file.size > ARTALES_IMAGE_MAX_UPLOAD_BYTES) {
      setError("Soubor je příliš velký. Maximální velikost obrázku je 5 MB.")
      return
    }

    const rawSlug = getInputValue(slugInputId)
    const rawTitle = getInputValue(titleInputId)
    const slug = slugifyClient(rawSlug || rawTitle)

    if (!slug) {
      setError("Nejdřív vyplň název/jméno nebo slug. Podle něj se vytvoří bezpečná cesta obrázku.")
      return
    }

    setIsUploading(true)

    try {
      const previousPath = imagePath
      const storagePath = buildStoragePath({ kind, slug, mimeType: file.type })
      const supabase = createBrowserSupabaseClient()

      const { error: uploadError } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        setError(`Obrázek se nepodařilo nahrát: ${uploadError.message}`)
        return
      }

      uploadedPathsRef.current.add(storagePath)

      if (previousPath && previousPath !== storagePath) {
        await removeUnsavedUpload(previousPath)
      }

      setImagePath(storagePath)
      setAltText((current) => current.trim() || `${defaultAltPrefix} ${rawTitle || rawSlug}`.trim())
      setMessage("Obrázek byl nahrán. Ulož záznam, aby se změna propsala do databáze.")

      if (inputRef.current) {
        inputRef.current.value = ""
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section
      style={{
        border: "1px solid #e2ded8",
        padding: "18px",
        display: "grid",
        gap: "16px",
        background: "#fbfaf7",
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>{heading}</h2>
        <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.75 }}>{description}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          void uploadImage(event.target.files?.[0] ?? null)
        }}
        style={{ display: "none" }}
      />

      <input type="hidden" name={pathName} value={imagePath} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: kind === "author-portrait" ? "minmax(160px, 220px) 1fr" : "minmax(220px, 320px) 1fr",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <StorageImageDisplay
          title={title}
          imagePath={imagePath}
          alt={altText}
          caption={caption}
          variant={kind === "author-portrait" ? "author-portrait" : "collection-cover"}
        />

        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              style={{
                border: "1px solid #111827",
                background: isUploading ? "#6b7280" : "#111827",
                color: "#fff",
                borderRadius: "999px",
                padding: "10px 15px",
                cursor: isUploading ? "wait" : "pointer",
                fontWeight: 700,
              }}
            >
              {isUploading ? uploadingLabel : uploadLabel}
            </button>

            {imagePath ? (
              <button
                type="button"
                onClick={() => {
                  const removedPath = imagePath
                  setImagePath("")
                  setMessage("Obrázek byl odebrán z formuláře. Ulož záznam, aby se změna propsala do databáze.")
                  setError(null)

                  if (removedPath) {
                    void removeUnsavedUpload(removedPath)
                  }
                }}
                style={{
                  border: "1px solid rgba(13, 21, 40, 0.22)",
                  background: "#fffefb",
                  color: "#111827",
                  borderRadius: "999px",
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {removeLabel}
              </button>
            ) : null}
          </div>

          {error ? <p style={{ margin: 0, color: "#9f1239", fontSize: "14px" }}>{error}</p> : null}
          {message ? <p style={{ margin: 0, color: "#166534", fontSize: "14px" }}>{message}</p> : null}

          <p style={{ margin: 0, fontSize: "13px", opacity: 0.72 }}>
            {imagePath ? readyHint : emptyHint}
          </p>

          <div>
            <label htmlFor={altName} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              {altLabel}
            </label>
            <input
              id={altName}
              name={altName}
              type="text"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder={altPlaceholder}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }}
            />
          </div>

          <div>
            <label htmlFor={captionName} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              {captionLabel}
            </label>
            <input
              id={captionName}
              name={captionName}
              type="text"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={captionPlaceholder}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
