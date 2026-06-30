"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyBlock,
  getWorkBlockTypeOptions,
  type WorkBlock,
  type WorkBlockType,
} from "@/lib/blocks";
import StorageImageDisplay from "@/components/media/StorageImageDisplay";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ARTALES_IMAGES_BUCKET,
  ARTALES_IMAGE_MAX_UPLOAD_BYTES,
  buildWorkInlineImageStoragePath,
  isAllowedArtalesImageMimeType,
} from "@/lib/storageImages";
import { slugify } from "@/lib/slug";

type Props = {
  blocks: WorkBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<WorkBlock[]>>;
  workSlug?: string;
  workTitle?: string;
};

const LARGE_WORK_BLOCK_COUNT = 80;

type ImageFieldName =
  | "image_request"
  | "storage_path"
  | "alt"
  | "caption"
  | "alignment"
  | "size"
  | "source_note";

function getBlockTitle(block: WorkBlock, index: number) {
  const prefix = `${index + 1}.`;

  if (
    block.type === "book_part" ||
    block.type === "chapter" ||
    block.type === "headline"
  ) {
    const text = block.content.trim();
    return `${prefix} ${text || "Bez názvu"}`;
  }

  if (block.type === "letter") {
    const place = String(block.fields?.place_year ?? "").trim();
    const body = String(block.fields?.body ?? block.content ?? "").trim();
    return `${prefix} Dopis${place ? `: ${place}` : body ? `: ${body.slice(0, 42)}` : ""}`;
  }

  if (block.type === "image") {
    const request = String(block.fields?.image_request ?? "").trim();
    const caption = String(block.fields?.caption ?? "").trim();
    return `${prefix} Obrázek${caption ? `: ${caption.slice(0, 42)}` : request ? `: ${request.slice(0, 42)}` : ""}`;
  }

  if (block.type === "separator") return `${prefix} Předěl · * * *`;

  const text = block.content.trim();
  return `${prefix} ${text ? text.slice(0, 46) : "Prázdný blok"}`;
}

