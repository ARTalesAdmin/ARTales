"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  WORK_BLOCK_TYPE_META,
  createEmptyBlock,
  getUnresolvedImageBlocks,
  type WorkBlock,
} from "@/lib/blocks";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import {
  ARTALES_IMAGES_BUCKET,
  WORK_COVER_MAX_UPLOAD_BYTES,
  buildWorkCoverStoragePath,
  isAllowedArtalesImageMimeType,
} from "@/lib/storageImages";
import WorkCoverImage from "@/components/work/WorkCoverImage";
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
    title_cs: string;
    title_en: string;
    slug: string;
    subtitle: string;
    subtitle_cs: string;
    subtitle_en: string;
    summary: string;
    summary_cs: string;
    summary_en: string;
    primary_author_id: string;
    collection_id: string;
    tag_ids: string[];
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

  authors: { id: string; name: string; name_cs?: string | null; name_en?: string | null }[];
  collections: { id: string; title: string }[];
  tags: { id: string; slug: string; label_cs: string; label_en: string | null; type: string }[];
  languageOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];

  action: (formData: FormData) => Promise<void>;
  clearDraftKeys?: string[];
  forcedAuthorId?: string;
};

const MAX_LOCAL_DRAFT_CHARS = 900_000;
const LARGE_WORK_BLOCK_COUNT = 80;
const LARGE_WORK_SAVE_WARNING_CHARS = 2_500_000;
const LARGE_WORK_SAVE_DANGER_CHARS = 4_000_000;
const APPEND_BLOCK_BATCH_SIZE = 200;
const SMART_APPEND_MIN_NEW_BLOCKS = 250;

function getStorageKey(mode: "new" | "edit", slug?: string) {
  return mode === "new"
    ? "artales-work-draft-new"
    : `artales-work-draft-edit:${slug}`;
}

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

function estimateBlocksStorageChars(blocks: WorkBlock[]) {
  return blocks.reduce((total, block) => {
    const fieldsSize = block.fields
      ? Object.values(block.fields).reduce(
          (sum, value) => sum + String(value ?? "").length,
          0,
        )
      : 0;

    return (
      total +
      block.id.length +
      block.type.length +
      block.content.length +
      String(block.editor_note ?? "").length +
      fieldsSize +
      160
    );
  }, 0);
}

function shouldDisableLocalAutosave(blocks: WorkBlock[]) {
  return (
    blocks.length > LARGE_WORK_BLOCK_COUNT ||
    estimateBlocksStorageChars(blocks) > MAX_LOCAL_DRAFT_CHARS
  );
}

function formatApproxMegabytes(chars: number) {
  return `${(chars / 1_000_000).toFixed(1)} MB`;
}

function getLargeWorkSaveRiskMessage(chars: number) {
  if (chars >= LARGE_WORK_SAVE_DANGER_CHARS) {
    return `Toto je velmi velké dílo (${formatApproxMegabytes(chars)}). Editor použije chytré ukládání: nové bloky se odešlou po menších částech a po dokončení se stránka obnoví.`;
  }

  if (chars >= LARGE_WORK_SAVE_WARNING_CHARS) {
    return `Velké dílo: obsah má přibližně ${formatApproxMegabytes(chars)}. Pokud doplňuješ další části, editor je uloží bezpečně po dávkách.`;
  }

  return null;
}

function getLocalAutosaveDisabledMessage() {
  return "Lokální autosave je pro toto velké dílo preventivně vypnutý. Prohlížečové úložiště u románů často nestačí a může shodit editor, proto ukládej změny hlavním tlačítkem Uložit.";
}

function isStorageQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}

function readLocalDraft(storageKey: string) {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function removeLocalDraft(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Storage access can fail in strict/private browser modes.
  }
}

function writeLocalDraft(storageKey: string, payload: unknown) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      reason: isStorageQuotaError(error) ? "quota" : "unavailable",
    };
  }
}

