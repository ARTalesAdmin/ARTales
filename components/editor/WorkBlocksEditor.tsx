"use client"

import { useMemo } from "react"
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

export default function WorkBlocksEditor({ blocks, setBlocks }: Props) {
  const blockTypeOptions = useMemo(() => getWorkBlockTypeOptions(), [])

  function updateBlock(index: number, patch: Partial<WorkBlock>) {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block))
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
          Skládej text z předdefinovaných bloků. Každý blok kromě předělu musí
          mít obsah. Interní poznámka k bloku se neukládá pro čtenáře, jen pro
          editora.
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {blocks.map((block, index) => {
          const selectedTypeMeta =
            blockTypeOptions.find((option) => option.value === block.type) ??
            blockTypeOptions[0]

          return (
            <article
              key={block.id}
              style={{
                border: "1px solid #ccc",
                padding: "16px",
                display: "grid",
                gap: "12px",
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
                    updateBlock(index, {
                      type: e.target.value as WorkBlockType,
                    })
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

              <div>
                <label
                  htmlFor={`block-content-${block.id}`}
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Obsah bloku
                </label>

                <textarea
                  id={`block-content-${block.id}`}
                  value={block.content}
                  onChange={(e) =>
                    updateBlock(index, {
                      content: e.target.value,
                    })
                  }
                  rows={block.type === "poem" || block.type === "letter" ? 8 : 6}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                    resize: "vertical",
                    whiteSpace: "pre-wrap",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor={`block-note-${block.id}`}
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Interní poznámka k bloku
                </label>

                <textarea
                  id={`block-note-${block.id}`}
                  value={block.editor_note ?? ""}
                  onChange={(e) =>
                    updateBlock(index, {
                      editor_note:
                        e.target.value.trim() === "" ? null : e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Např. sem patří obrázek XY, pro tisk raději na novou stránku…"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                    resize: "vertical",
                  }}
                />
              </div>
            </article>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => addBlock("paragraph")}
          style={{
            padding: "10px 14px",
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat odstavec
        </button>

        <button
          type="button"
          onClick={() => addBlock("chapter")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat kapitolu
        </button>

        <button
          type="button"
          onClick={() => addBlock("quote")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat citaci
        </button>

        <button
          type="button"
          onClick={() => addBlock("poem")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat báseň
        </button>

        <button
          type="button"
          onClick={() => addBlock("letter")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat dopis
        </button>

        <button
          type="button"
          onClick={() => addBlock("separator")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat předěl
        </button>

        <button
          type="button"
          onClick={() => addBlock("note")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat poznámku
        </button>

                <button
          type="button"
          onClick={() => addBlock("dedication")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat věnování
        </button>

        <button
          type="button"
          onClick={() => addBlock("preface")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat předmluvu
        </button>

        <button
          type="button"
          onClick={() => addBlock("afterword")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat doslov
        </button>

        <button
          type="button"
          onClick={() => addBlock("acknowledgement")}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Přidat poděkování
        </button>
        
      </div>
    </section>
  )
}