export default function WorkBlocksEditor({
  blocks,
  setBlocks,
  workSlug = "",
  workTitle = "",
}: Props) {
  const blockTypeOptions = useMemo(() => getWorkBlockTypeOptions(), []);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(
    null,
  );
  const [imageUploadState, setImageUploadState] = useState<Record<string, { isUploading?: boolean; message?: string; error?: string }>>({});
  const [activeLargeBlockId, setActiveLargeBlockId] = useState<string | null>(
    blocks[0]?.id ?? null,
  );
  const uploadedInlineImagePathsRef = useRef<Set<string>>(new Set());

  const isLargeWorkMode = blocks.length > LARGE_WORK_BLOCK_COUNT;
  const visibleBlockEntries = useMemo(() => {
    if (!isLargeWorkMode) {
      return blocks.map((block, index) => ({ block, index }));
    }

    const activeIndex = blocks.findIndex(
      (block) => block.id === activeLargeBlockId,
    );
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const block = blocks[safeIndex];

    return block ? [{ block, index: safeIndex }] : [];
  }, [activeLargeBlockId, blocks, isLargeWorkMode]);

  useEffect(() => {
    if (blocks.length === 0) {
      setActiveLargeBlockId(null);
      return;
    }

    if (!activeLargeBlockId || !blocks.some((block) => block.id === activeLargeBlockId)) {
      setActiveLargeBlockId(blocks[0]?.id ?? null);
    }
  }, [activeLargeBlockId, blocks]);

  function normalizeBlockForType(
    block: WorkBlock,
    type: WorkBlockType,
  ): WorkBlock {
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
      };
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
          source_note: block.fields?.source_note ?? "",
        },
      };
    }

    return {
      ...block,
      type,
      content: type === "separator" ? "* * *" : (block.content ?? ""),
      fields: undefined,
    };
  }

  function updateBlock(index: number, patch: Partial<WorkBlock>) {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  }

  function updateBlockType(index: number, type: WorkBlockType) {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === index ? normalizeBlockForType(block, type) : block,
      ),
    );
  }

  function updateLetterField(
    index: number,
    fieldName: "place_year" | "body" | "date_signature",
    value: string,
  ) {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== index) return block;

        const nextFields = {
          place_year: block.fields?.place_year ?? "",
          body: block.fields?.body ?? block.content ?? "",
          date_signature: block.fields?.date_signature ?? "",
          [fieldName]: value,
        };

        return {
          ...block,
          content: fieldName === "body" ? value : String(nextFields.body ?? ""),
          fields: nextFields,
        };
      }),
    );
  }

  function updateImageField(
    index: number,
    fieldName: ImageFieldName,
    value: string,
  ) {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== index) return block;

        const nextFields = {
          image_request: block.fields?.image_request ?? "",
          storage_path: block.fields?.storage_path ?? block.content ?? "",
          alt: block.fields?.alt ?? "",
          caption: block.fields?.caption ?? "",
          alignment: block.fields?.alignment ?? "center",
          size: block.fields?.size ?? "normal",
          source_note: block.fields?.source_note ?? "",
          [fieldName]: value,
        };

        return {
          ...block,
          content:
            fieldName === "storage_path"
              ? value
              : String(nextFields.storage_path ?? ""),
          fields: nextFields,
        };
      }),
    );
  }

  function setImageUploadPatch(
    blockId: string,
    patch: { isUploading?: boolean; message?: string; error?: string },
  ) {
    setImageUploadState((prev) => ({
      ...prev,
      [blockId]: { ...(prev[blockId] ?? {}), ...patch },
    }));
  }

  async function removeUnsavedInlineImage(path: string) {
    if (!uploadedInlineImagePathsRef.current.has(path)) return;

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .remove([path]);

      if (!error) {
        uploadedInlineImagePathsRef.current.delete(path);
      }
    } catch {
      // Best-effort cleanup only. A failed cleanup must not block editing.
    }
  }

  async function uploadInlineImage(index: number, file: File | null) {
    const block = blocks[index];
    if (!block || block.type !== "image") return;

    setImageUploadPatch(block.id, { error: undefined, message: undefined });

    if (!file) return;

    if (!isAllowedArtalesImageMimeType(file.type)) {
      setImageUploadPatch(block.id, {
        error: "Podporované formáty jsou JPG, PNG a WebP.",
      });
      return;
    }

    if (file.size > ARTALES_IMAGE_MAX_UPLOAD_BYTES) {
      setImageUploadPatch(block.id, {
        error: "Soubor je příliš velký. Maximální velikost obrázku je 5 MB.",
      });
      return;
    }

    const slug = slugify(workSlug || workTitle);

    if (!slug) {
      setImageUploadPatch(block.id, {
        error: "Nejdřív vyplň název nebo slug díla. Podle něj se vytvoří cesta obrázku.",
      });
      return;
    }

    setImageUploadPatch(block.id, { isUploading: true });

    try {
      const previousPath = String(block.fields?.storage_path ?? block.content ?? "").trim();
      const storagePath = buildWorkInlineImageStoragePath({
        workSlug: slug,
        blockId: block.id,
        mimeType: file.type,
      });
      const supabase = createBrowserSupabaseClient();

      const { error } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        setImageUploadPatch(block.id, {
          isUploading: false,
          error: `Obrázek se nepodařilo nahrát: ${error.message}`,
        });
        return;
      }

      uploadedInlineImagePathsRef.current.add(storagePath);

      if (previousPath && previousPath !== storagePath) {
        await removeUnsavedInlineImage(previousPath);
      }

      updateImageField(index, "storage_path", storagePath);

      const currentAlt = String(block.fields?.alt ?? "").trim();
      if (!currentAlt) {
        updateImageField(index, "alt",
          workTitle.trim() ? `Ilustrace k dílu ${workTitle.trim()}` : "Ilustrace v díle",
        );
      }

      setImageUploadPatch(block.id, {
        isUploading: false,
        message: "Obrázek byl nahrán. Ulož dílo, aby se změna propsala do databáze.",
        error: undefined,
      });
    } finally {
      setImageUploadPatch(block.id, { isUploading: false });
    }
  }

  function addBlock(type: WorkBlockType = "paragraph") {
    setBlocks((prev) => [...prev, createEmptyBlock(type)]);
  }

  function insertBlockAfter(index: number, type: WorkBlockType = "paragraph") {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, createEmptyBlock(type));
      return next;
    });
  }

  function duplicateBlock(index: number) {
    setBlocks((prev) => {
      const source = prev[index];
      if (!source) return prev;

      const clone: WorkBlock = {
        ...source,
        id: crypto.randomUUID(),
        fields: source.fields ? { ...source.fields } : undefined,
        editor_note: source.editor_note ?? null,
      };

      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
  }

  const fieldStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid rgba(13, 21, 40, 0.22)",
    borderRadius: "12px",
    background: "#fffefb",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.85)",
    fontSize: "15px",
  } as const;

  const compactFieldStyle = {
    ...fieldStyle,
    padding: "10px 12px",
  } as const;

  const editorButtonStyle = {
    padding: "7px 10px",
    border: "1px solid rgba(13, 21, 40, 0.2)",
    borderRadius: "999px",
    background: "#fffefb",
    color: "#0d1528",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
  } as const;

  const quickAddButtonStyle = {
    padding: "9px 12px",
    border: "1px solid rgba(13, 21, 40, 0.18)",
    borderRadius: "999px",
    background: "#fffefb",
    color: "#0d1528",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
  } as const;

  function removeBlock(index: number) {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createEmptyBlock("chapter")];
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const current = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = current;
      return next;
    });
  }

  function scrollToBlock(blockId: string) {
    if (isLargeWorkMode) {
      setActiveLargeBlockId(blockId);
      window.setTimeout(() => {
        const element = document.getElementById(`work-block-editor-${blockId}`);
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
        setHighlightedBlockId(blockId);
        window.setTimeout(() => setHighlightedBlockId(null), 1600);
      }, 0);
      return;
    }

    const element = document.getElementById(`work-block-editor-${blockId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedBlockId(blockId);
    window.setTimeout(() => setHighlightedBlockId(null), 1600);
  }

  return (
    <section
      style={{
        border: "1px solid rgba(13, 21, 40, 0.16)",
        borderRadius: "24px",
        background: "rgba(255, 253, 247, 0.82)",
        boxShadow: "0 18px 44px rgba(13, 21, 40, 0.08)",
        padding: "24px",
        display: "grid",
        gap: "18px",
      }}
    >
      <div>
        <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Obsahové bloky</h2>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Skládej text z předdefinovaných bloků. Obrázkový blok je samostatný
          celek mezi odstavci: editor může rovnou nahrát soubor, doplnit alt
          text, popisek a kredit. Prázdný image blok lze uložit jako draft,
          ale před zveřejněním je potřeba obrázky doplnit.
        </p>
        {isLargeWorkMode ? (
          <div
            role="status"
            style={{
              border: "1px solid rgba(199, 163, 90, 0.42)",
              borderRadius: "16px",
              background: "#fff8ed",
              color: "#4a3218",
              marginTop: "14px",
              padding: "12px 14px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Velké dílo: editor zobrazuje vždy jen jeden vybraný blok.
            Celý obsah se uloží najednou tlačítkem Uložit, ale stránka
            nemusí současně renderovat všechny bloky románu.
          </div>
        ) : null}
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
          {visibleBlockEntries.map(({ block, index }) => {
            const selectedTypeMeta =
              blockTypeOptions.find((option) => option.value === block.type) ??
              blockTypeOptions[0];

            const isLetter = block.type === "letter";
            const isImage = block.type === "image";
            const isSeparator = block.type === "separator";
            const isHighlighted = highlightedBlockId === block.id;

            return (
              <article
                key={block.id}
                id={`work-block-editor-${block.id}`}
                style={{
                  border: isHighlighted
                    ? "2px solid #c7a35a"
                    : "1px solid rgba(13, 21, 40, 0.16)",
                  borderRadius: "20px",
                  background: "#fffdf8",
                  boxShadow: isHighlighted
                    ? "0 0 0 4px rgba(199, 163, 90, 0.16), 0 14px 34px rgba(13, 21, 40, 0.09)"
                    : "0 10px 26px rgba(13, 21, 40, 0.06)",
                  padding: "18px",
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

                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      onClick={() => moveBlock(index, -1)}
                      style={editorButtonStyle}
                    >
                      ↑ Nahoru
                    </button>

                    <button
                      type="button"
                      onClick={() => moveBlock(index, 1)}
                      style={editorButtonStyle}
                    >
                      ↓ Dolů
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateBlock(index)}
                      style={editorButtonStyle}
                    >
                      ⧉ Duplikovat
                    </button>

                    <button
                      type="button"
                      onClick={() => insertBlockAfter(index, "paragraph")}
                      style={editorButtonStyle}
                    >
                      + Za blok
                    </button>

                    <button
                      type="button"
                      onClick={() => removeBlock(index)}
                      style={{
                        ...editorButtonStyle,
                        border: "1px solid rgba(154, 62, 62, 0.35)",
                        background: "#fff4f2",
                        color: "#782222",
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
                    style={compactFieldStyle}
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
                      <label
                        htmlFor={`block-letter-place-year-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Místo / letopočet
                      </label>
                      <input
                        id={`block-letter-place-year-${block.id}`}
                        type="text"
                        value={String(block.fields?.place_year ?? "")}
                        onChange={(e) =>
                          updateLetterField(index, "place_year", e.target.value)
                        }
                        placeholder="Např. Whitby, 1897"
                        style={fieldStyle}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`block-letter-body-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Tělo dopisu
                      </label>
                      <textarea
                        id={`block-letter-body-${block.id}`}
                        value={String(
                          block.fields?.body ?? block.content ?? "",
                        )}
                        onChange={(e) =>
                          updateLetterField(index, "body", e.target.value)
                        }
                        rows={8}
                        required
                        style={{
                          ...fieldStyle,
                          resize: "vertical",
                          whiteSpace: "pre-wrap",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`block-letter-date-signature-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Datum / podpis
                      </label>
                      <input
                        id={`block-letter-date-signature-${block.id}`}
                        type="text"
                        value={String(block.fields?.date_signature ?? "")}
                        onChange={(e) =>
                          updateLetterField(
                            index,
                            "date_signature",
                            e.target.value,
                          )
                        }
                        placeholder="Např. 12. května, Mina"
                        style={fieldStyle}
                      />
                    </div>
                  </>
                ) : isImage ? (
                  <>
                    {(() => {
                      const imagePath = String(
                        block.fields?.storage_path ?? block.content ?? "",
                      ).trim();
                      const imageCaption = String(block.fields?.caption ?? "").trim();
                      const imageAlt = String(block.fields?.alt ?? "").trim();
                      const sourceNote = String(block.fields?.source_note ?? block.fields?.image_request ?? "").trim();
                      const uploadState = imageUploadState[block.id] ?? {};

                      return (
                        <div
                          style={{
                            border: imagePath
                              ? "1px solid rgba(91, 132, 82, 0.3)"
                              : "1px solid rgba(199, 163, 90, 0.38)",
                            borderRadius: "16px",
                            background: imagePath ? "#f4fff0" : "#fff7e8",
                            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
                            padding: "14px",
                            display: "grid",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <strong>Obrázek v díle</strong>
                            <p
                              style={{
                                margin: "8px 0 0",
                                fontSize: "14px",
                                opacity: 0.78,
                              }}
                            >
                              Obrázek se ukládá do ARTales Storage a v textu zůstává
                              jako samostatný image blok. Draft lze uložit i bez
                              obrázku; zveřejnění ale prázdný image blok zastaví.
                            </p>
                          </div>

                          <input
                            id={`block-image-upload-${block.id}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              void uploadInlineImage(index, event.target.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                            style={{ display: "none" }}
                          />

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(180px, 280px) minmax(0, 1fr)",
                              gap: "14px",
                              alignItems: "start",
                            }}
                          >
                            <StorageImageDisplay
                              title={imageCaption || sourceNote || "Obrázek v díle"}
                              imagePath={imagePath}
                              alt={imageAlt}
                              caption={imageCaption}
                              variant="editor-preview"
                            />

                            <div style={{ display: "grid", gap: "10px" }}>
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  disabled={Boolean(uploadState.isUploading)}
                                  onClick={() =>
                                    document.getElementById(`block-image-upload-${block.id}`)?.click()
                                  }
                                  style={{
                                    ...editorButtonStyle,
                                    border: "1px solid #0d1528",
                                    background: uploadState.isUploading ? "#6b7280" : "#0d1528",
                                    color: "#fff",
                                    cursor: uploadState.isUploading ? "wait" : "pointer",
                                  }}
                                >
                                  {uploadState.isUploading ? "Nahrávám…" : imagePath ? "Nahrát jiný obrázek" : "Nahrát obrázek"}
                                </button>

                                {imagePath ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const removedPath = imagePath;
                                      updateImageField(index, "storage_path", "");
                                      setImageUploadPatch(block.id, {
                                        message: "Obrázek byl odebrán z bloku. Ulož dílo, aby se změna propsala do databáze.",
                                        error: undefined,
                                      });
                                      void removeUnsavedInlineImage(removedPath);
                                    }}
                                    style={editorButtonStyle}
                                  >
                                    Odebrat z bloku
                                  </button>
                                ) : null}
                              </div>

                              {uploadState.error ? (
                                <p style={{ margin: 0, color: "#9f1239", fontSize: "14px" }}>
                                  {uploadState.error}
                                </p>
                              ) : null}

                              {uploadState.message ? (
                                <p style={{ margin: 0, color: "#166534", fontSize: "14px" }}>
                                  {uploadState.message}
                                </p>
                              ) : null}

                              {!imagePath ? (
                                <p style={{ margin: 0, color: "#8a4b10", fontSize: "14px" }}>
                                  Chybí obrázek. Draft můžeš uložit, ale před zveřejněním
                                  prosím doplň obrázky.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <label
                        htmlFor={`block-image-source-note-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Poznámka / původní označení obrázku
                      </label>
                      <input
                        id={`block-image-source-note-${block.id}`}
                        type="text"
                        value={String(block.fields?.source_note ?? block.fields?.image_request ?? "")}
                        onChange={(e) => {
                          updateImageField(index, "source_note", e.target.value);
                          updateImageField(index, "image_request", e.target.value);
                        }}
                        placeholder="Např. Obrázek 2 – Mapa okolí / místo obrázku z parseru"
                        style={fieldStyle}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`block-image-alt-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Alt text
                      </label>
                      <input
                        id={`block-image-alt-${block.id}`}
                        type="text"
                        value={String(block.fields?.alt ?? "")}
                        onChange={(e) =>
                          updateImageField(index, "alt", e.target.value)
                        }
                        placeholder="Krátký věcný popis obrázku"
                        style={fieldStyle}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`block-image-caption-${block.id}`}
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontWeight: 600,
                        }}
                      >
                        Popisek / kredit
                      </label>
                      <input
                        id={`block-image-caption-${block.id}`}
                        type="text"
                        value={String(block.fields?.caption ?? "")}
                        onChange={(e) =>
                          updateImageField(index, "caption", e.target.value)
                        }
                        placeholder="Nepovinný veřejný popisek nebo kredit"
                        style={fieldStyle}
                      />
                    </div>
                  </>
                ) : (
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
                        updateBlock(index, { content: e.target.value })
                      }
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
                      style={{
                        ...fieldStyle,
                        resize: "vertical",
                        whiteSpace: "pre-wrap",
                        textAlign: isSeparator ? "center" : "left",
                      }}
                    />
                    {isSeparator ? (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "14px",
                          opacity: 0.72,
                        }}
                      >
                        Výchozí předěl je <strong>* * *</strong>, zarovnaný na
                        střed. Ve čtečce má rozestup 0,2 cm nad i pod.
                      </p>
                    ) : null}
                  </div>
                )}

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
                    style={{ ...fieldStyle, resize: "vertical" }}
                  />
                </div>
              </article>
            );
          })}
        </div>

        <aside
          style={{
            border: "1px solid rgba(13, 21, 40, 0.16)",
            borderRadius: "18px",
            background: "#fffdf8",
            boxShadow: "0 12px 30px rgba(13, 21, 40, 0.08)",
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
          <ol
            style={{
              display: "grid",
              gap: "6px",
              margin: 0,
              paddingLeft: "20px",
            }}
          >
            {blocks.map((block, index) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => scrollToBlock(block.id)}
                  style={{
                    background:
                      isLargeWorkMode && block.id === activeLargeBlockId
                        ? "rgba(199, 163, 90, 0.16)"
                        : "transparent",
                    border: 0,
                    borderRadius: "8px",
                    color: "#241f19",
                    cursor: "pointer",
                    font: "inherit",
                    padding: "4px 6px",
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

      <div
        style={{
          border: "1px solid rgba(13, 21, 40, 0.14)",
          borderRadius: "18px",
          background: "#fffdf8",
          padding: "14px",
          display: "grid",
          gap: "10px",
        }}
      >
        <strong>Rychlé vložení bloku</strong>
        <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
          {blockTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => addBlock(option.value)}
              style={{
                ...quickAddButtonStyle,
                border:
                  option.value === "paragraph"
                    ? "1px solid rgba(13, 21, 40, 0.85)"
                    : option.value === "image"
                      ? "1px solid rgba(199, 163, 90, 0.75)"
                      : quickAddButtonStyle.border,
                background:
                  option.value === "paragraph"
                    ? "#0d1528"
                    : option.value === "image"
                      ? "#fff7e8"
                      : quickAddButtonStyle.background,
                color:
                  option.value === "paragraph"
                    ? "#fff"
                    : quickAddButtonStyle.color,
              }}
              title={option.help}
            >
              + {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
