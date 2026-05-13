"use client"

import { useMemo, useState } from "react"
import {
  createEmptyBlock,
  getWorkBlockTypeOptions,
  type WorkBlock,
  type WorkBlockType,
} from "@/lib/blocks"

type Props = {
  blocks: WorkBlock[]
  setBlocks: React.Dispatch<React.SetStateAction<WorkBlock[]>>
}

type ImageFieldName =
  | "image_request"
  | "storage_path"
  | "alt"
  | "caption"
  | "alignment"
  | "size"

function getBlockTitle(block: WorkBlock, index: number) {
  const prefix = `${index + 1}.`

  if (block.type === "book_part" || block.type === "chapter" || block.type === "headline") {
    const text = block.content.trim()
    return `${prefix} ${text || "Bez názvu"}`
  }

  if (block.type === "letter") {
    const place = String(block.fields?.place_year ?? "").trim()
    const body = String(block.fields?.body ?? block.content ?? "").trim()
    return `${prefix} Dopis${place ? `: ${place}` : body ? `: ${body.slice(0, 42)}` : ""}`
  }

  if (block.type === "image") {
    const request = String(block.fields?.image_request ?? "").trim()
    const caption = String(block.fields?.caption ?? "").trim()
    return `${prefix} Obrázek${caption ? `: ${caption.slice(0, 42)}` : request ? `: ${request.slice(0, 42)}` : ""}`
  }

  if (block.type === "separator") return `${prefix} Předěl · * * *`

  const text = block.content.trim()
  return `${prefix} ${text ? text.slice(0, 46) : "Prázdný blok"}`
}

