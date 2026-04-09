import { redirect } from "next/navigation"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth"
import { completeProfile, logout } from "./actions"

type PageProps = {
  searchParams: Promise<{ error?: string }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Vyplň handle i zobrazované jméno."
    case "handle":
      return "Handle musí mít 3–32 znaků a může obsahovat jen a-z, 0-9, _ nebo -."
    case "handle_taken":
      return "Tento handle už je obsazený. Zvol jiný."
    case "save":
      return "Profil se nepodařilo uložit. Zkus to znovu."
    default:
      return null
  }
}

export default async function MemberPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  const errorMessage = getErrorMessage(error)

  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/login")
  }

  const needsOnboarding = !profile.handle || !profile.display_name

  if (needsOnboarding) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "560px",
            border: "1px solid #ddd",
            padding: "32px",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              opacity: 0.7,
              marginBottom: "10px",
            }}
          >
            ARTales
          </p>

          <h1
            style={{
              fontSize: "36px",
              lineHeight: 1.1,
              marginTop: 0,
              marginBottom: "12px",
            }}
          >
            Dokončení profilu
          </h1>

          <p
            style={{
              marginTop: 0,
              marginBottom: "24px",
              opacity: 0.8,
            }}
          >
            Než vstoupíš do členské zóny, doplň prosím své systémové jméno a
            zobrazované jméno.
          </p>

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

          <form action={completeProfile} style={{ display: "grid", gap: "18px" }}>
            <div>
              <label
                htmlFor="handle"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Handle
              </label>
              <input
                id="handle"
                name="handle"
                type="text"
                required
                defaultValue=""
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Jedinečné systémové jméno. Používá se interně a později může být
                součástí odkazu na profil. Po založení se běžně nemění.
              </p>
            </div>

            <div>
              <label
                htmlFor="display_name"
                style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
              >
                Zobrazované jméno
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                required
                defaultValue={profile.display_name ?? ""}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ccc",
                  fontSize: "16px",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", opacity: 0.75 }}>
                Jméno, které uvidí ostatní uživatelé v rozhraní a u tvých aktivit, vč. tiráže.
                To lze později upravit.
              </p>
            </div>

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
              Uložit a pokračovat
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        padding: "48px 32px",
        fontFamily: "serif",
        lineHeight: 1.6,
        maxWidth: "960px",
        margin: "0 auto",
      }}
    >
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
          ARTales
        </p>

        <h1
          style={{
            fontSize: "42px",
            lineHeight: 1.1,
            marginTop: 0,
            marginBottom: "14px",
          }}
        >
          Členská zóna
        </h1>

        <p style={{ fontSize: "18px", maxWidth: "720px", marginBottom: "18px" }}>
          Vítej v interní vrstvě ARTales. Tohle je první pracovní vstup do systému.
        </p>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ marginBottom: "12px" }}>Profil</h2>

        <p>
          <strong>E-mail:</strong> {profile.email}
        </p>

        <p>
          <strong>Handle:</strong> @{profile.handle}
        </p>

        <p>
          <strong>Zobrazované jméno:</strong> {profile.display_name}
        </p>

        <p>
          <strong>Role:</strong> {profile.role}
        </p>

        <p>
          <strong>Aktivní:</strong> {profile.is_active ? "ano" : "ne"}
        </p>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <section style={{ marginBottom: "28px" }}>
        <h2 style={{ marginBottom: "12px" }}>Pracovní vrstva</h2>

        <p style={{ marginBottom: "12px" }}>
          Další krok bude napojení editor nástrojů podle role.
        </p>

        <ul style={{ paddingLeft: "20px" }}>
          <li>správa děl</li>
          <li>správa autorů</li>
          <li>správa kolekcí</li>
        </ul>
      </section>

      <hr style={{ margin: "28px 0" }} />

      <form action={logout}>
        <button
          type="submit"
          style={{
            padding: "12px 18px",
            border: "1px solid #111",
            background: "#fff",
            color: "#111",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
          }}
        >
          Odhlásit se
        </button>
      </form>
    </main>
  )
}