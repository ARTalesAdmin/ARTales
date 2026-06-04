"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WORK_BLOCK_TYPE_META, createEmptyBlock, type WorkBlock } from "@/lib/blocks";
import {
  ARTALES_TEXT_PREPROCESSOR_PROMPT,
  parseRawTextToWorkBlocks,
  type ParsedWorkBlocksResult,
} from "@/lib/textParser";
import WorkBlocksEditor from "./WorkBlocksEditor";

type Props = {
  mode: "new" | "edit";
  slug?: string;

  initialData: {
    title: string;
    slug: string;
    subtitle: string;
    summary: string;
    primary_author_id: string;
    collection_id: string;
    canonical_language: string;
    status: string;
    origin_type: string;
    source_label: string;
    source_reference: string;
    edition_title: string;
    edition_version: string;
    edition_language: string;
    original_language: string;
    edition_source_url: string;
    edition_license: string;
    edition_publisher: string;
    publication_year: string;
    isbn: string;
    isbn_status: string;
    isbn_note: string;
    edition_note_public: string;
    edition_note_internal: string;
    contributor_summary: string;
    cover_image_request: string;
    cover_image_path: string;
    cover_image_alt: string;
    cover_image_caption: string;
    blocks: WorkBlock[];
  };

  authors: { id: string; name: string }[];
  collections: { id: string; title: string }[];
  languageOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];

  action: (formData: FormData) => Promise<void>;
  clearDraftKeys?: string[];
  forcedAuthorId?: string;
};

