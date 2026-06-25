import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { updateWork } from "@/lib/actions/works"
import { createClient } from "@/lib/supabase/server"
import { getCollectionsForMember } from "@/lib/dbCollections"
import { getWorkForEditBySlug } from "@/lib/dbWorks"
import { getLanguageOptions } from "@/lib/dictionaries/language"
import { getTagsForMember } from "@/lib/dbTags"
import { getStatusOptions } from "@/lib/dictionaries/status"
import WorkEditorForm from "@/components/editor/WorkEditorForm"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    error?: string
    success?: string
    db_error?: string
    createdAuthorId?: string
  }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "title_missing":
      return "Název díla je povinný."
    case "slug_missing":
      return "Slug je povinný."
    case "slug_invalid":
      return "Slug může obsahovat jen malá písmena, čísla a pomlčky."
    case "summary_missing":
      return "Shrnutí díla je povinné."
    case "summary_too_short":
      return "Shrnutí je příliš krátké. Musí mít alespoň 200 znaků."
    case "summary_too_long":
      return "Shrnutí je příliš dlouhé. Maximum je 800 znaků."
    case "primary_author_missing":
      return "Primární autor je povinný."
    case "canonical_language_invalid":
      return "Jazyk musí být vybrán z nabídky."
    case "status_invalid":
      return "Status musí být vybrán z nabídky."
    case "origin_type_invalid":
      return "Typ původu není platný."
    case "source_label_invalid":
      return "Zdroj není platný."
    case "edition_language_invalid":
      return "Jazyk edice musí být vybrán z nabídky."
    case "original_language_invalid":
      return "Původní jazyk musí být vybrán z nabídky."
    case "isbn_missing":
      return "Při stavu ISBN Přiděleno musí být ISBN vyplněné."
    case "blocks_missing":
      return "Dílo musí obsahovat alespoň jeden blok."
    case "blocks_empty":
      return "Obsah bloků je prázdný."
    case "block_content_missing":
      return "Každý blok kromě předělu musí mít obsah."
    case "slug_taken":
      return "Tento slug už existuje. Zvol jiný."
    case "save_failed":
      return "Dílo se nepodařilo uložit. Zkus to znovu."
    default:
      return null
  }
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "work_created":
      return "Dílo bylo vytvořeno."
    case "work_updated":
      return "Dílo bylo uloženo."
    default:
      return null
  }
}

export default async function EditWorkPage({
  params,
  searchParams,
}: PageProps) {
  await requireEditorOrAdmin()

  const supabase = await createClient()
  const { slug } = await params
  const { error, success, db_error, createdAuthorId } = await searchParams

  const work = await getWorkForEditBySlug(slug)

  if (!work) {
    notFound()
  }

  const { data: authorsData, error: authorsError } = await supabase
    .from("authors")
    .select("id, name")
    .order("name", { ascending: true })

  if (authorsError) {
    throw new Error(`Failed to load authors: ${authorsError.message}`)
  }

  const authors = (authorsData ?? []) as { id: string; name: string }[]
  const [collections, tags] = await Promise.all([
    getCollectionsForMember(),
    getTagsForMember(),
  ])
  const languageOptions = getLanguageOptions("internal")
  const statusOptions = getStatusOptions("internal")

  const errorMessage = getErrorMessage(error)
  const successMessage = getSuccessMessage(success)

  const updateWorkWithSlug = updateWork.bind(null, slug)

  const clearDraftKeys =
    success === "work_created"
      ? ["artales-work-draft-new", `artales-work-draft-edit:${slug}`]
      : success === "work_updated"
      ? [`artales-work-draft-edit:${slug}`]
      : []

  return (
    <main
      style={{
        padding: "48px 32px",
        fontFamily: "serif",
        lineHeight: 1.6,
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: "20px" }}>
        <Link href="/member/works">{"<- Zpět na díla"}</Link>
      </p>

      <section style={{ marginBottom: "28px" }}>
        <p
          style={{
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            opacity: 0.7,
            marginBottom: "10px",
          }}
        >
          ARTales · Editor
        </p>

        <h1
          style={{
            fontSize: "40px",
            lineHeight: 1.1,
            marginTop: 0,
            marginBottom: "14px",
          }}
        >
          Editace díla
        </h1>
      </section>

      {errorMessage ? (
        <p
          style={{
            marginTop: 0,
            marginBottom: "18px",
            padding: "12px 14px",
            border: "1px solid #d99",
            background: "#fff7f7",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          style={{
            marginTop: 0,
            marginBottom: "18px",
            padding: "12px 14px",
            border: "1px solid #9c9",
            background: "#f6fff6",
          }}
        >
          {successMessage}
        </p>
      ) : null}

      {db_error ? (
        <pre
          style={{
            marginTop: 0,
            marginBottom: "18px",
            padding: "12px 14px",
            border: "1px solid #ccc",
            background: "#f8f8f8",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
            fontSize: "13px",
          }}
        >
          DB error: {decodeURIComponent(db_error)}
        </pre>
      ) : null}

      <WorkEditorForm
        mode="edit"
        slug={slug}
        initialData={{
          title: work.title,
          title_cs: work.title_cs ?? "",
          title_en: work.title_en ?? work.title,
          slug: work.slug,
          subtitle: work.subtitle ?? "",
          subtitle_cs: work.subtitle_cs ?? "",
          subtitle_en: work.subtitle_en ?? work.subtitle ?? "",
          summary: work.summary,
          summary_cs: work.summary_cs ?? "",
          summary_en: work.summary_en ?? work.summary,
          primary_author_id: work.primary_author_id ?? "",
          collection_id: work.collection_id ?? "",
          tag_ids: work.tag_ids,
          canonical_language: work.canonical_language,
          status: work.status,
          origin_type: work.origin_type,
          source_label: work.source_label,
          source_reference: work.source_reference ?? "",
          edition_title: work.edition_title ?? "",
          edition_version: work.edition_version ?? "",
          edition_language: work.edition_language ?? work.canonical_language,
          original_language: work.original_language ?? "",
          edition_source_url: work.edition_source_url ?? "",
          edition_license: work.edition_license ?? "",
          edition_publisher: work.edition_publisher ?? "ARTales",
          publication_year: work.publication_year ?? "",
          isbn: work.isbn ?? "",
          isbn_status: work.isbn_status ?? "not_required",
          isbn_note: work.isbn_note ?? "",
          edition_note_public: work.edition_note_public ?? "",
          edition_note_internal: work.edition_note_internal ?? "",
          contributor_summary: work.contributor_summary ?? "",
          cover_image_request: work.cover_image_request ?? "",
          cover_image_path: work.cover_image_path ?? "",
          cover_image_alt: work.cover_image_alt ?? "",
          cover_image_caption: work.cover_image_caption ?? "",
          blocks: work.content_blocks,
        }}
        authors={authors}
        collections={collections.map((collection) => ({
          id: collection.id,
          title: collection.title_cs ?? collection.title_en ?? collection.title,
        }))}
        tags={tags}
        languageOptions={languageOptions}
        statusOptions={statusOptions}
        action={updateWorkWithSlug}
        clearDraftKeys={clearDraftKeys}
        forcedAuthorId={createdAuthorId ?? ""}
      />
    </main>
  )
}