import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { updateWork } from "@/lib/actions/works"
import { createClient } from "@/lib/supabase/server"
import { getCollectionsForMember } from "@/lib/dbCollections"
import { getWorkForEditBySlug } from "@/lib/dbWorks"
import { getLanguageOptions } from "@/lib/dictionaries/language"
import { getStatusOptions } from "@/lib/dictionaries/status"
import WorkBlocksEditor from "@/components/editor/WorkBlocksEditor"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
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
  const { error, success } = await searchParams

  const work = await getWorkForEditBySlug(slug)

  if (!work) {
    notFound()
  }

  const { data: authorsData, error: authorsError } = await supabase
    .from("authors")
    .select("id, name, slug")
    .order("name", { ascending: true })

  if (authorsError) {
    throw new Error(`Failed to load authors: ${authorsError.message}`)
  }

  const authors = (authorsData ?? []) as { id: string; name: string; slug: string }[]
  const collections = await getCollectionsForMember()
  const languageOptions = getLanguageOptions("internal")
  const statusOptions = getStatusOptions("internal")

  const errorMessage = getErrorMessage(error)
  const successMessage = getSuccessMessage(success)

  const updateWorkWithSlug = updateWork.bind(null, slug)

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

      <form action={updateWorkWithSlug} style={{ display: "grid", gap: "22px" }}>
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
            <label htmlFor="title" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Název díla
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={work.title}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label htmlFor="slug" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={work.slug}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label htmlFor="subtitle" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Podnázev
            </label>
            <input
              id="subtitle"
              name="subtitle"
              type="text"
              defaultValue={work.subtitle ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label htmlFor="summary" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Shrnutí
            </label>
            <textarea
              id="summary"
              name="summary"
              required
              rows={4}
              defaultValue={work.summary}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label htmlFor="primary_author_id" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Primární autor
            </label>
            <select
              id="primary_author_id"
              name="primary_author_id"
              required
              defaultValue={work.primary_author_id ?? ""}
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
          </div>

          <div>
            <label htmlFor="collection_id" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Kolekce
            </label>
            <select
              id="collection_id"
              name="collection_id"
              defaultValue={work.collection_id ?? ""}
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
          </div>

          <div>
            <label htmlFor="canonical_language" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Jazyk
            </label>
            <select
              id="canonical_language"
              name="canonical_language"
              required
              defaultValue={work.canonical_language}
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
          </div>

          <div>
            <label htmlFor="status" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Status
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue={work.status}
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
          </div>

          <div>
            <label htmlFor="origin_type" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Typ původu
            </label>
            <select
              id="origin_type"
              name="origin_type"
              required
              defaultValue={work.origin_type}
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
          </div>

          <div>
            <label htmlFor="source_label" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Zdroj
            </label>
            <select
              id="source_label"
              name="source_label"
              required
              defaultValue={work.source_label}
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
          </div>

          <div>
            <label htmlFor="source_reference" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Reference zdroje
            </label>
            <input
              id="source_reference"
              name="source_reference"
              type="text"
              defaultValue={work.source_reference ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
          </div>
        </section>

        <WorkBlocksEditor initialBlocks={work.content_blocks} />

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
            Uložit změny
          </button>

          <Link
            href={`/dilo/${work.slug}`}
            style={{
              padding: "12px 18px",
              border: "1px solid #ccc",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Veřejný detail
          </Link>
        </div>
      </form>
    </main>
  )
}