export default function WorkBlocksEditor({ blocks, setBlocks }: Props) {
  const blockTypeOptions = useMemo(() => getWorkBlockTypeOptions(), [])
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)

  function normalizeBlockForType(block: WorkBlock, type: WorkBlockType): WorkBlock {
    if (type === "letter") {
      return {
        ...block,
        type,
        content: block.content ?? "",
        fields: {
          place_year: block.fields?.place_year ?? "",
          body: block.fields?.body ?? block.content ?? "",
          date_signature: block.fields?.date_signature ?? "",
        },
      }
    }

    if (type === "image") {
      return {
        ...block,
        type,
        content: block.fields?.storage_path ?? block.content ?? "",
        fields: {
          image_request: block.fields?.image_request ?? "",
          storage_path: block.fields?.storage_path ?? block.content ?? "",
          alt: block.fields?.alt ?? "",
          caption: block.fields?.caption ?? "",
          alignment: block.fields?.alignment ?? "center",
          size: block.fields?.size ?? "normal",
        },
      }
    }

    return {
      ...block,
      type,
      content: type === "separator" ? "* * *" : block.content ?? "",
      fields: undefined,
    }
  }

  function updateBlock(index: number, patch: Partial<WorkBlock>) {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block))
    )
  }

  function updateBlockType(index: number, type: WorkBlockType) {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === index ? normalizeBlockForType(block, type) : block
      )
    )
  }

  function updateLetterField(
    index: number,
    fieldName: "place_year" | "body" | "date_signature",
    value: string
  ) {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== index) return block

        const nextFields = {
          place_year: block.fields?.place_year ?? "",
          body: block.fields?.body ?? block.content ?? "",
          date_signature: block.fields?.date_signature ?? "",
          [fieldName]: value,
        }

        return {
          ...block,
          content: fieldName === "body" ? value : String(nextFields.body ?? ""),
          fields: nextFields,
        }
      })
    )
  }

  function updateImageField(index: number, fieldName: ImageFieldName, value: string) {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== index) return block

        const nextFields = {
          image_request: block.fields?.image_request ?? "",
          storage_path: block.fields?.storage_path ?? block.content ?? "",
          alt: block.fields?.alt ?? "",
          caption: block.fields?.caption ?? "",
          alignment: block.fields?.alignment ?? "center",
          size: block.fields?.size ?? "normal",
          [fieldName]: value,
        }

        return {
          ...block,
          content:
            fieldName === "storage_path"
              ? value
              : String(nextFields.storage_path ?? ""),
          fields: nextFields,
        }
      })
    )
  }

  function addBlock(type: WorkBlockType = "paragraph") {
    setBlocks((prev) => [...prev, createEmptyBlock(type)])
  }

  function removeBlock(index: number) {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [createEmptyBlock("chapter")]
    })
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) return prev

      const next = [...prev]
      const current = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = current
      return next
    })
  }

  function scrollToBlock(blockId: string) {
    const element = document.getElementById(`work-block-editor-${blockId}`)
    if (!element) return

    element.scrollIntoView({ behavior: "smooth", block: "start" })
    setHighlightedBlockId(blockId)
    window.setTimeout(() => setHighlightedBlockId(null), 1600)
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        padding: "24px",
        display: "grid",
        gap: "18px",
      }}
    >
      <div>
        <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Obsahové bloky</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Skládej text z předdefinovaných bloků. U obrázků běžný editor vyplňuje
          hlavně název souboru / poznámku. Technickou cestu k obrázku doplňuje
          správce až po nahrání souboru do systému.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 280px)",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "16px" }}>
          {blocks.map((block, index) => {
            const selectedTypeMeta =
              blockTypeOptions.find((option) => option.value === block.type) ??
              blockTypeOptions[0]

            const isLetter = block.type === "letter"
            const isImage = block.type === "image"
            const isSeparator = block.type === "separator"
            const isHighlighted = highlightedBlockId === block.id

            return (
              <article
                key={block.id}
                id={`work-block-editor-${block.id}`}
                style={{
                  border: isHighlighted ? "2px solid #c7a35a" : "1px solid #ccc",
                  boxShadow: isHighlighted ? "0 0 0 4px rgba(199, 163, 90, 0.16)" : "none",
                  padding: "16px",
                  display: "grid",
                  gap: "12px",
                  scrollMarginTop: "24px",
                  transition: "border-color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <strong>
                    Blok {index + 1}: {selectedTypeMeta.label}
                  </strong>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, -1)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      ↑ Nahoru
                    </button>

                    <button
                      type="button"
                      onClick={() => moveBlock(index, 1)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      ↓ Dolů
                    </button>

                    <button
                      type="button"
                      onClick={() => removeBlock(index)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #c88",
                        background: "#fff7f7",
                        cursor: "pointer",
                      }}
                    >
                      Smazat
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`block-type-${block.id}`}
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: 600,
                    }}
                  >
                    Typ bloku
                  </label>

                  <select
                    id={`block-type-${block.id}`}
                    value={block.type}
                    onChange={(e) =>
                      updateBlockType(index, e.target.value as WorkBlockType)
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #ccc",
                      fontSize: "15px",
                    }}
                  >
                    {blockTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: "14px",
                      opacity: 0.75,
                    }}
                  >
                    {selectedTypeMeta.help}
                  </p>
                </div>

                {isLetter ? (
                  <>
                    <div>
                      <label htmlFor={`block-letter-place-year-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Místo / letopočet
                      </label>
                      <input
                        id={`block-letter-place-year-${block.id}`}
                        type="text"
                        value={String(block.fields?.place_year ?? "")}
                        onChange={(e) => updateLetterField(index, "place_year", e.target.value)}
                        placeholder="Např. Whitby, 1897"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                    </div>

                    <div>
                      <label htmlFor={`block-letter-body-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Tělo dopisu
                      </label>
                      <textarea
                        id={`block-letter-body-${block.id}`}
                        value={String(block.fields?.body ?? block.content ?? "")}
                        onChange={(e) => updateLetterField(index, "body", e.target.value)}
                        rows={8}
                        required
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px", resize: "vertical", whiteSpace: "pre-wrap" }}
                      />
                    </div>

                    <div>
                      <label htmlFor={`block-letter-date-signature-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Datum / podpis
                      </label>
                      <input
                        id={`block-letter-date-signature-${block.id}`}
                        type="text"
                        value={String(block.fields?.date_signature ?? "")}
                        onChange={(e) => updateLetterField(index, "date_signature", e.target.value)}
                        placeholder="Např. 12. května, Mina"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                    </div>
                  </>
                ) : isImage ? (
                  <>
                    <div
                      style={{
                        border: "1px solid #e3ded6",
                        background: "#fbfaf7",
                        padding: "14px",
                      }}
                    >
                      <strong>Workflow obrázku</strong>
                      <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.78 }}>
                        Editor nahraje soubor do sdílené složky a sem zapíše přesný
                        název souboru nebo krátkou poznámku. Správce později obrázek
                        technicky vloží a doplní cestu níže.
                      </p>
                    </div>

                    <div>
                      <label htmlFor={`block-image-request-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Název souboru / poznámka pro obrázek
                      </label>
                      <input
                        id={`block-image-request-${block.id}`}
                        type="text"
                        value={String(block.fields?.image_request ?? "")}
                        onChange={(e) => updateImageField(index, "image_request", e.target.value)}
                        placeholder="např. phantom-opera-cover-reference.jpg nebo Obrázek opery po 3. odstavci"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                    </div>

                    <div>
                      <label htmlFor={`block-image-storage-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Technická cesta obrázku (doplňuje správce)
                      </label>
                      <input
                        id={`block-image-storage-${block.id}`}
                        type="text"
                        value={String(block.fields?.storage_path ?? block.content ?? "")}
                        onChange={(e) => updateImageField(index, "storage_path", e.target.value)}
                        placeholder="works/{work_id}/images/image-001.webp"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                      <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.72 }}>
                        Běžný editor toto pole nemusí řešit. Slouží pro pozdější
                        napojení na interní úložiště obrázků.
                      </p>
                    </div>

                    <div>
                      <label htmlFor={`block-image-alt-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Alt text
                      </label>
                      <input
                        id={`block-image-alt-${block.id}`}
                        type="text"
                        value={String(block.fields?.alt ?? "")}
                        onChange={(e) => updateImageField(index, "alt", e.target.value)}
                        placeholder="Krátký věcný popis obrázku"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                    </div>

                    <div>
                      <label htmlFor={`block-image-caption-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                        Popisek / kredit
                      </label>
                      <input
                        id={`block-image-caption-${block.id}`}
                        type="text"
                        value={String(block.fields?.caption ?? "")}
                        onChange={(e) => updateImageField(index, "caption", e.target.value)}
                        placeholder="Nepovinný veřejný popisek nebo kredit"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label htmlFor={`block-image-alignment-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                          Zarovnání
                        </label>
                        <select
                          id={`block-image-alignment-${block.id}`}
                          value={String(block.fields?.alignment ?? "center")}
                          onChange={(e) => updateImageField(index, "alignment", e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", fontSize: "15px" }}
                        >
                          <option value="center">Na střed</option>
                          <option value="left">Vlevo</option>
                          <option value="right">Vpravo</option>
                          <option value="wide">Široce</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`block-image-size-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                          Velikost
                        </label>
                        <select
                          id={`block-image-size-${block.id}`}
                          value={String(block.fields?.size ?? "normal")}
                          onChange={(e) => updateImageField(index, "size", e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", fontSize: "15px" }}
                        >
                          <option value="normal">Normální</option>
                          <option value="wide">Široká</option>
                          <option value="full">Na šířku čtecí plochy</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor={`block-content-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                      Obsah bloku
                    </label>
                    <textarea
                      id={`block-content-${block.id}`}
                      value={block.content}
                      onChange={(e) => updateBlock(index, { content: e.target.value })}
                      rows={
                        block.type === "poem" ||
                        block.type === "newspaper_article" ||
                        block.type === "preface" ||
                        block.type === "afterword" ||
                        block.type === "acknowledgement"
                          ? 8
                          : isSeparator
                            ? 2
                            : 6
                      }
                      style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px", resize: "vertical", whiteSpace: "pre-wrap", textAlign: isSeparator ? "center" : "left" }}
                    />
                    {isSeparator ? (
                      <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.72 }}>
                        Výchozí předěl je <strong>* * *</strong>, zarovnaný na střed.
                        Ve čtečce má rozestup 0,2 cm nad i pod.
                      </p>
                    ) : null}
                  </div>
                )}

                <div>
                  <label htmlFor={`block-note-${block.id}`} style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                    Interní poznámka k bloku
                  </label>
                  <textarea
                    id={`block-note-${block.id}`}
                    value={block.editor_note ?? ""}
                    onChange={(e) =>
                      updateBlock(index, {
                        editor_note: e.target.value.trim() === "" ? null : e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Např. sem patří obrázek XY, pro tisk raději na novou stránku…"
                    style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "15px", resize: "vertical" }}
                  />
                </div>
              </article>
            )
          })}
        </div>

        <aside
          style={{
            border: "1px solid #e1d8cc",
            background: "#fbfaf7",
            padding: "14px",
            position: "sticky",
            top: "16px",
            maxHeight: "calc(100vh - 32px)",
            overflow: "auto",
          }}
        >
          <h3 style={{ margin: "0 0 10px" }}>Navigace bloků</h3>
          <p style={{ margin: "0 0 12px", fontSize: "13px", opacity: 0.72 }}>
            Klikni na položku a editor skočí na daný blok.
          </p>
          <ol style={{ display: "grid", gap: "6px", margin: 0, paddingLeft: "20px" }}>
            {blocks.map((block, index) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => scrollToBlock(block.id)}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "#241f19",
                    cursor: "pointer",
                    font: "inherit",
                    padding: "4px 0",
                    textAlign: "left",
                    textDecoration: "underline",
                  }}
                >
                  {getBlockTitle(block, index)}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => addBlock("paragraph")} style={{ padding: "10px 14px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" }}>
          Přidat odstavec
        </button>
        <button type="button" onClick={() => addBlock("chapter")} style={{ padding: "10px 14px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Přidat kapitolu
        </button>
        <button type="button" onClick={() => addBlock("image")} style={{ padding: "10px 14px", border: "1px solid #c7a35a", background: "#fbfaf7", cursor: "pointer", fontWeight: 600 }}>
          Přidat obrázek
        </button>
        <button type="button" onClick={() => addBlock("separator")} style={{ padding: "10px 14px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Přidat předěl
        </button>
        <button type="button" onClick={() => addBlock("letter")} style={{ padding: "10px 14px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Přidat dopis
        </button>
      </div>
    </section>
  )
}
