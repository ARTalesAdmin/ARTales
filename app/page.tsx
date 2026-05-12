import Link from "next/link"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import { getPublicDictionary } from "@/lib/i18n/public"

export default function Home() {
  const { public: t } = getPublicDictionary()

  return (
    <div className="artales-public-shell">
      <header className="artales-public-header">
        <ArtalesBrand variant="dark" size="md" showMark />
        <nav className="artales-public-header__nav" aria-label="Public navigation">
          <Link className="artales-public-link" href="/galerie">
            {t.gallery}
          </Link>
          <Link className="artales-public-link" href="/kolekce/gothic-classics">
            {t.collections}
          </Link>
        </nav>
      </header>

      <main
        style={{
          color: "var(--artales-ink)",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.6,
          margin: "0 auto",
          maxWidth: "1180px",
          padding: "clamp(46px, 8vw, 92px) 24px 72px",
        }}
      >
        <section
          style={{
            alignItems: "center",
            display: "grid",
            gap: "clamp(28px, 6vw, 72px)",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(260px, 0.9fr)",
            marginBottom: "clamp(54px, 8vw, 96px)",
          }}
          className="artales-home-hero"
        >
          <div>
            <p
              style={{
                color: "#8a6a2d",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                margin: "0 0 14px",
                textTransform: "uppercase",
              }}
            >
              Literary publishing platform
            </p>

            <h1
              style={{
                color: "var(--artales-ink)",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(48px, 8vw, 92px)",
                letterSpacing: "-0.055em",
                lineHeight: 0.98,
                margin: "0 0 22px",
              }}
            >
              Literature, curated for the next layer.
            </h1>

            <p
              style={{
                color: "#3f362f",
                fontSize: "20px",
                margin: "0 0 28px",
                maxWidth: "720px",
              }}
            >
              ARTales is an emerging library, publishing system and reader for
              classic works, original writing, translations and curated editions.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link className="artales-button" href="/galerie">
                Enter the Gallery
              </Link>
              <Link className="artales-button-secondary" href="/reader/the-phantom-of-the-opera?mode=preview">
                Try the reader
              </Link>
            </div>
          </div>

          <aside
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.26))",
              border: "1px solid rgba(13, 21, 40, 0.12)",
              borderRadius: "32px",
              boxShadow: "0 30px 80px rgba(13, 21, 40, 0.12)",
              padding: "clamp(28px, 5vw, 52px)",
              textAlign: "center",
            }}
          >
            <ArtalesBrand href="" variant="dark" size="lg" showMark />
            <p
              style={{
                color: "#5f5247",
                fontSize: "15px",
                margin: "28px auto 0",
                maxWidth: "360px",
              }}
            >
              A calm public surface now, with deeper editorial, edition and
              subscription layers prepared underneath.
            </p>
          </aside>
        </section>

        <section
          style={{
            display: "grid",
            gap: "18px",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            marginBottom: "56px",
          }}
        >
          {[
            {
              title: "Curated editions",
              text: "Public-domain works, translations and original texts can be shaped into structured editions instead of flat pages.",
            },
            {
              title: "Block-first reading",
              text: "Chapters, poems, letters, notes and future images keep their own semantic form from editor to reader.",
            },
            {
              title: "Built for expansion",
              text: "The platform is being prepared for accounts, subscriptions, formats, languages and editorial roles.",
            },
          ].map((item) => (
            <article
              key={item.title}
              style={{
                background: "rgba(255, 255, 255, 0.52)",
                border: "1px solid rgba(13, 21, 40, 0.1)",
                borderRadius: "24px",
                boxShadow: "0 18px 48px rgba(13, 21, 40, 0.07)",
                padding: "24px",
              }}
            >
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "26px",
                  lineHeight: 1.14,
                  margin: "0 0 10px",
                }}
              >
                {item.title}
              </h2>
              <p style={{ color: "#4c4239", margin: 0 }}>{item.text}</p>
            </article>
          ))}
        </section>

        <section
          style={{
            borderTop: "1px solid rgba(13, 21, 40, 0.14)",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            justifyContent: "space-between",
            paddingTop: "24px",
          }}
        >
          <p style={{ color: "#5f5247", margin: 0 }}>
            ARTales is under active development. Public interface defaults to English;
            internal editorial tools currently remain Czech-first.
          </p>
          <Link className="artales-public-link" href="/member">
            Member zone
          </Link>
        </section>
      </main>
    </div>
  )
}
