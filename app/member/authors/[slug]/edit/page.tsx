import Link from "next/link"
import { requireEditorOrAdmin } from "@/lib/guards"
import { getAuthorForEditBySlug } from "@/lib/dbAuthors"
import { mapAuthorToFormValues } from "@/lib/forms/authorForm"
import { updateAuthor } from "@/lib/actions/authors"
import { getLanguageOptions } from "@/lib/dictionaries/language"
import EditorialImageUploadField from "@/components/media/EditorialImageUploadField"

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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label
                htmlFor="name_en"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Jméno autora anglicky
              </label>
              <input
                id="name_en"
                name="name_en"
                type="text"
                required
                defaultValue={values.name_en}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Výchozí veřejné jméno autora. Použije se také pro slug, pokud ho nevyplníš ručně.
              </p>
            </div>

            <div>
              <label
                htmlFor="name_cs"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Jméno autora česky
              </label>
              <input
                id="name_cs"
                name="name_cs"
                type="text"
                defaultValue={values.name_cs}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Vyplň jen pokud se má české zobrazení lišit. Jinak se použije anglické jméno.
              </p>
            </div>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label
                htmlFor="bio_en"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Biografie anglicky
              </label>
              <textarea
                id="bio_en"
                name="bio_en"
                defaultValue={values.bio_en}
                rows={7}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                  resize: "vertical",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Výchozí biografie autora pro anglické i fallback zobrazení.
              </p>
            </div>

            <div>
              <label
                htmlFor="bio_cs"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Biografie česky
              </label>
              <textarea
                id="bio_cs"
                name="bio_cs"
                defaultValue={values.bio_cs}
                rows={7}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                  resize: "vertical",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Česká verze se použije v českém prostředí. Pokud chybí, použije se anglická biografie.
              </p>
            </div>
          </div>

        </section>

        <p style={{ margin: "0", fontSize: "14px" }}>
          <Link className="artales-editor-help-link" href="/member/resources#author-portrait">
            Otevřít author portrait standard a prompt
          </Link>
        </p>

        <EditorialImageUploadField
          kind="author-portrait"
          title={(values.name_en || values.name_cs || "ARTales autor")}
          slugInputId="slug"
          titleInputId="name_en"
          pathName="portrait_image_path"
          altName="portrait_image_alt"
          captionName="portrait_image_caption"
          initialPath={values.portrait_image_path}
          initialAlt={values.portrait_image_alt}
          initialCaption={values.portrait_image_caption}
          heading="Portrét autora"
          description="Nahraj veřejný portrét autora přímo do ARTales Storage. Podporované formáty: JPG, PNG, WebP. Maximální velikost je 5 MB."
          uploadLabel="Nahrát portrét"
          uploadingLabel="Nahrávám portrét…"
          removeLabel="Odebrat portrét"
          emptyHint="Pokud portrét zatím není hotový, autor se veřejně zobrazí bez obrázku."
          readyHint="Portrét je připravený v ARTales Storage. Další nahrání stejného formátu nahradí aktuální soubor."
          altLabel="Alt text portrétu"
          altPlaceholder="Krátký popis portrétu pro přístupnost a SEO"
          captionLabel="Popisek / kredit portrétu"
          captionPlaceholder="Nepovinný veřejný popisek nebo kredit obrázku"
          defaultAltPrefix="Portrét autora"
        />

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
              Hlavní jazyk autora
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
              Jeden hlavní jazyk pro rychlé filtrování a starší výpisy.
            </p>
          </div>

          <fieldset
            style={{
              border: "1px solid #e2ded8",
              padding: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <legend style={{ padding: "0 6px", fontWeight: 600 }}>
              Jazyky autora / psaní
            </legend>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.75 }}>
              Lze vybrat více jazyků. Použij pro autory, kteří psali nebo jsou
              významně vedeni ve více jazykových vrstvách.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "8px 12px",
              }}
            >
              {languageOptions.map((option) => (
                <label key={option.value} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name="writing_languages"
                    value={option.value}
                    defaultChecked={values.writing_languages.some((language) => language === option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

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