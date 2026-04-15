import Link from "next/link"
import { notFound } from "next/navigation"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getCollectionForEditBySlug } from "@/lib/dbCollections"
import { mapCollectionToFormValues } from "@/lib/forms/collectionForm"
import { updateCollection } from "@/lib/actions/collections"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "title_missing":
      return "Název kolekce je povinný."
    case "slug_missing":
      return "Slug je povinný."
    case "slug_invalid":
      return "Slug může obsahovat jen malá písmena, čísla a pomlčky."
    case "slug_taken":
      return "Tento slug už existuje. Zvol jiný."
    case "save_failed":
      return "Kolekci se nepodařilo uložit. Zkus to znovu."
    default:
      return null
  }
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "collection_created":
      return "Kolekce byla vytvořena."
    case "collection_updated":
      return "Kolekce byla uložena."
    default:
      return null
  }
}

export default async function EditCollectionPage({
  params,
  searchParams,
}: PageProps) {
  await requireEditorOrAdmin()

  const { slug } = await params
  const { error, success } = await searchParams

  const collection = await getCollectionForEditBySlug(slug)

  if (!collection) {
    notFound()
  }

  const values = mapCollectionToFormValues(collection)
  const errorMessage = getErrorMessage(error)
  const successMessage = getSuccessMessage(success)

  const updateCollectionWithSlug = updateCollection.bind(null, slug)

  return (
    <main
      style={{
        padding: "48px 32px",
        fontFamily: "serif",
        lineHeight: 1.6,
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: "20px" }}>
        <Link href="/member/collections">{"<- Zpět na kolekce"}</Link>
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
          Editace kolekce
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Uprav metadata kolekce a její veřejnou viditelnost.
        </p>
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

      <form
        action={updateCollectionWithSlug}
        style={{ display: "grid", gap: "22px" }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            padding: "24px",
            display: "grid",
            gap: "18px",
          }}
        >
          <div>
            <label
              htmlFor="title"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Název kolekce
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={values.title}
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
              htmlFor="slug"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              defaultValue={values.slug}
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
              htmlFor="description"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Popis kolekce
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={values.description}
              rows={6}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              name="is_public_visible"
              defaultChecked={values.is_public_visible}
            />
            Kolekce je veřejně viditelná
          </label>
        </section>

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
            href={`/kolekce/${values.slug}`}
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