import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getAuthorForEditBySlug } from "@/lib/dbAuthors"
import { mapAuthorToFormValues } from "@/lib/forms/authorForm"
import { updateAuthor } from "@/lib/actions/authors"
import { getLanguageOptions } from "@/lib/dictionaries/language"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "name_missing":
      return "Jméno autora je povinné."
    case "slug_missing":
      return "Slug je povinný."
    case "slug_invalid":
      return "Slug může obsahovat jen malá písmena, čísla a pomlčky."
    case "birth_year_invalid":
      return "Rok narození musí být čtyřmístné číslo."
    case "death_year_invalid":
      return "Rok úmrtí musí být čtyřmístné číslo."
    case "slug_taken":
      return "Tento slug už existuje. Zvol jiný."
    case "save_failed":
      return "Autora se nepodařilo uložit. Zkus to znovu."
    case "primary_language_invalid":
      return "Primární jazyk musí být vybrán z nabídky."
    default:
      return null
  }
}

function getSuccessMessage(success?: string) {
  switch (success) {
    case "author_updated":
      return "Autor byl uložen."
    default:
      return null
  }
}

export default async function EditAuthorPage({
  params,
  searchParams,
}: PageProps) {
  await requireEditorOrAdmin()

  const { slug } = await params
  const { error, success } = await searchParams
  const author = await getAuthorForEditBySlug(slug)

  if (!author) {
    return (
      <main style={{ padding: "40px", fontFamily: "serif" }}>
        <h1>Autor nebyl nalezen</h1>
        <p>Požadovaný autor v interní vrstvě neexistuje.</p>
        <p>
          <Link href="/member/authors">Zpět na seznam autorů</Link>
        </p>
      </main>
    )
  }

  const values = mapAuthorToFormValues(author)
  const errorMessage = getErrorMessage(error)
  const successMessage = getSuccessMessage(success)
  const languageOptions = getLanguageOptions("internal")

  const submitAction = updateAuthor.bind(null, slug)

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
        <Link href="/member/authors">{"<- Zpět na seznam autorů"}</Link>
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
          Editace autora
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Uprav interní a veřejná metadata autora.
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

      <form action={submitAction} style={{ display: "grid", gap: "22px" }}>
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
              htmlFor="name"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Jméno autora
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={values.name}
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
              htmlFor="author_type"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Typ autora
            </label>
            <select
              id="author_type"
              name="author_type"
              defaultValue={values.author_type}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="person">Osoba</option>
              <option value="collective">Kolektiv</option>
              <option value="unknown">Neznámý autor</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="bio"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Biografie
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={values.bio}
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
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            padding: "24px",
            display: "grid",
            gap: "18px",
          }}
        >
          <h2 style={{ margin: 0 }}>Doplňující metadata</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
            <div>
              <label
                htmlFor="birth_year"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Rok narození
              </label>
              <input
                id="birth_year"
                name="birth_year"
                type="text"
                inputMode="numeric"
                defaultValue={values.birth_year}
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
                htmlFor="death_year"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Rok úmrtí
              </label>
              <input
                id="death_year"
                name="death_year"
                type="text"
                inputMode="numeric"
                defaultValue={values.death_year}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="country"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Země
            </label>
            <input
              id="country"
              name="country"
              type="text"
              defaultValue={values.country}
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
              htmlFor="primary_language"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Primární jazyk
            </label>
            <select
              id="primary_language"
              name="primary_language"
              defaultValue={values.primary_language}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            >
              <option value="">— Nevybráno —</option>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Hodnota se ukládá jako standardizovaný kód.
            </p>
          </div>

          <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              name="is_public_visible"
              type="checkbox"
              defaultChecked={values.is_public_visible}
            />
            <span>Autor je veřejně viditelný</span>
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
            href={`/autor/${author.slug}`}
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