function getStorageKey(mode: "new" | "edit", slug?: string) {
  return mode === "new"
    ? "artales-work-draft-new"
    : `artales-work-draft-edit:${slug}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(value);
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
    forcedAuthorId = "",
  } = props;

  const storageKey = getStorageKey(mode, slug);
  const returnTo =
    mode === "new" ? "/member/works/new" : `/member/works/${slug}/edit`;

  useEffect(() => {
    if (clearDraftKeys.length === 0) return;

    clearDraftKeys.forEach((key) => {
      localStorage.removeItem(key);
    });
  }, [clearDraftKeys]);

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
    edition_title: initialData.edition_title,
    edition_version: initialData.edition_version,
    edition_language: initialData.edition_language,
    original_language: initialData.original_language,
    edition_source_url: initialData.edition_source_url,
    edition_license: initialData.edition_license,
    edition_publisher: initialData.edition_publisher,
    publication_year: initialData.publication_year,
    isbn: initialData.isbn,
    isbn_status: initialData.isbn_status,
    isbn_note: initialData.isbn_note,
    edition_note_public: initialData.edition_note_public,
    edition_note_internal: initialData.edition_note_internal,
    contributor_summary: initialData.contributor_summary,
    cover_image_request: initialData.cover_image_request,
    cover_image_path: initialData.cover_image_path,
    cover_image_alt: initialData.cover_image_alt,
    cover_image_caption: initialData.cover_image_caption,
  });

  const [blocks, setBlocks] = useState<WorkBlock[]>(
    initialData.blocks.length > 0
      ? initialData.blocks
      : [createEmptyBlock("chapter")],
  );

  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [parserInput, setParserInput] = useState("");
  const [parserResult, setParserResult] = useState<ParsedWorkBlocksResult | null>(null);
  const [parserMessage, setParserMessage] = useState<string | null>(null);

  const summaryLength = formState.summary.trim().length;
  const hasBlocks = blocks.some((block) => {
    if (block.type === "separator") return true;
    if (block.type === "letter") {
      return String(block.fields?.body ?? block.content ?? "").trim() !== "";
    }
    if (block.type === "image") {
      return (
        String(block.fields?.storage_path ?? block.content ?? "").trim() !==
          "" ||
        String(block.fields?.image_request ?? "").trim() !== "" ||
        String(block.fields?.caption ?? "").trim() !== ""
      );
    }
    return block.content.trim() !== "";
  });
  const readinessItems = [
    { label: "Název", done: formState.title.trim() !== "" },
    { label: "Autor", done: formState.primary_author_id.trim() !== "" },
    {
      label: "Shrnutí 200–800 znaků",
      done: summaryLength >= 200 && summaryLength <= 800,
    },
    { label: "Obsahové bloky", done: hasBlocks },
    {
      label: "Obálka nebo poznámka k obálce",
      done:
        formState.cover_image_path.trim() !== "" ||
        formState.cover_image_request.trim() !== "",
    },
    {
      label: "Jazyk edice",
      done:
        formState.edition_language.trim() !== "" ||
        formState.canonical_language.trim() !== "",
    },
    {
      label: "Zdroj / licence / původ",
      done:
        formState.edition_license.trim() !== "" ||
        formState.source_reference.trim() !== "" ||
        formState.edition_source_url.trim() !== "",
    },
    {
      label: "Přispěvatelé / tiráž",
      done: formState.contributor_summary.trim() !== "",
    },
    {
      label: "Stav ISBN",
      done: formState.isbn_status.trim() !== "",
    },
  ];

  const currentSnapshot = useMemo(
    () =>
      stableStringify({
        form: formState,
        blocks,
      }),
    [formState, blocks],
  );

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
          edition_title: initialData.edition_title,
          edition_version: initialData.edition_version,
          edition_language: initialData.edition_language,
          original_language: initialData.original_language,
          edition_source_url: initialData.edition_source_url,
          edition_license: initialData.edition_license,
          edition_publisher: initialData.edition_publisher,
          publication_year: initialData.publication_year,
          isbn: initialData.isbn,
          isbn_status: initialData.isbn_status,
          isbn_note: initialData.isbn_note,
          edition_note_public: initialData.edition_note_public,
          edition_note_internal: initialData.edition_note_internal,
          contributor_summary: initialData.contributor_summary,
          cover_image_request: initialData.cover_image_request,
          cover_image_path: initialData.cover_image_path,
          cover_image_alt: initialData.cover_image_alt,
          cover_image_caption: initialData.cover_image_caption,
        },
        blocks:
          initialData.blocks.length > 0
            ? initialData.blocks
            : [createEmptyBlock("chapter")],
      }),
    [initialData],
  );

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      setDraftLoaded(true);
      setAutosaveEnabled(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const parsedForm = parsed.form ?? {};
      const parsedBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];

      const draftSnapshot = stableStringify({
        form: parsedForm,
        blocks: parsedBlocks,
      });

      if (draftSnapshot === initialSnapshot) {
        localStorage.removeItem(storageKey);
        setAutosaveEnabled(true);
        return;
      }

      // Speciální flow: návrat z vytvoření autora
      if (forcedAuthorId) {
        const nextFormState = {
          title: parsedForm.title ?? "",
          slug: parsedForm.slug ?? "",
          subtitle: parsedForm.subtitle ?? "",
          summary: parsedForm.summary ?? "",
          primary_author_id: forcedAuthorId,
          collection_id: parsedForm.collection_id ?? "",
          canonical_language: parsedForm.canonical_language ?? "cs",
          status: parsedForm.status ?? "draft",
          origin_type: parsedForm.origin_type ?? "original",
          source_label: parsedForm.source_label ?? "manual",
          source_reference: parsedForm.source_reference ?? "",
          edition_title: parsedForm.edition_title ?? "",
          edition_version: parsedForm.edition_version ?? "",
          edition_language: parsedForm.edition_language ?? parsedForm.canonical_language ?? "cs",
          original_language: parsedForm.original_language ?? "",
          edition_source_url: parsedForm.edition_source_url ?? "",
          edition_license: parsedForm.edition_license ?? "",
          edition_publisher: parsedForm.edition_publisher ?? "ARTales",
          publication_year: parsedForm.publication_year ?? "",
          isbn: parsedForm.isbn ?? "",
          isbn_status: parsedForm.isbn_status ?? "not_required",
          isbn_note: parsedForm.isbn_note ?? "",
          edition_note_public: parsedForm.edition_note_public ?? "",
          edition_note_internal: parsedForm.edition_note_internal ?? "",
          contributor_summary: parsedForm.contributor_summary ?? "",
          cover_image_request: parsedForm.cover_image_request ?? "",
          cover_image_path: parsedForm.cover_image_path ?? "",
          cover_image_alt: parsedForm.cover_image_alt ?? "",
          cover_image_caption: parsedForm.cover_image_caption ?? "",
        };

        setFormState(nextFormState);
        setBlocks(
          parsedBlocks.length > 0
            ? parsedBlocks
            : [createEmptyBlock("chapter")],
        );

        const nextPayload = {
          form: nextFormState,
          blocks:
            parsedBlocks.length > 0
              ? parsedBlocks
              : [createEmptyBlock("chapter")],
          updated_at: new Date().toISOString(),
        };

        localStorage.setItem(storageKey, JSON.stringify(nextPayload));
        setLastSaved(nextPayload.updated_at);
        setHasDraft(false);
        setAutosaveEnabled(true);
        return;
      }

      setHasDraft(true);
      setLastSaved(parsed.updated_at ?? null);
    } catch {
      localStorage.removeItem(storageKey);
      setAutosaveEnabled(true);
    } finally {
      setDraftLoaded(true);
    }
  }, [storageKey, initialSnapshot, forcedAuthorId]);

  useEffect(() => {
    if (!draftLoaded || !autosaveEnabled) return;

    const payload = {
      form: formState,
      blocks,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    setLastSaved(payload.updated_at);
  }, [formState, blocks, storageKey, draftLoaded, autosaveEnabled]);

  useEffect(() => {
    if (!forcedAuthorId || !draftLoaded) return;

    setFormState((prev) => ({
      ...prev,
      primary_author_id: forcedAuthorId,
    }));

    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      const next = {
        ...parsed,
        form: {
          ...(parsed.form ?? {}),
          primary_author_id: forcedAuthorId,
        },
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem(storageKey, JSON.stringify(next));
      setLastSaved(next.updated_at);
    } catch {
      // ignore broken draft
    }
  }, [forcedAuthorId, storageKey, draftLoaded]);

  function restoreDraft() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setHasDraft(false);
      setAutosaveEnabled(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);

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
          edition_title: parsed.form.edition_title ?? "",
          edition_version: parsed.form.edition_version ?? "",
          edition_language: parsed.form.edition_language ?? parsed.form.canonical_language ?? "cs",
          original_language: parsed.form.original_language ?? "",
          edition_source_url: parsed.form.edition_source_url ?? "",
          edition_license: parsed.form.edition_license ?? "",
          edition_publisher: parsed.form.edition_publisher ?? "ARTales",
          publication_year: parsed.form.publication_year ?? "",
          isbn: parsed.form.isbn ?? "",
          isbn_status: parsed.form.isbn_status ?? "not_required",
          isbn_note: parsed.form.isbn_note ?? "",
          edition_note_public: parsed.form.edition_note_public ?? "",
          edition_note_internal: parsed.form.edition_note_internal ?? "",
          contributor_summary: parsed.form.contributor_summary ?? "",
          cover_image_request: parsed.form.cover_image_request ?? "",
          cover_image_path: parsed.form.cover_image_path ?? "",
          cover_image_alt: parsed.form.cover_image_alt ?? "",
          cover_image_caption: parsed.form.cover_image_caption ?? "",
        });
      }

      if (Array.isArray(parsed.blocks)) {
        setBlocks(parsed.blocks);
      }

      setLastSaved(parsed.updated_at ?? null);
    } catch {
      // ignore broken draft
    }

    setHasDraft(false);
    setAutosaveEnabled(true);
  }

  function discardDraft() {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setLastSaved(null);
    setAutosaveEnabled(true);
  }

  function runParser() {
    const parsed = parseRawTextToWorkBlocks(parserInput);
    setParserResult(parsed);

    if (parsed.blocks.length === 0) {
      setParserMessage("Parser nenašel žádný použitelný blok. Zkontroluj vstupní text.");
      return;
    }

    setParserMessage(
      `Rozpoznáno ${parsed.blocks.length} bloků. Před vložením do díla prosím zkontroluj náhled.`,
    );
  }

  function replaceBlocksWithParserResult() {
    if (!parserResult || parserResult.blocks.length === 0) return;

    const shouldReplace = window.confirm(
      "Nahradit současné bloky výsledkem parseru? Aktuální bloky zůstanou zachované jen v lokálním autosave, dokud dílo znovu neuložíš.",
    );

    if (!shouldReplace) return;

    setBlocks(parserResult.blocks);
    setParserMessage("Bloky byly nahrazeny výsledkem parseru. Teď je můžeš ručně zkontrolovat a uložit dílo.");
  }

  function appendParserResult() {
    if (!parserResult || parserResult.blocks.length === 0) return;

    setBlocks((prev) => [...prev, ...parserResult.blocks]);
    setParserMessage("Bloky z parseru byly přidány na konec díla. Teď je můžeš ručně zkontrolovat a uložit dílo.");
  }

  async function copyParserAiPrompt() {
    try {
      await navigator.clipboard.writeText(ARTALES_TEXT_PREPROCESSOR_PROMPT);
      setParserMessage("AI prompt pro předzpracování textu byl zkopírován do schránky.");
    } catch {
      setParserMessage("Prompt se nepodařilo zkopírovat automaticky. Zkopíruj ho prosím ručně z pokynů parseru.");
    }
  }

  function clearParser() {
    setParserInput("");
    setParserResult(null);
    setParserMessage(null);
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
            Pokud od poslední práce uplynul delší čas, zvaž, jestli chceš
            obnovit lokální návrh, nebo pokračovat bez něj.
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

      <section
        className="artales-member-panel"
        style={{
          border: "1px solid rgba(13, 21, 40, 0.14)",
          background: "#fffdf8",
          padding: "18px",
          marginBottom: "22px",
          display: "grid",
          gap: "12px",
        }}
      >
        <h2 style={{ margin: 0 }}>Kontrola připravenosti</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {readinessItems.map((item) => (
            <span
              key={item.label}
              style={{
                border: `1px solid ${item.done ? "#b8cfa8" : "#e0c39a"}`,
                background: item.done ? "#f5fff1" : "#fff8ed",
                borderRadius: "999px",
                padding: "6px 10px",
                fontSize: "13px",
              }}
            >
              {item.done ? "✓" : "!"} {item.label}
            </span>
          ))}
        </div>
        {mode === "edit" && slug ? (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link
              href={`/dilo/${slug}`}
              target="_blank"
              style={{ color: "#111", textDecoration: "underline" }}
            >
              Otevřít veřejný detail
            </Link>
            <Link
              href={`/reader/${slug}?mode=preview`}
              target="_blank"
              style={{ color: "#111", textDecoration: "underline" }}
            >
              Otevřít ukázku ve čtečce
            </Link>
            <Link
              href={`/reader/${slug}?mode=full`}
              target="_blank"
              style={{ color: "#111", textDecoration: "underline" }}
            >
              Otevřít celé dílo ve čtečce
            </Link>
          </div>
        ) : null}
      </section>

      <form action={action} style={{ display: "grid", gap: "22px" }}>
        <section
          className="artales-member-panel"
          style={{
            border: "1px solid rgba(13, 21, 40, 0.14)",
            background: "#fffdf8",
            borderRadius: "22px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              URL identifikátor díla. Když ho nevyplníš, vytvoří se automaticky
              z názvu. Povolená jsou pouze malá písmena, čísla a pomlčky.
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Krátké představení díla pro galerii a detail. Povinné pole.
              Doporučený rozsah je 200–800 znaků. Aktuálně: {summaryLength}{" "}
              znaků.
            </p>
          </div>

          <div>
            <label
              htmlFor="primary_author_id"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Primární autor
            </label>

            <div style={{ marginBottom: "8px" }}>
              <Link
                href={`/member/authors/new?returnTo=${encodeURIComponent(returnTo)}`}
                style={{
                  fontSize: "14px",
                  textDecoration: "underline",
                }}
              >
                Nový autor
              </Link>
            </div>

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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
              Hlavní autor, pod kterým bude dílo vedeno. Povinné pole. Pokud
              autor ještě neexistuje, můžeš ho založit přes odkaz výše a po
              návratu bude automaticky vybraný.
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
              Hlavní jazyk díla. Ukládá se standardizovaný kód, editor vidí
              český popisek.
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
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
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                borderRadius: "12px",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinný odkaz, poznámka nebo identifikátor zdroje.
            </p>
          </div>

          <section
            style={{
              border: "1px solid rgba(13, 21, 40, 0.18)",
              borderRadius: "18px",
              padding: "20px",
              display: "grid",
              gap: "16px",
              background: "#fffaf0",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px" }}>Tiráž / edice</h3>
              <p style={{ margin: 0, fontSize: "14px", opacity: 0.78 }}>
                Ediční metadata určují, co přesně publikujeme: jazyk edice,
                původ, licenci, přispěvatele a případný stav ISBN. ISBN zde
                není interní ID díla; používá se až pro konkrétní vydání nebo
                distribuční formát.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="edition_title" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Název edice</label>
                <input id="edition_title" name="edition_title" type="text" value={formState.edition_title} onChange={(e) => setFormState((prev) => ({ ...prev, edition_title: e.target.value }))} placeholder="např. ARTales public-domain edition" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>

              <div>
                <label htmlFor="edition_version" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Verze edice</label>
                <input id="edition_version" name="edition_version" type="text" value={formState.edition_version} onChange={(e) => setFormState((prev) => ({ ...prev, edition_version: e.target.value }))} placeholder="např. v1.0, draft, annotated" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="edition_language" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Jazyk edice</label>
                <select id="edition_language" name="edition_language" value={formState.edition_language} onChange={(e) => setFormState((prev) => ({ ...prev, edition_language: e.target.value }))} style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }}>
                  <option value="">Použít hlavní jazyk díla</option>
                  {languageOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>

              <div>
                <label htmlFor="original_language" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Původní jazyk</label>
                <select id="original_language" name="original_language" value={formState.original_language} onChange={(e) => setFormState((prev) => ({ ...prev, original_language: e.target.value }))} style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }}>
                  <option value="">Nevyplněno / shodné</option>
                  {languageOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="edition_license" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Licence / práva</label>
                <input id="edition_license" name="edition_license" type="text" value={formState.edition_license} onChange={(e) => setFormState((prev) => ({ ...prev, edition_license: e.target.value }))} placeholder="např. Public domain, CC BY, interní práva" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>

              <div>
                <label htmlFor="edition_source_url" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>URL zdroje</label>
                <input id="edition_source_url" name="edition_source_url" type="url" value={formState.edition_source_url} onChange={(e) => setFormState((prev) => ({ ...prev, edition_source_url: e.target.value }))} placeholder="https://..." style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="edition_publisher" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Vydavatel / imprint</label>
                <input id="edition_publisher" name="edition_publisher" type="text" value={formState.edition_publisher} onChange={(e) => setFormState((prev) => ({ ...prev, edition_publisher: e.target.value }))} placeholder="ARTales" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>

              <div>
                <label htmlFor="publication_year" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Rok vydání</label>
                <input id="publication_year" name="publication_year" type="text" value={formState.publication_year} onChange={(e) => setFormState((prev) => ({ ...prev, publication_year: e.target.value }))} placeholder="např. 2026" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div>
              <label htmlFor="contributor_summary" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Přispěvatelé / veřejná tiráž</label>
              <textarea id="contributor_summary" name="contributor_summary" rows={3} value={formState.contributor_summary} onChange={(e) => setFormState((prev) => ({ ...prev, contributor_summary: e.target.value }))} placeholder="např. Original author: Gaston Leroux; Editor: Ivana; Technical edition: ARTales" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.75 }}>MVP forma contributor modelu. Později z toho vznikne strukturovaná tabulka osob, rolí a potvrzení práce.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="isbn_status" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Stav ISBN</label>
                <select id="isbn_status" name="isbn_status" value={formState.isbn_status} onChange={(e) => setFormState((prev) => ({ ...prev, isbn_status: e.target.value }))} style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }}>
                  <option value="not_required">Není potřeba</option>
                  <option value="planned">Plánováno</option>
                  <option value="requested">Zažádáno</option>
                  <option value="assigned">Přiděleno</option>
                  <option value="external">Externí ISBN</option>
                  <option value="not_applicable">Nelze použít</option>
                </select>
              </div>

              <div>
                <label htmlFor="isbn" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>ISBN</label>
                <input id="isbn" name="isbn" type="text" value={formState.isbn} onChange={(e) => setFormState((prev) => ({ ...prev, isbn: e.target.value }))} placeholder="978-..." style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div>
              <label htmlFor="isbn_note" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Poznámka k ISBN</label>
              <input id="isbn_note" name="isbn_note" type="text" value={formState.isbn_note} onChange={(e) => setFormState((prev) => ({ ...prev, isbn_note: e.target.value }))} placeholder="např. řešit až při PDF vydání" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.75 }}>ISBN nepoužívej jako interní ID. Veřejně se zobrazí pouze při stavu Přiděleno nebo Externí ISBN.</p>
            </div>

            <div>
              <label htmlFor="edition_note_public" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Veřejná ediční poznámka</label>
              <textarea id="edition_note_public" name="edition_note_public" rows={3} value={formState.edition_note_public} onChange={(e) => setFormState((prev) => ({ ...prev, edition_note_public: e.target.value }))} placeholder="Krátká poznámka, kterou může vidět čtenář v tiráži." style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
            </div>

            <div>
              <label htmlFor="edition_note_internal" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Interní ediční poznámka</label>
              <textarea id="edition_note_internal" name="edition_note_internal" rows={3} value={formState.edition_note_internal} onChange={(e) => setFormState((prev) => ({ ...prev, edition_note_internal: e.target.value }))} placeholder="Interní poznámky k právům, zdroji, kontrole nebo budoucímu vydání." style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e2ded8",
              padding: "18px",
              display: "grid",
              gap: "16px",
              background: "#fbfaf7",
            }}
          >
            <h3 style={{ margin: 0 }}>Obálka / veřejný vizuál</h3>

            <div>
              <label
                htmlFor="cover_image_request"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Název souboru obálky / poznámka
              </label>
              <input
                id="cover_image_request"
                name="cover_image_request"
                type="text"
                value={formState.cover_image_request}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    cover_image_request: e.target.value,
                  }))
                }
                placeholder="např. phantom-cover-final.jpg nebo použít tmavou obálku z disku"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p
                style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}
              >
                Pro běžné editory: nahraj obrázek do sdílené složky a sem napiš
                přesný název souboru nebo poznámku. Technické vložení do systému
                a cesta níže se doplní později správcem.
              </p>
            </div>

            <div>
              <label
                htmlFor="cover_image_path"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Technická cesta obálky (doplňuje správce)
              </label>
              <input
                id="cover_image_path"
                name="cover_image_path"
                type="text"
                value={formState.cover_image_path}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    cover_image_path: e.target.value,
                  }))
                }
                placeholder="works/{work_id}/cover/cover.webp"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p
                style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}
              >
                Běžný editor toto pole nemusí řešit. Sem se vkládá až technická
                cesta po nahrání obrázku do interního úložiště.
              </p>
            </div>

            <div>
              <label
                htmlFor="cover_image_alt"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Alt text obálky
              </label>
              <input
                id="cover_image_alt"
                name="cover_image_alt"
                type="text"
                value={formState.cover_image_alt}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    cover_image_alt: e.target.value,
                  }))
                }
                placeholder="Krátký popis obrázku pro přístupnost a SEO"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="cover_image_caption"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Popisek / kredit obálky
              </label>
              <input
                id="cover_image_caption"
                name="cover_image_caption"
                type="text"
                value={formState.cover_image_caption}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    cover_image_caption: e.target.value,
                  }))
                }
                placeholder="Nepovinný veřejný popisek nebo kredit obrázku"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
            </div>
          </section>
        </section>

        <section
          className="artales-member-panel artales-parser-panel"
          style={{
            border: "1px solid rgba(13, 21, 40, 0.14)",
            background: "#fffdf8",
            borderRadius: "22px",
            padding: "24px",
            display: "grid",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "13px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.68,
              }}
            >
              Produkční nástroj
            </p>
            <h2 style={{ margin: 0 }}>Parser textu do ARTales bloků</h2>
            <p style={{ margin: "8px 0 0 0", opacity: 0.78 }}>
              Vlož připravený text a nech ho převést do ARTales bloků. Nejlepší
              výsledek dá text předzpracovaný pomocí ARTales značek, například
              <code> ::chapter</code>, <code> ::paragraph</code> nebo
              <code> ::poem</code>. Parser značky odstraní, bloky pouze připraví
              a nic automaticky neukládá do databáze.
            </p>
            <p style={{ margin: "8px 0 0 0", opacity: 0.78 }}>
              Doporučený model: jeden skutečný odstavec = jeden blok Odstavec.
              Výsledek vždy zkontroluj v editoru před uložením díla.
            </p>
          </div>

          <label htmlFor="raw_text_parser" style={{ fontWeight: 700 }}>
            Surový text
          </label>
          <textarea
            id="raw_text_parser"
            rows={12}
            value={parserInput}
            onChange={(event) => setParserInput(event.target.value)}
            placeholder={"Kapitola I\n\nPrvní odstavec textu...\n\n* * *\n\nDalší scéna..."}
            style={{
              width: "100%",
              padding: "14px 16px",
              border: "1px solid rgba(13, 21, 40, 0.22)",
              background: "#fffefb",
              borderRadius: "14px",
              fontSize: "15px",
              lineHeight: 1.55,
              resize: "vertical",
              fontFamily: "Georgia, serif",
            }}
          />

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={runParser}
              style={{
                padding: "10px 14px",
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                borderRadius: "999px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Rozparsovat text
            </button>
            <button
              type="button"
              onClick={replaceBlocksWithParserResult}
              disabled={!parserResult || parserResult.blocks.length === 0}
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(13, 21, 40, 0.24)",
                background: parserResult && parserResult.blocks.length > 0 ? "#fff" : "#f2efe8",
                color: parserResult && parserResult.blocks.length > 0 ? "#111" : "#888",
                borderRadius: "999px",
                cursor: parserResult && parserResult.blocks.length > 0 ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Nahradit současné bloky
            </button>
            <button
              type="button"
              onClick={appendParserResult}
              disabled={!parserResult || parserResult.blocks.length === 0}
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(13, 21, 40, 0.24)",
                background: parserResult && parserResult.blocks.length > 0 ? "#fff" : "#f2efe8",
                color: parserResult && parserResult.blocks.length > 0 ? "#111" : "#888",
                borderRadius: "999px",
                cursor: parserResult && parserResult.blocks.length > 0 ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Přidat na konec
            </button>
            <button
              type="button"
              onClick={copyParserAiPrompt}
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(13, 21, 40, 0.18)",
                background: "transparent",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Zkopírovat AI prompt
            </button>
            <button
              type="button"
              onClick={clearParser}
              style={{
                padding: "10px 14px",
                border: "1px solid rgba(13, 21, 40, 0.18)",
                background: "transparent",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Vyčistit parser
            </button>
          </div>

          {parserMessage ? (
            <p
              style={{
                margin: 0,
                padding: "10px 12px",
                border: "1px solid rgba(13, 21, 40, 0.12)",
                background: "rgba(246, 238, 219, 0.8)",
                borderRadius: "12px",
              }}
            >
              {parserMessage}
            </p>
          ) : null}

          {parserResult && parserResult.blocks.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                }}
              >
                <span className="artales-parser-stat">Bloky: {parserResult.stats.totalBlocks}</span>
                <span className="artales-parser-stat">Kapitoly: {parserResult.stats.chapters}</span>
                <span className="artales-parser-stat">Odstavce: {parserResult.stats.paragraphs}</span>
                <span className="artales-parser-stat">Básně: {parserResult.stats.poems}</span>
                <span className="artales-parser-stat">Předěly: {parserResult.stats.separators}</span>
                <span className="artales-parser-stat">Citace: {parserResult.stats.quotes}</span>
                <span className="artales-parser-stat">Datace: {parserResult.stats.placeLines}</span>
                {parserResult.usedMarkup ? (
                  <span className="artales-parser-stat">ARTales značky: použity</span>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <h3 style={{ margin: 0 }}>Náhled prvních bloků</h3>
                {parserResult.blocks.slice(0, 12).map((block, index) => (
                  <div
                    key={block.id}
                    style={{
                      border: "1px solid rgba(13, 21, 40, 0.12)",
                      background: "#fffefb",
                      borderRadius: "14px",
                      padding: "12px",
                    }}
                  >
                    <p style={{ margin: "0 0 6px 0", fontSize: "13px", opacity: 0.72 }}>
                      {index + 1}. {WORK_BLOCK_TYPE_META[block.type].internalLabel}
                      {block.editor_note ? ` · ${block.editor_note}` : ""}
                    </p>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {block.content.length > 260 ? `${block.content.slice(0, 260)}…` : block.content}
                    </p>
                  </div>
                ))}
                {parserResult.blocks.length > 12 ? (
                  <p style={{ margin: 0, opacity: 0.72 }}>
                    Dalších {parserResult.blocks.length - 12} bloků se zobrazí až po vložení do editoru.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
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
  );
}
