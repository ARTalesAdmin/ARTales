"use client"

import { useEffect, useMemo, useState } from "react"
import WorkBlocksEditor from "./WorkBlocksEditor"
import type { WorkBlock } from "@/lib/blocks"

type Props = {
  mode: "new" | "edit"
  slug?: string

  initialData: {
    title: string
    slug: string
    subtitle: string
    summary: string
    primary_author_id: string
    collection_id: string
    canonical_language: string
    status: string
    origin_type: string
    source_label: string
    source_reference: string
    blocks: WorkBlock[]
  }

  authors: { id: string; name: string }[]
  collections: { id: string; title: string }[]
  languageOptions: { value: string; label: string }[]
  statusOptions: { value: string; label: string }[]

  action: (formData: FormData) => Promise<void>
  clearDraftKeys?: string[]
}

function getStorageKey(mode: "new" | "edit", slug?: string) {
  return mode === "new"
    ? "artales-work-draft-new"
    : `artales-work-draft-edit:${slug}`
}

function stableStringify(value: unknown) {
  return JSON.stringify(value)
}

export default function WorkEditorForm(props: Props) {
  const {
    mode,
    slug,
    initialData,
    authors,
    collections,
    languageOptions,
    statusOptions,
    action,
    clearDraftKeys = [],
  } = props

  const storageKey = getStorageKey(mode, slug)
    useEffect(() => {
    if (clearDraftKeys.length === 0) return

    clearDraftKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
  }, [clearDraftKeys])

  const [formState, setFormState] = useState({
    title: initialData.title,
    slug: initialData.slug,
    subtitle: initialData.subtitle,
    summary: initialData.summary,
    primary_author_id: initialData.primary_author_id,
    collection_id: initialData.collection_id,
    canonical_language: initialData.canonical_language,
    status: initialData.status,
    origin_type: initialData.origin_type,
    source_label: initialData.source_label,
    source_reference: initialData.source_reference,
  })

  const [blocks, setBlocks] = useState<WorkBlock[]>(
    initialData.blocks.length > 0 ? initialData.blocks : []
  )

  const [hasDraft, setHasDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [autosaveEnabled, setAutosaveEnabled] = useState(false)

  const currentSnapshot = useMemo(
    () =>
      stableStringify({
        form: formState,
        blocks,
      }),
    [formState, blocks]
  )

  const initialSnapshot = useMemo(
    () =>
      stableStringify({
        form: {
          title: initialData.title,
          slug: initialData.slug,
          subtitle: initialData.subtitle,
          summary: initialData.summary,
          primary_author_id: initialData.primary_author_id,
          collection_id: initialData.collection_id,
          canonical_language: initialData.canonical_language,
          status: initialData.status,
          origin_type: initialData.origin_type,
          source_label: initialData.source_label,
          source_reference: initialData.source_reference,
        },
        blocks: initialData.blocks,
      }),
    [initialData]
  )

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)

    if (!raw) {
      setDraftLoaded(true)
      setAutosaveEnabled(true)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      const draftSnapshot = stableStringify({
        form: parsed.form ?? {},
        blocks: parsed.blocks ?? [],
      })

      if (draftSnapshot !== initialSnapshot) {
        setHasDraft(true)
        setLastSaved(parsed.updated_at ?? null)
      } else {
        localStorage.removeItem(storageKey)
        setAutosaveEnabled(true)
      }
    } catch {
      localStorage.removeItem(storageKey)
      setAutosaveEnabled(true)
    } finally {
      setDraftLoaded(true)
    }
  }, [storageKey, initialSnapshot])

  useEffect(() => {
    if (!draftLoaded || !autosaveEnabled) return

    const payload = {
      form: formState,
      blocks,
      updated_at: new Date().toISOString(),
    }

    localStorage.setItem(storageKey, JSON.stringify(payload))
    setLastSaved(payload.updated_at)
  }, [formState, blocks, storageKey, draftLoaded, autosaveEnabled])

  function restoreDraft() {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      setHasDraft(false)
      setAutosaveEnabled(true)
      return
    }

    try {
      const parsed = JSON.parse(raw)

      if (parsed.form) {
        setFormState({
          title: parsed.form.title ?? "",
          slug: parsed.form.slug ?? "",
          subtitle: parsed.form.subtitle ?? "",
          summary: parsed.form.summary ?? "",
          primary_author_id: parsed.form.primary_author_id ?? "",
          collection_id: parsed.form.collection_id ?? "",
          canonical_language: parsed.form.canonical_language ?? "cs",
          status: parsed.form.status ?? "draft",
          origin_type: parsed.form.origin_type ?? "original",
          source_label: parsed.form.source_label ?? "manual",
          source_reference: parsed.form.source_reference ?? "",
        })
      }

      if (Array.isArray(parsed.blocks)) {
        setBlocks(parsed.blocks)
      }

      setLastSaved(parsed.updated_at ?? null)
    } catch {
      // ignore broken draft
    }

    setHasDraft(false)
    setAutosaveEnabled(true)
  }

  function discardDraft() {
    localStorage.removeItem(storageKey)
    setHasDraft(false)
    setLastSaved(null)
    setAutosaveEnabled(true)
  }

  return (
    <>
      {hasDraft ? (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "16px",
            marginBottom: "20px",
            background: "#f9f9f9",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            Byl nalezen rozpracovaný lokální návrh.
          </p>

          {lastSaved ? (
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", opacity: 0.7 }}>
              Naposledy uloženo: {new Date(lastSaved).toLocaleString()}
            </p>
          ) : null}

          <p style={{ margin: "0 0 12px 0", fontSize: "14px", opacity: 0.8 }}>
            Pokud od poslední práce uplynul delší čas, zvaž, jestli chceš obnovit
            lokální návrh, nebo pokračovat bez něj.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={restoreDraft}
              style={{
                padding: "10px 14px",
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Obnovit návrh
            </button>

            <button
              type="button"
              onClick={discardDraft}
              style={{
                padding: "10px 14px",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Zahodit návrh
            </button>
          </div>
        </div>
      ) : null}

      <form action={action} style={{ display: "grid", gap: "22px" }}>
        <section
          style={{
            border: "1px solid #ddd",
            padding: "24px",
            display: "grid",
            gap: "18px",
          }}
        >
          <h2 style={{ margin: 0 }}>Metadata díla</h2>

          <div>
            <label
              htmlFor="title"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Název díla
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={formState.title}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, title: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Hlavní název díla. Povinné pole.
            </p>
          </div>

          <div>
            <label
              htmlFor="slug"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              value={formState.slug}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, slug: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              URL identifikátor díla. Když ho nevyplníš, vytvoří se automaticky z
              názvu. Povolená jsou pouze malá písmena, čísla a pomlčky.
            </p>
          </div>

          <div>
            <label
              htmlFor="subtitle"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Podnázev
            </label>
            <input
              id="subtitle"
              name="subtitle"
              type="text"
              value={formState.subtitle}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, subtitle: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinný doplňující název díla.
            </p>
          </div>

          <div>
            <label
              htmlFor="summary"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Shrnutí
            </label>
            <textarea
              id="summary"
              name="summary"
              required
              rows={4}
              value={formState.summary}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, summary: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Krátké představení díla pro galerii a detail. Povinné pole.
              Doporučený rozsah je 200–800 znaků.
            </p>
          </div>

          <div>
            <label
              htmlFor="primary_author_id"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Primární autor
            </label>
            <select
              id="primary_author_id"
              name="primary_author_id"
              required
              value={formState.primary_author_id}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  primary_author_id: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="">— Vyber autora —</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Hlavní autor, pod kterým bude dílo vedeno. Povinné pole.
            </p>
          </div>

          <div>
            <label
              htmlFor="collection_id"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Kolekce
            </label>
            <select
              id="collection_id"
              name="collection_id"
              value={formState.collection_id}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  collection_id: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="">— Bez kolekce —</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinné zařazení díla do kolekce.
            </p>
          </div>

          <div>
            <label
              htmlFor="canonical_language"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Jazyk
            </label>
            <select
              id="canonical_language"
              name="canonical_language"
              value={formState.canonical_language}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  canonical_language: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Hlavní jazyk díla. Ukládá se standardizovaný kód, editor vidí český
              popisek.
            </p>
          </div>

          <div>
            <label
              htmlFor="status"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formState.status}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, status: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Stav workflow díla. Koncept = rozpracováno, Ke kontrole =
              připraveno ke schválení, Publikováno = veřejně viditelné,
              Archivováno = interně uložené.
            </p>
          </div>

          <div>
            <label
              htmlFor="origin_type"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Typ původu
            </label>
            <select
              id="origin_type"
              name="origin_type"
              value={formState.origin_type}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  origin_type: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="public_domain">Volné dílo</option>
              <option value="original">Původní dílo</option>
              <option value="translation">Překlad</option>
              <option value="other">Jiná vrstva</option>
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Určuje, zda jde o původní dílo, překlad, volné dílo nebo jinou
              vrstvu.
            </p>
          </div>

          <div>
            <label
              htmlFor="source_label"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Zdroj
            </label>
            <select
              id="source_label"
              name="source_label"
              value={formState.source_label}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  source_label: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="gutenberg">Project Gutenberg</option>
              <option value="web">Web</option>
              <option value="manual">Ruční vložení</option>
              <option value="original">Původní zdroj</option>
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Odkud text nebo jeho základ pochází. Např. ruční vložení, web nebo
              Project Gutenberg.
            </p>
          </div>

          <div>
            <label
              htmlFor="source_reference"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Reference zdroje
            </label>
            <input
              id="source_reference"
              name="source_reference"
              type="text"
              value={formState.source_reference}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  source_reference: e.target.value,
                }))
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinný odkaz, poznámka nebo identifikátor zdroje.
            </p>
          </div>
        </section>

        <WorkBlocksEditor blocks={blocks} setBlocks={setBlocks} />

        <input
          type="hidden"
          name="content_blocks_json"
          value={JSON.stringify(blocks)}
        />

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              padding: "12px 18px",
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Uložit dílo
          </button>
        </div>
      </form>
    </>
  )
}