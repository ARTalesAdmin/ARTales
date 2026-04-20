"use client"

import { useEffect, useMemo, useState } from "react"
import WorkBlocksEditor from "./WorkBlocksEditor"
import { createEmptyBlock, type WorkBlock } from "@/lib/blocks"

type Props = {
  mode: "new" | "edit"
  slug?: string
  success?: string

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

  secondaryLink?: {
    href: string
    label: string
  }
}

function getStorageKey(mode: "new" | "edit", slug?: string) {
  return mode === "new"
    ? "artales-work-draft-new"
    : `artales-work-draft-edit:${slug}`
}

type DraftPayload = {
  form: {
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
  }
  blocks: WorkBlock[]
  updated_at: string
}

export default function WorkEditorForm(props: Props) {
  const {
    mode,
    slug,
    success,
    initialData,
    authors,
    collections,
    languageOptions,
    statusOptions,
    action,
    secondaryLink,
  } = props

  const storageKey = useMemo(() => getStorageKey(mode, slug), [mode, slug])

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
    initialData.blocks.length > 0 ? initialData.blocks : [createEmptyBlock("chapter")]
  )

  const [hasDraft, setHasDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // Vyčištění draftu po úspěšném uložení
  useEffect(() => {
    if (!success) return

    localStorage.removeItem(storageKey)

    if (success === "work_created") {
      localStorage.removeItem("artales-work-draft-new")
    }

    setHasDraft(false)
    setLastSaved(null)
  }, [success, storageKey])

  // Zjistit, jestli draft existuje
  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as DraftPayload
      setHasDraft(true)
      setLastSaved(parsed.updated_at ?? null)
    } catch {
      // ignore broken draft
    }
  }, [storageKey])

  // Autosave s debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload: DraftPayload = {
        form: formState,
        blocks,
        updated_at: new Date().toISOString(),
      }

      localStorage.setItem(storageKey, JSON.stringify(payload))
      setLastSaved(payload.updated_at)
    }, 700)

    return () => clearTimeout(timer)
  }, [formState, blocks, storageKey])

  function restoreDraft() {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as DraftPayload

      if (parsed.form) {
        setFormState(parsed.form)
      }

      if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        setBlocks(parsed.blocks)
      }

      setHasDraft(false)
    } catch {
      // ignore
    }
  }

  function discardDraft() {
    localStorage.removeItem(storageKey)
    setHasDraft(false)
    setLastSaved(null)
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
            {mode === "edit"
              ? " U editace může být lokální návrh odlišný od aktuálně uložené verze v databázi."
              : null}
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

        <WorkBlocksEditor blocks={blocks} onChange={setBlocks} />

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
            {mode === "new" ? "Uložit dílo" : "Uložit změny"}
          </button>

          {secondaryLink ? (
            <a
              href={secondaryLink.href}
              style={{
                padding: "12px 18px",
                border: "1px solid #ccc",
                textDecoration: "none",
                color: "#111",
              }}
            >
              {secondaryLink.label}
            </a>
          ) : null}
        </div>
      </form>
    </>
  )
}