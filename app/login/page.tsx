import { login } from "./actions"

type PageProps = {
  searchParams: Promise<{ error?: string }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "missing":
      return "Vyplň e-mail i heslo."
    case "invalid":
      return "Přihlášení se nezdařilo. Zkontroluj e-mail a heslo."
    default:
      return null
  }
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams
  const errorMessage = getErrorMessage(error)

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
          maxWidth: "460px",
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
          Přihlášení
        </h1>

        <p
          style={{
            marginTop: 0,
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          Přihlas se do členské zóny ARTales.
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

        <form action={login} style={{ display: "grid", gap: "18px" }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
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
              htmlFor="password"
              style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
            >
              Heslo
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ccc",
                fontSize: "16px",
              }}
            />
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
            Přihlásit se
          </button>
        </form>
      </div>
    </main>
  )
}