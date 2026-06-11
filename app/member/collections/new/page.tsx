import Link from "next/link"
import EditorialImageUploadField from "@/components/media/EditorialImageUploadField"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createCollection } from "@/lib/actions/collections"
import { getDefaultCollectionFormValues } from "@/lib/forms/collectionForm"

type PageProps = {
  searchParams: Promise<{ error?: string }>
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

export default async function NewCollectionPage({ searchParams }: PageProps) {
  await requireEditorOrAdmin()

  const defaults = getDefaultCollectionFormValues()
  const { error } = await searchParams
  const errorMessage = getErrorMessage(error)

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
          Nová kolekce
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Založ novou kolekci do databáze ARTales. Kolekce může později sdružovat
          díla tematicky, edičně nebo kurátorsky.
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

      <form action={createCollection} style={{ display: "grid", gap: "22px" }}>
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
              defaultValue={defaults.title}
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
              defaultValue={defaults.slug}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              URL identifikátor kolekce. Když ho nevyplníš, vytvoří se automaticky
              z názvu.
            </p>
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
              defaultValue={defaults.description}
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
              defaultChecked={defaults.is_public_visible}
            />
            Kolekce je veřejně viditelná
          </label>
        </section>

        <EditorialImageUploadField
          kind="collection-cover"
          title={(defaults.title || "ARTales kolekce")}
          slugInputId="slug"
          titleInputId="title"
          pathName="cover_image_path"
          altName="cover_image_alt"
          captionName="cover_image_caption"
          initialPath={defaults.cover_image_path}
          initialAlt={defaults.cover_image_alt}
          initialCaption={defaults.cover_image_caption}
          heading="Cover kolekce"
          description="Nahraj veřejný vizuál kolekce přímo do ARTales Storage. Podporované formáty: JPG, PNG, WebP. Maximální velikost je 5 MB."
          uploadLabel="Nahrát cover kolekce"
          uploadingLabel="Nahrávám cover…"
          removeLabel="Odebrat cover"
          emptyHint="Pokud cover zatím není hotový, kolekce se veřejně zobrazí se standardním ARTales placeholderem."
          readyHint="Cover kolekce je připravený v ARTales Storage. Další nahrání stejného formátu nahradí aktuální soubor."
          altLabel="Alt text coveru"
          altPlaceholder="Krátký popis obrázku pro přístupnost a SEO"
          captionLabel="Popisek / kredit coveru"
          captionPlaceholder="Nepovinný veřejný popisek nebo kredit obrázku"
          defaultAltPrefix="Cover kolekce"
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
            Uložit kolekci
          </button>

          <Link
            href="/member/collections"
            style={{
              padding: "12px 18px",
              border: "1px solid #ccc",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Zrušit
          </Link>
        </div>
      </form>
    </main>
  )
}