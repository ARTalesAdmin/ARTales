import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { updateWork } from "@/lib/actions/works"
import { createClient } from "@/lib/supabase/server"
import { getCollectionsForMember } from "@/lib/dbCollections"
import { getWorkForEditBySlug } from "@/lib/dbWorks"
import { getLanguageOptions } from "@/lib/dictionaries/language"
import { getStatusOptions } from "@/lib/dictionaries/status"
import WorkEditorForm from "@/components/editor/WorkEditorForm"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string; db_error?: string }>
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
  const { error, success, db_error } = await searchParams

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
  const collections = await getCollectionsForMember()
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
          slug: work.slug,
          subtitle: work.subtitle ?? "",
          summary: work.summary,
          primary_author_id: work.primary_author_id ?? "",
          collection_id: work.collection_id ?? "",
          canonical_language: work.canonical_language,
          status: work.status,
          origin_type: work.origin_type,
          source_label: work.source_label,
          source_reference: work.source_reference ?? "",
          blocks: work.content_blocks,
        }}
        authors={authors}
        collections={collections.map((collection) => ({
          id: collection.id,
          title: collection.title,
        }))}
        languageOptions={languageOptions}
        statusOptions={statusOptions}
        action={updateWorkWithSlug}
        clearDraftKeys={clearDraftKeys}
      />
    </main>
  )
}