export default function WorkEditorForm(props: Props) {
  const {
    mode,
    slug,
    initialData,
    authors,
    collections,
    tags,
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
      removeLocalDraft(key);
    });
  }, [clearDraftKeys]);

  const [formState, setFormState] = useState({
    title: initialData.title,
    title_cs: initialData.title_cs,
    title_en: initialData.title_en,
    slug: initialData.slug,
    subtitle: initialData.subtitle,
    subtitle_cs: initialData.subtitle_cs,
    subtitle_en: initialData.subtitle_en,
    summary: initialData.summary,
    summary_cs: initialData.summary_cs,
    summary_en: initialData.summary_en,
    primary_author_id: initialData.primary_author_id,
    collection_id: initialData.collection_id,
    tag_ids: initialData.tag_ids,
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

  const initialAutosaveDisabled = useMemo(
    () =>
      shouldDisableLocalAutosave(
        initialData.blocks.length > 0
          ? initialData.blocks
          : [createEmptyBlock("chapter")],
      ),
    [initialData.blocks],
  );
  const currentAutosaveDisabled = useMemo(
    () => shouldDisableLocalAutosave(blocks),
    [blocks],
  );

  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [autosaveWarning, setAutosaveWarning] = useState<string | null>(null);
  const [parserInput, setParserInput] = useState("");
  const [parserResult, setParserResult] = useState<ParsedWorkBlocksResult | null>(null);
  const [parserMessage, setParserMessage] = useState<string | null>(null);
  const [saveSubmitMessage, setSaveSubmitMessage] = useState<string | null>(null);
  const [isSmartSaving, setIsSmartSaving] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState<string | null>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const contentBlocksInputRef = useRef<HTMLInputElement | null>(null);
  const contentUpdateModeInputRef = useRef<HTMLInputElement | null>(null);
  const suppressBeforeUnloadRef = useRef(false);
  const uploadedCoverPathsRef = useRef<Set<string>>(new Set());

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

  const unresolvedImageBlocks = getUnresolvedImageBlocks(blocks);
  const estimatedBlocksStorageChars = useMemo(
    () => estimateBlocksStorageChars(blocks),
    [blocks],
  );
  const largeWorkSaveRiskMessage = getLargeWorkSaveRiskMessage(estimatedBlocksStorageChars);
  const initialBlockIds = useMemo(
    () => new Set(initialData.blocks.map((block) => block.id)),
    [initialData.blocks],
  );
  const newBlocksForAppend = useMemo(
    () => blocks.filter((block) => !initialBlockIds.has(block.id)),
    [blocks, initialBlockIds],
  );
  const canAppendNewBlocksOnly = mode === "edit" && Boolean(slug) && newBlocksForAppend.length > 0;
  const shouldUseBatchAppendSave =
    canAppendNewBlocksOnly &&
    (currentAutosaveDisabled ||
      estimatedBlocksStorageChars >= LARGE_WORK_SAVE_WARNING_CHARS ||
      newBlocksForAppend.length >= SMART_APPEND_MIN_NEW_BLOCKS);

  useEffect(() => {
    if (!isSmartSaving) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (suppressBeforeUnloadRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isSmartSaving]);

  const tagGroups = useMemo(() => {
    const groups = new Map<string, { id: string; slug: string; label_cs: string; label_en: string | null; type: string }[]>();

    tags.forEach((tag) => {
      const current = groups.get(tag.type) ?? [];
      current.push(tag);
      groups.set(tag.type, current);
    });

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      items,
    }));
  }, [tags]);

  function scrollToSaveActions() {
    const element = document.getElementById("work-editor-save-actions");
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
          tag_ids: initialData.tag_ids,
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
    if (initialAutosaveDisabled) {
      removeLocalDraft(storageKey);
      setHasDraft(false);
      setLastSaved(null);
      setAutosaveEnabled(false);
      setAutosaveWarning(getLocalAutosaveDisabledMessage());
      setDraftLoaded(true);
      return;
    }

    const raw = readLocalDraft(storageKey);

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
        removeLocalDraft(storageKey);
        setAutosaveEnabled(true);
        return;
      }

      // Speciální flow: návrat z vytvoření autora
      if (forcedAuthorId) {
        const nextFormState = {
          title: parsedForm.title ?? "",
          title_cs: parsedForm.title_cs ?? "",
          title_en: parsedForm.title_en ?? "",
          slug: parsedForm.slug ?? "",
          subtitle: parsedForm.subtitle ?? "",
          subtitle_cs: parsedForm.subtitle_cs ?? "",
          subtitle_en: parsedForm.subtitle_en ?? "",
          summary: parsedForm.summary ?? "",
          summary_cs: parsedForm.summary_cs ?? "",
          summary_en: parsedForm.summary_en ?? "",
          primary_author_id: forcedAuthorId,
          collection_id: parsedForm.collection_id ?? "",
          tag_ids: Array.isArray(parsedForm.tag_ids) ? parsedForm.tag_ids : [],
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

        const writeResult = writeLocalDraft(storageKey, nextPayload);

        if (writeResult.ok) {
          setLastSaved(nextPayload.updated_at);
          setAutosaveWarning(null);
          setAutosaveEnabled(true);
        } else {
          setLastSaved(null);
          setAutosaveWarning(
            writeResult.reason === "quota"
              ? "Lokální autosave je pro toto velké dílo vypnutý, protože návrh je příliš velký pro úložiště prohlížeče. Ukládej prosím ručně tlačítkem Uložit."
              : "Lokální autosave není v tomto prohlížeči dostupný. Ukládej prosím ručně tlačítkem Uložit.",
          );
          setAutosaveEnabled(false);
        }

        setHasDraft(false);
        return;
      }

      setHasDraft(true);
      setLastSaved(parsed.updated_at ?? null);
    } catch {
      removeLocalDraft(storageKey);
      setAutosaveEnabled(true);
    } finally {
      setDraftLoaded(true);
    }
  }, [storageKey, initialSnapshot, forcedAuthorId, initialAutosaveDisabled]);

  useEffect(() => {
    if (!draftLoaded) return;

    if (currentAutosaveDisabled) {
      removeLocalDraft(storageKey);
      setHasDraft(false);
      setLastSaved(null);
      setAutosaveWarning(getLocalAutosaveDisabledMessage());
      setAutosaveEnabled(false);
      return;
    }

    if (!autosaveEnabled) return;

    const payload = {
      form: formState,
      blocks,
      updated_at: new Date().toISOString(),
    };

    const writeResult = writeLocalDraft(storageKey, payload);

    if (writeResult.ok) {
      setLastSaved(payload.updated_at);
      setAutosaveWarning(null);
      return;
    }

    setAutosaveWarning(
      writeResult.reason === "quota"
        ? "Lokální autosave je pro toto velké dílo vypnutý, protože návrh je příliš velký pro úložiště prohlížeče. Ukládej prosím ručně tlačítkem Uložit."
        : "Lokální autosave není v tomto prohlížeči dostupný. Ukládej prosím ručně tlačítkem Uložit.",
    );
    setAutosaveEnabled(false);
  }, [formState, blocks, storageKey, draftLoaded, autosaveEnabled, currentAutosaveDisabled]);

  useEffect(() => {
    if (!forcedAuthorId || !draftLoaded) return;

    setFormState((prev) => ({
      ...prev,
      primary_author_id: forcedAuthorId,
    }));

    if (currentAutosaveDisabled) {
      removeLocalDraft(storageKey);
      setHasDraft(false);
      setLastSaved(null);
      setAutosaveWarning(getLocalAutosaveDisabledMessage());
      setAutosaveEnabled(false);
      return;
    }

    const raw = readLocalDraft(storageKey);
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

      const writeResult = writeLocalDraft(storageKey, next);

      if (writeResult.ok) {
        setLastSaved(next.updated_at);
        setAutosaveWarning(null);
      } else {
        setAutosaveWarning(
          writeResult.reason === "quota"
            ? "Lokální autosave je pro toto velké dílo vypnutý, protože návrh je příliš velký pro úložiště prohlížeče. Ukládej prosím ručně tlačítkem Uložit."
            : "Lokální autosave není v tomto prohlížeči dostupný. Ukládej prosím ručně tlačítkem Uložit.",
        );
        setAutosaveEnabled(false);
      }
    } catch {
      // ignore broken draft
    }
  }, [forcedAuthorId, storageKey, draftLoaded, currentAutosaveDisabled]);

  function restoreDraft() {
    let restoredBlocks: WorkBlock[] | null = null;
    const raw = readLocalDraft(storageKey);
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
          title_cs: parsed.form.title_cs ?? "",
          title_en: parsed.form.title_en ?? "",
          slug: parsed.form.slug ?? "",
          subtitle: parsed.form.subtitle ?? "",
          subtitle_cs: parsed.form.subtitle_cs ?? "",
          subtitle_en: parsed.form.subtitle_en ?? "",
          summary: parsed.form.summary ?? "",
          summary_cs: parsed.form.summary_cs ?? "",
          summary_en: parsed.form.summary_en ?? "",
          primary_author_id: parsed.form.primary_author_id ?? "",
          collection_id: parsed.form.collection_id ?? "",
          tag_ids: Array.isArray(parsed.form.tag_ids) ? parsed.form.tag_ids : [],
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
        restoredBlocks = parsed.blocks;
        setBlocks(parsed.blocks);
      }

      setLastSaved(parsed.updated_at ?? null);
    } catch {
      // ignore broken draft
    }

    setHasDraft(false);

    if (shouldDisableLocalAutosave(restoredBlocks ?? blocks)) {
      removeLocalDraft(storageKey);
      setLastSaved(null);
      setAutosaveWarning(getLocalAutosaveDisabledMessage());
      setAutosaveEnabled(false);
      return;
    }

    setAutosaveWarning(null);
    setAutosaveEnabled(true);
  }

  function discardDraft() {
    removeLocalDraft(storageKey);
    setHasDraft(false);
    setLastSaved(null);

    if (currentAutosaveDisabled) {
      setAutosaveWarning(getLocalAutosaveDisabledMessage());
      setAutosaveEnabled(false);
      return;
    }

    setAutosaveWarning(null);
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
      currentAutosaveDisabled
        ? "Nahradit současné bloky výsledkem parseru? U tohoto velkého díla je lokální autosave vypnutý, proto před pokračováním zvaž ruční uložení aktuální verze."
        : "Nahradit současné bloky výsledkem parseru? Aktuální bloky zůstanou zachované jen v lokálním autosave, dokud dílo znovu neuložíš.",
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

  function downloadBlocksBackup() {
    try {
      const payload = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          work_slug: formState.slug || slug || "work",
          work_title: formState.title,
          blocks,
        },
        null,
        2,
      );
      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeSlug = slugify(formState.slug || formState.title || slug || "work");
      link.href = url;
      link.download = `artales-${safeSlug || "work"}-blocks-backup.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSaveSubmitMessage("Záloha bloků byla stažena do počítače.");
    } catch {
      setSaveSubmitMessage("Zálohu bloků se nepodařilo vytvořit. Zkus prosím uložit dílo nebo zmenšit vložený úsek.");
    }
  }

  async function prepareWorkSubmit(event: FormEvent<HTMLFormElement>) {
    setSaveSubmitMessage(null);

    if (isSmartSaving) {
      event.preventDefault();
      return;
    }

    if (shouldUseBatchAppendSave) {
      event.preventDefault();
      await saveNewBlocksInBatches();
      return;
    }

    if (!contentBlocksInputRef.current || !contentUpdateModeInputRef.current) {
      event.preventDefault();
      setSaveSubmitMessage("Ukládání se nepodařilo připravit. Obnov stránku a zkus to prosím znovu.");
      scrollToSaveActions();
      return;
    }

    if (estimatedBlocksStorageChars >= LARGE_WORK_SAVE_DANGER_CHARS) {
      if (mode === "edit" && slug && newBlocksForAppend.length === 0) {
        contentUpdateModeInputRef.current.value = "metadata_only";
        contentBlocksInputRef.current.value = "[]";
        setSaveSubmitMessage(
          "Dílo je velmi velké, proto ukládám jen metadata a stav publikace. Obsah bloků zůstane beze změny.",
        );
        return;
      }

      event.preventDefault();
      setSaveSubmitMessage(
        canAppendNewBlocksOnly
          ? "Dílo je příliš velké pro běžné uložení. Klikni znovu na Uložit změny; editor použije dávkové ukládání nových bloků."
          : "Dílo je příliš velké pro běžné uložení celého formuláře. Stáhni si zálohu bloků a rozděl další úpravy na menší části.",
      );
      scrollToSaveActions();
      return;
    }

    try {
      contentUpdateModeInputRef.current.value = "full";
      contentBlocksInputRef.current.value = JSON.stringify(blocks);
    } catch {
      event.preventDefault();
      setSaveSubmitMessage(
        "Prohlížeč nedokázal připravit obsah díla k odeslání. Stáhni si zálohu bloků a zkus pracovat s menším úsekem textu.",
      );
      scrollToSaveActions();
    }
  }


  async function saveNewBlocksInBatches() {
    if (!slug) {
      setSaveSubmitMessage("Nové bloky lze dávkově uložit jen u už existujícího díla.");
      scrollToSaveActions();
      return;
    }

    if (newBlocksForAppend.length === 0) {
      setSaveSubmitMessage("Nejsou připravené žádné nové bloky k uložení.");
      scrollToSaveActions();
      return;
    }

    const batches: WorkBlock[][] = [];

    for (let index = 0; index < newBlocksForAppend.length; index += APPEND_BLOCK_BATCH_SIZE) {
      batches.push(newBlocksForAppend.slice(index, index + APPEND_BLOCK_BATCH_SIZE));
    }

    setIsSmartSaving(true);
    scrollToSaveActions();
    setSaveSubmitMessage(
      `Připravuji chytré uložení. Nové bloky rozdělím na ${batches.length} ${batches.length === 1 ? "část" : batches.length < 5 ? "části" : "částí"}. Prosím neodcházej ze stránky.`,
    );

    let savedCount = 0;

    try {
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        setSaveSubmitMessage(
          `Ukládám část ${index + 1} z ${batches.length}. Hotovo ${savedCount}/${newBlocksForAppend.length} bloků. Prosím neodcházej ze stránky.`,
        );

        const response = await fetch(`/api/member/works/${encodeURIComponent(slug)}/append-blocks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            blocks: batch,
            batchIndex: index,
            batchCount: batches.length,
          }),
        });

        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string; appendedCount?: number }
          | null;

        if (!response.ok || !result?.ok) {
          setSaveSubmitMessage(
            result?.message ??
              `Ukládání se přerušilo u části ${index + 1} z ${batches.length}. Uloženo mohlo být ${savedCount} bloků. Než budeš pokračovat, stáhni si zálohu a obnov stránku.`,
          );
          return;
        }

        savedCount += result.appendedCount ?? batch.length;
      }

      setSaveSubmitMessage(`Uloženo ${savedCount} nových bloků. Obnovuji editor…`);
      suppressBeforeUnloadRef.current = true;
      setIsSmartSaving(false);
      window.setTimeout(() => {
        window.location.href = `/member/works/${encodeURIComponent(slug)}/edit?success=work_updated`;
      }, 50);
    } catch {
      setSaveSubmitMessage(
        `Ukládání se přerušilo. Uloženo mohlo být ${savedCount} bloků. Stáhni si zálohu bloků a obnov stránku; již uložené dávky by se měly načíst zpět.`,
      );
    } finally {
      setIsSmartSaving(false);
    }
  }

  function clearParser() {
    setParserInput("");
    setParserResult(null);
    setParserMessage(null);
  }

  async function removeUnsavedCoverUpload(path: string) {
    if (!uploadedCoverPathsRef.current.has(path)) return;

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .remove([path]);

      if (!error) {
        uploadedCoverPathsRef.current.delete(path);
      }
    } catch {
      // Best-effort cleanup only. A failed cleanup must not block editing.
    }
  }

  async function uploadCoverImage(file: File | null) {
    setCoverUploadMessage(null);
    setCoverUploadError(null);

    if (!file) return;

    if (!isAllowedArtalesImageMimeType(file.type)) {
      setCoverUploadError("Podporované formáty jsou JPG, PNG a WebP.");
      return;
    }

    if (file.size > WORK_COVER_MAX_UPLOAD_BYTES) {
      setCoverUploadError("Soubor je příliš velký. Maximální velikost obálky je 5 MB.");
      return;
    }

    const workSlug = slugify(formState.slug || formState.title);

    if (!workSlug) {
      setCoverUploadError("Nejdřív vyplň název nebo slug díla. Podle něj se vytvoří bezpečná cesta obrázku.");
      return;
    }

    setIsCoverUploading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const previousPath = formState.cover_image_path;
      const storagePath = buildWorkCoverStoragePath({
        workSlug,
        fileName: file.name,
        mimeType: file.type,
      });

      const { error } = await supabase.storage
        .from(ARTALES_IMAGES_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        setCoverUploadError(`Obálku se nepodařilo nahrát: ${error.message}`);
        return;
      }

      uploadedCoverPathsRef.current.add(storagePath);

      if (previousPath && previousPath !== storagePath) {
        await removeUnsavedCoverUpload(previousPath);
      }

      setFormState((prev) => ({
        ...prev,
        cover_image_path: storagePath,
        cover_image_alt:
          prev.cover_image_alt.trim() ||
          (prev.title.trim() ? `Obálka díla ${prev.title.trim()}` : "Obálka díla"),
      }));
      setCoverUploadMessage("Obálka byla nahrána. Ulož dílo, aby se změna propsala do databáze.");

      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    } finally {
      setIsCoverUploading(false);
    }
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

      {autosaveWarning ? (
        <div
          role="status"
          style={{
            border: "1px solid #e0c39a",
            padding: "14px 16px",
            marginBottom: "20px",
            background: "#fff8ed",
            color: "#4a3218",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>
            {autosaveWarning}
          </p>
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

      <form action={action} onSubmit={prepareWorkSubmit} style={{ display: "grid", gap: "22px" }}>
        <section
          className="artales-member-panel"
          style={{
            border: "1px solid rgba(13, 21, 40, 0.14)",
            background: "#fffdf8",
            borderRadius: "18px",
            padding: "16px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>Rychlé uložení</strong>
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.75 }}>
              U dlouhých děl nemusíš sjíždět až na konec formuláře.
              {unresolvedImageBlocks.length > 0
                ? ` Nevyřešené image bloky: ${unresolvedImageBlocks.length}. Draft uložit lze, publikaci zastaví.`
                : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{
                padding: "10px 15px",
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Uložit dílo
            </button>
            <button
              type="button"
              onClick={scrollToSaveActions}
              style={{
                padding: "10px 15px",
                border: "1px solid rgba(13, 21, 40, 0.22)",
                background: "#fffefb",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Přejít na konec ↓
            </button>
          </div>
        </section>

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

          <section
            style={{
              border: "1px solid rgba(217, 183, 110, 0.28)",
              background: "rgba(255, 248, 232, 0.48)",
              borderRadius: "18px",
              padding: "16px",
              display: "grid",
              gap: "14px",
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Veřejná lokalizace metadat</h3>
              <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.75 }}>
                Vyplň čtenářské názvy a anotace pro veřejnou CZ/EN vrstvu. Pokud
                některé pole chybí, web použije druhý jazyk nebo hlavní legacy pole výše.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="title_cs" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Název (CZ)</label>
                <input id="title_cs" name="title_cs" type="text" value={formState.title_cs} onChange={(e) => setFormState((prev) => ({ ...prev, title_cs: e.target.value }))} placeholder="Český veřejný název" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
              <div>
                <label htmlFor="title_en" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Title (EN)</label>
                <input id="title_en" name="title_en" type="text" value={formState.title_en} onChange={(e) => setFormState((prev) => ({ ...prev, title_en: e.target.value }))} placeholder="English public title" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="subtitle_cs" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Podnázev (CZ)</label>
                <input id="subtitle_cs" name="subtitle_cs" type="text" value={formState.subtitle_cs} onChange={(e) => setFormState((prev) => ({ ...prev, subtitle_cs: e.target.value }))} placeholder="Český podnázev" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
              <div>
                <label htmlFor="subtitle_en" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Subtitle (EN)</label>
                <input id="subtitle_en" name="subtitle_en" type="text" value={formState.subtitle_en} onChange={(e) => setFormState((prev) => ({ ...prev, subtitle_en: e.target.value }))} placeholder="English subtitle" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
              <div>
                <label htmlFor="summary_cs" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Anotace (CZ)</label>
                <textarea id="summary_cs" name="summary_cs" rows={4} value={formState.summary_cs} onChange={(e) => setFormState((prev) => ({ ...prev, summary_cs: e.target.value }))} placeholder="Česká veřejná anotace" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px", resize: "vertical" }} />
              </div>
              <div>
                <label htmlFor="summary_en" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Annotation (EN)</label>
                <textarea id="summary_en" name="summary_en" rows={4} value={formState.summary_en} onChange={(e) => setFormState((prev) => ({ ...prev, summary_en: e.target.value }))} placeholder="English public annotation" style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(13, 21, 40, 0.22)", background: "#fffefb", borderRadius: "12px", fontSize: "16px", resize: "vertical" }} />
              </div>
            </div>
          </section>

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
                  {author.name_cs || author.name}
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

          <div
            style={{
              border: "1px solid rgba(13, 21, 40, 0.14)",
              borderRadius: "16px",
              padding: "16px",
              background: "rgba(255, 255, 255, 0.55)",
            }}
          >
            <p style={{ display: "block", marginBottom: "10px", fontWeight: 600 }}>
              Tagy díla
            </p>

            {tagGroups.length === 0 ? (
              <p style={{ margin: 0, fontSize: "14px", opacity: 0.75 }}>
                Zatím nejsou založené žádné tagy. Nejprve je vytvoř v editoru tagů.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {tagGroups.map((group) => (
                  <section key={group.type}>
                    <p
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "12px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        opacity: 0.7,
                        fontWeight: 700,
                      }}
                    >
                      {group.type}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {group.items.map((tag) => {
                        const checked = formState.tag_ids.includes(tag.id);
                        const label = tag.label_cs || tag.label_en || tag.slug;

                        return (
                          <label
                            key={tag.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              borderRadius: "999px",
                              border: checked
                                ? "1px solid rgba(13, 21, 40, 0.75)"
                                : "1px solid rgba(13, 21, 40, 0.18)",
                              background: checked ? "rgba(13, 21, 40, 0.08)" : "#fffefb",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            <input
                              type="checkbox"
                              name="tag_ids"
                              value={tag.id}
                              checked={checked}
                              onChange={() =>
                                setFormState((prev) => ({
                                  ...prev,
                                  tag_ids: checked
                                    ? prev.tag_ids.filter((id) => id !== tag.id)
                                    : [...prev.tag_ids, tag.id],
                                }))
                              }
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <p style={{ margin: "10px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Technická vrstva pro filtrování a budoucí vyhledávání. Tagy jsou vícenásobné.
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
            <div>
              <h3 style={{ margin: 0 }}>Obálka / veřejný vizuál</h3>
              <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.75 }}>
                Nahraj veřejnou obálku přímo do ARTales Storage. Podporované
                formáty: JPG, PNG, WebP. Maximální velikost pro obálku je 5 MB.
              </p>
              <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
                <Link className="artales-editor-help-link" href="/member/resources#work-cover">
                  Otevřít cover standard a prompt
                </Link>
              </p>
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                void uploadCoverImage(event.target.files?.[0] ?? null);
              }}
              style={{ display: "none" }}
            />

            <input
              type="hidden"
              name="cover_image_path"
              value={formState.cover_image_path}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 240px) 1fr",
                gap: "18px",
                alignItems: "start",
              }}
            >
              <div>
                <WorkCoverImage
                  title={formState.title || "ARTales"}
                  imagePath={formState.cover_image_path}
                  alt={formState.cover_image_alt}
                  caption={formState.cover_image_caption}
                  variant="card"
                />
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={isCoverUploading}
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      border: "1px solid #111827",
                      background: isCoverUploading ? "#6b7280" : "#111827",
                      color: "#fff",
                      borderRadius: "999px",
                      padding: "10px 15px",
                      cursor: isCoverUploading ? "wait" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {isCoverUploading ? "Nahrávám obálku…" : "Nahrát obálku"}
                  </button>

                  {formState.cover_image_path ? (
                    <button
                      type="button"
                      onClick={() => {
                        const removedPath = formState.cover_image_path;

                        setFormState((prev) => ({
                          ...prev,
                          cover_image_path: "",
                        }));
                        setCoverUploadMessage("Obálka byla odebrána z formuláře. Ulož dílo, aby se změna propsala do databáze.");
                        setCoverUploadError(null);

                        if (removedPath) {
                          void removeUnsavedCoverUpload(removedPath);
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
                      Odebrat obálku
                    </button>
                  ) : null}
                </div>

                {coverUploadError ? (
                  <p style={{ margin: 0, color: "#9f1239", fontSize: "14px" }}>
                    {coverUploadError}
                  </p>
                ) : null}

                {coverUploadMessage ? (
                  <p style={{ margin: 0, color: "#166534", fontSize: "14px" }}>
                    {coverUploadMessage}
                  </p>
                ) : null}

                {formState.cover_image_path ? (
                  <p style={{ margin: 0, fontSize: "13px", opacity: 0.72 }}>
                    Obálka je připravená v ARTales Storage. Technickou cestu není
                    potřeba ručně upravovat. Další nahrání stejného formátu nahradí
                    aktuální soubor místo vytváření další kopie. Po nahrání nezapomeň
                    dílo uložit.
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", opacity: 0.72 }}>
                    Pokud obálka zatím není hotová, můžeš níže nechat interní
                    poznámku pro tým. Veřejně se použije až nahraný obrázek.
                  </p>
                )}

                <div>
                  <label
                    htmlFor="cover_image_request"
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: 600,
                    }}
                  >
                    Interní poznámka k obálce
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
                    placeholder="např. tmavá obálka, gotická atmosféra, připravuje Ivana"
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
              </div>
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
            <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
              <Link className="artales-editor-help-link" href="/member/resources#parser">
                Otevřít pravidla parseru a aktuální AI prompt
              </Link>
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
                <span className="artales-parser-stat">Obrázky: {parserResult.stats.images}</span>
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
                      {block.type === "image"
                        ? String(block.fields?.source_note ?? block.fields?.image_request ?? block.fields?.caption ?? "Image placeholder")
                        : block.content.length > 260
                          ? `${block.content.slice(0, 260)}…`
                          : block.content}
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

        <WorkBlocksEditor
          blocks={blocks}
          setBlocks={setBlocks}
          workSlug={formState.slug || slug || ""}
          workTitle={formState.title}
        />

        <input
          ref={contentBlocksInputRef}
          type="hidden"
          name="content_blocks_json"
          defaultValue="[]"
        />
        <input
          ref={contentUpdateModeInputRef}
          type="hidden"
          name="content_update_mode"
          defaultValue="full"
        />

        {largeWorkSaveRiskMessage || saveSubmitMessage ? (
          <div
            style={{
              border: "1px solid rgba(178, 118, 40, 0.36)",
              background: "#fff8ec",
              borderRadius: "16px",
              padding: "14px 16px",
              color: "#6f4215",
            }}
          >
            <strong>Ukládání velkého díla</strong>
            {largeWorkSaveRiskMessage ? (
              <p style={{ margin: "6px 0 0" }}>{largeWorkSaveRiskMessage}</p>
            ) : null}
            {saveSubmitMessage ? (
              <p style={{ margin: "6px 0 0", fontWeight: 600 }}>{saveSubmitMessage}</p>
            ) : null}
            {canAppendNewBlocksOnly ? (
              <p style={{ margin: "6px 0 0" }}>
                Nově přidané bloky: <strong>{newBlocksForAppend.length}</strong>. Hlavní tlačítko Uložit změny samo zvolí bezpečný režim; u dlouhých děl odešle nové bloky po částech.
              </p>
            ) : null}
            {!canAppendNewBlocksOnly && mode === "edit" && estimatedBlocksStorageChars >= LARGE_WORK_SAVE_DANGER_CHARS ? (
              <p style={{ margin: "6px 0 0" }}>
                Pokud měníš jen metadata nebo status publikace, editor uloží pouze tato pole. Obsah díla se znovu neodesílá.
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          id="work-editor-save-actions"
          style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
        >
          <button
            type="submit"
            disabled={isSmartSaving}
            style={{
              padding: "12px 18px",
              border: "1px solid #111",
              background: isSmartSaving ? "rgba(17, 17, 17, 0.56)" : "#111",
              color: "#fff",
              cursor: isSmartSaving ? "wait" : "pointer",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            {isSmartSaving ? "Ukládám změny…" : "Uložit změny"}
          </button>
          {shouldUseBatchAppendSave ? (
            <span style={{ alignSelf: "center", fontSize: "13px", color: "rgba(17, 17, 17, 0.62)" }}>
              Editor uloží {newBlocksForAppend.length} nových bloků po částech.
            </span>
          ) : null}
          <button
            type="button"
            onClick={downloadBlocksBackup}
            style={{
              padding: "12px 18px",
              border: "1px solid rgba(17, 17, 17, 0.24)",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Stáhnout zálohu bloků
          </button>
        </div>
      </form>
    </>
  );
}
