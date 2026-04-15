import Link from "next/link"

export default function Home() {
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
      <section style={{ marginBottom: "48px" }}>
        <p
          style={{
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            opacity: 0.7,
            marginBottom: "12px",
          }}
        >
          ARTales
        </p>

        <h1
          style={{
            fontSize: "48px",
            marginBottom: "16px",
            lineHeight: 1.1,
          }}
        >
          Living Books Gallery
        </h1>

        <p
          style={{
            fontSize: "20px",
            maxWidth: "760px",
            marginBottom: "24px",
          }}
        >
          Digitální galerie literárních děl, překladů, odvozených verzí a
          budoucích živých knih. ARTales nestaví jen katalog textů, ale systém,
          ve kterém lze text číst, vydávat, rozvíjet a později i spoluvytvářet.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/galerie"
            style={{
              padding: "12px 18px",
              border: "1px solid #111",
              textDecoration: "none",
              color: "#111",
              fontWeight: 600,
            }}
          >
            Projít galerii
          </Link>

          <a
            href="#o-projektu"
            style={{
              padding: "12px 18px",
              border: "1px solid #ccc",
              textDecoration: "none",
              color: "#111",
            }}
          >
            O projektu
          </a>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "48px",
        }}
      >
        <Link
          href="/galerie"
          style={{
            display: "block",
            padding: "20px",
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "#111",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Galerie</h2>
          <p style={{ margin: 0 }}>
            Procházej díla, překlady, odvozeniny a první publikační vrstvy.
          </p>
        </Link>

        <Link
          href="/kolekce/gothic-classics"
          style={{
            display: "block",
            padding: "20px",
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "#111",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Kolekce</h2>
          <p style={{ margin: 0 }}>
            Tematické celky, kurátorské výběry a budoucí publikační řady.
          </p>
        </Link>
      </section>

      <section id="o-projektu" style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "30px", marginBottom: "16px" }}>O projektu</h2>

        <p>
          ARTales je stavěný po vrstvách. Pod veřejnou galerií běží vlastní
          jádro, které rozlišuje dílo, verzi textu, přispěvatele, vztahy mezi
          texty, práva a zdroje. Díky tomu může systém unést jak klasická díla,
          tak překlady, remixy, nové verze a později i komunitní a AI vrstvy.
        </p>

        <p>
          První implementace se soustředí na to, aby Galerie byla srozumitelná,
          čitelná a funkční. Další vrstvy — ingest, pracovní nástroje, Lab,
          personalizace a pokročilejší ekonomika odvozenin — přijdou v dalších
          fázích.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: "30px", marginBottom: "16px" }}>Kontakt / stav</h2>

        <p>
          Projekt je ve výstavbě, ale základní architektura Galerie už běží.
          Postupně doplňujeme publikační vrstvy, kolekce, čtenářské akce a
          budoucí pracovní režimy pro autory a editory.
        </p>

        <p style={{ opacity: 0.75 }}>
          ARTales — under construction, but already alive.
        </p>
      </section>
    </main>
  )
}