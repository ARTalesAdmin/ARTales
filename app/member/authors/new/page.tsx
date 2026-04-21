import Link from "next/link"
import { getLanguageOptions } from "@/lib/dictionaries/language"
import { requireEditorOrAdmin } from "@/lib/guards"
import { createAuthor } from "@/lib/actions/authors"
import { getDefaultAuthorFormValues } from "@/lib/forms/authorForm"

type PageProps = {
  searchParams: Promise<{ error?: string; returnTo?: string }>
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

export default async function NewAuthorPage({ searchParams }: PageProps) {
  await requireEditorOrAdmin()

  const defaults = getDefaultAuthorFormValues()
  const { error, returnTo } = await searchParams
  const errorMessage = getErrorMessage(error)
  const languageOptions = getLanguageOptions("internal")

  const cancelHref = returnTo && returnTo.startsWith("/") ? returnTo : "/member"

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
        <Link href={cancelHref}>{"<- Zpět"}</Link>
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
          Nový autor
        </h1>

        <p style={{ maxWidth: "720px", marginBottom: "18px" }}>
          Založ nového autora do databáze ARTales. Pokud už autor v systému
          existuje, nezakládej duplicitní záznam a použij existujícího.
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

      <form action={createAuthor} style={{ display: "grid", gap: "22px" }}>
        <input type="hidden" name="returnTo" value={returnTo ?? ""} />

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
              defaultValue={defaults.name}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Oficiální nebo běžně používané jméno autora. Povinné pole.
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
              defaultValue={defaults.slug}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              URL identifikátor autora. Když ho nevyplníš, vytvoří se automaticky
              ze jména. Povolená jsou pouze malá písmena, čísla a pomlčky.
            </p>
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
              defaultValue={defaults.author_type}
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
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Výchozí typ je osoba. Kolektiv použij pro skupiny, unknown jen pokud
              autor opravdu není známý.
            </p>
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
              defaultValue={defaults.bio}
              rows={6}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
                resize: "vertical",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinné stručné představení autora.
            </p>
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
                defaultValue={defaults.birth_year}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Nepovinné pole. Použij čtyřmístný rok.
              </p>
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
                defaultValue={defaults.death_year}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Nepovinné pole. Použij čtyřmístný rok.
              </p>
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
              defaultValue={defaults.country}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
              Nepovinné pole. Zatím volný text. Psát anglicky "United Kingdom" namísto "Anglie".
            </p>
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
              defaultValue={defaults.primary_language}
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
              Nepovinné pole. Do databáze se ukládá pouze kód jazyka, editor vidí
              český popisek.
            </p>
          </div>

          <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              name="is_public_visible"
              type="checkbox"
              defaultChecked={defaults.is_public_visible}
            />
            <span>Autor je veřejně viditelný</span>
          </label>
          <p style={{ margin: "-8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
            Pokud není zaškrtnuto, autor zůstane jen v interní vrstvě editoru.
          </p>
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
            Uložit autora
          </button>

          <Link
            href={cancelHref}
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