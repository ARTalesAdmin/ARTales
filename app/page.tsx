import Link from "next/link"
import ArtalesBrand from "@/components/brand/ArtalesBrand"
import PublicHeader from "@/components/public/PublicHeader"
import ThemeToggle from "@/components/theme/ThemeToggle"
import { getPublicDictionary } from "@/lib/i18n/public"
import { getCookieLocale } from "@/lib/i18n/server"

export default async function Home() {
  const locale = await getCookieLocale()
  const { public: t } = getPublicDictionary(locale)
  const isCs = locale === "cs"

  const featureCards = [
    {
      title: t.homeCardEditionsTitle,
      text: t.homeCardEditionsText,
    },
    {
      title: t.homeCardReaderTitle,
      text: t.homeCardReaderText,
    },
    {
      title: t.homeCardExpansionTitle,
      text: t.homeCardExpansionText,
    },
  ]

  const pathItems = [
    {
      eyebrow: t.homePathGalleryEyebrow,
      title: t.homePathGalleryTitle,
      text: t.homePathGalleryText,
      href: "/gallery",
      cta: t.homePathGalleryCta,
    },
    {
      eyebrow: t.homePathCollectionsEyebrow,
      title: t.homePathCollectionsTitle,
      text: t.homePathCollectionsText,
      href: "/collections",
      cta: t.homePathCollectionsCta,
    },
    {
      eyebrow: t.homePathAccountEyebrow,
      title: t.homePathAccountTitle,
      text: t.homePathAccountText,
      href: "/account/membership",
      cta: t.homePathAccountCta,
    },
  ]

  return (
    <div className="artales-public-shell artales-home-shell">
      <PublicHeader active="home" />

      <main className="artales-home-main">
        <section className="artales-home-hero">
          <div className="artales-home-hero__copy">
            <p className="artales-home-eyebrow">{t.homeEyebrow}</p>

            <h1>{t.homeTitle}</h1>

            <p className="artales-home-intro">{t.homeIntro}</p>

            <div className="artales-home-actions">
              <Link className="artales-button" href="/gallery">
                {t.homePrimaryCta}
              </Link>
              <Link className="artales-button-secondary" href="/reader/the-phantom-of-the-opera?mode=preview">
                {t.homeSecondaryCta}
              </Link>
            </div>
          </div>

          <aside className="artales-home-brand-panel" aria-label="ARTales visual identity">
            <p className="artales-home-panel-label">{t.homeBrandPanelLabel}</p>
            <ArtalesBrand href="" variant="adaptive" size="lg" showMark />
            <p>{t.homeBrandNote}</p>
            <div className="artales-home-theme-card">
              <span>{t.homeThemeLabel}</span>
              <ThemeToggle
                labels={{
                  light: isCs ? "Světlý" : "Light",
                  dark: isCs ? "Tmavý" : "Dark",
                  aria: isCs ? "Přepnout motiv ARTales" : "Switch ARTales theme",
                }}
              />
            </div>
          </aside>
        </section>

        <section className="artales-home-feature-grid" aria-label={t.homeFeatureAria}>
          {featureCards.map((item) => (
            <article key={item.title} className="artales-home-feature-card">
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="artales-home-section artales-home-section--split">
          <div>
            <p className="artales-home-eyebrow">{t.homeReaderEyebrow}</p>
            <h2>{t.homeReaderTitle}</h2>
          </div>
          <div className="artales-home-section__text">
            <p>{t.homeReaderText}</p>
            <p>{t.homeReaderTextSecondary}</p>
          </div>
        </section>

        <section className="artales-home-paths" aria-label={t.homePathAria}>
          {pathItems.map((item) => (
            <article className="artales-home-path-card" key={item.title}>
              <p className="artales-home-card-eyebrow">{item.eyebrow}</p>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
              <Link href={item.href}>{item.cta}</Link>
            </article>
          ))}
        </section>

        <section className="artales-home-final-cta">
          <p className="artales-home-eyebrow">{t.homeFinalEyebrow}</p>
          <h2>{t.homeFinalTitle}</h2>
          <p>{t.homeFinalText}</p>
          <div className="artales-home-actions artales-home-actions--center">
            <Link className="artales-button" href="/register">
              {t.homeFinalPrimaryCta}
            </Link>
            <Link className="artales-button-secondary" href="/gallery">
              {t.homeFinalSecondaryCta}
            </Link>
          </div>
        </section>

        <section className="artales-home-footnote">
          <p>{t.homeDevelopmentNote}</p>
        </section>
      </main>
    </div>
  )
}
