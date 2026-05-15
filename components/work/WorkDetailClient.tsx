import Link from "next/link";
import type { WorkDetailItem } from "@/lib/dbWorks";
import WorkCoverImage from "@/components/work/WorkCoverImage";
import PublicHeader from "@/components/public/PublicHeader";
import ReaderWorkActions from "@/components/reader/ReaderWorkActions";
import { getPublicDictionary } from "@/lib/i18n/public";

type WorkDetailClientProps = {
  work: WorkDetailItem;
  languageLabel: string;
  statusLabel: string;
  originLabel: string;
  sourceLabel: string;
};

function ComingSoonBadge() {
  const t = getPublicDictionary().common;

  return (
    <span
      style={{
        marginLeft: "8px",
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "rgba(13, 21, 40, 0.58)",
      }}
    >
      {t.comingSoon}
    </span>
  );
}

function normalizeIsbnStatus(status: string | null | undefined) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "external":
      return "External";
    case "planned":
      return "Planned";
    case "requested":
      return "Requested";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Not required";
  }
}

export default function WorkDetailClient({
  work,
  languageLabel,
  statusLabel,
  originLabel,
  sourceLabel,
}: WorkDetailClientProps) {
  const { common, public: t } = getPublicDictionary();
  const authorName = work.author?.name ?? t.unknownAuthor;
  const publicIsbnVisible =
    Boolean(work.isbn) &&
    (work.isbn_status === "assigned" || work.isbn_status === "external");
  const editionLanguage = work.edition_language || work.canonical_language;

  return (
    <div className="artales-public-shell">
      <PublicHeader active="work" />

      <main
        style={{
          padding: "42px 24px 64px",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.6,
          maxWidth: "1180px",
          margin: "0 auto",
          color: "var(--artales-ink)",
        }}
      >
        <p style={{ margin: "0 0 22px" }}>
          <Link href="/gallery" style={{ color: "#5f5247" }}>
            {"<- "}
            {t.backToGallery}
          </Link>
        </p>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 340px) minmax(0, 1fr)",
            gap: "clamp(24px, 5vw, 58px)",
            alignItems: "start",
            marginBottom: "42px",
          }}
        >
          <aside>
            <WorkCoverImage
              title={work.title}
              imagePath={work.cover_image_path}
              alt={work.cover_image_alt}
              caption={work.cover_image_caption}
              variant="detail"
            />
          </aside>

          <div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: "13px",
                color: "#8a6a2d",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontWeight: 800,
              }}
            >
              {originLabel}
            </p>

            <h1
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(40px, 6vw, 72px)",
                lineHeight: 1.02,
                margin: "0 0 14px",
                letterSpacing: "-0.045em",
                color: "var(--artales-ink)",
              }}
            >
              {work.title}
            </h1>

            {work.subtitle ? (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "20px",
                  color: "#5f5247",
                }}
              >
                {work.subtitle}
              </p>
            ) : null}

            <p style={{ margin: "0 0 18px", fontSize: "18px" }}>
              {t.byAuthor}{" "}
              {work.author ? (
                <Link
                  href={`/author/${work.author.slug}`}
                  style={{ color: "var(--artales-ink)", fontWeight: 800 }}
                >
                  {work.author.name}
                </Link>
              ) : (
                <strong>{t.unknownAuthor}</strong>
              )}
            </p>

            <p
              style={{
                margin: "0 0 26px",
                fontSize: "18px",
                maxWidth: "760px",
                color: "#3f362f",
              }}
            >
              {work.summary}
            </p>

            {work.collection ? (
              <p style={{ margin: "0 0 24px", color: "#5f5247" }}>
                {t.partOf}{" "}
                <Link
                  href={`/collections/${work.collection.slug}`}
                  style={{ color: "var(--artales-ink)", fontWeight: 800 }}
                >
                  {work.collection.title}
                </Link>
              </p>
            ) : null}

            <ReaderWorkActions
              slug={work.slug}
              readPreviewLabel={t.readPreview}
              readOnlineLabel={t.readOnline}
              continueReadingLabel={t.continueReading}
              saveForLaterLabel={t.saveForLater}
            />

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "12px",
              }}
            >
              <span className="artales-button-muted">
                {t.buyPdf} <ComingSoonBadge />
              </span>
              <span className="artales-button-muted">
                {t.buyEpub} <ComingSoonBadge />
              </span>
              <span className="artales-button-muted">
                {t.audiobook} <ComingSoonBadge />
              </span>
            </div>
          </div>
        </section>

        <section
          style={{
            borderTop: "1px solid rgba(13, 21, 40, 0.14)",
            borderBottom: "1px solid rgba(13, 21, 40, 0.14)",
            padding: "20px 0",
            marginBottom: "34px",
          }}
        >
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "18px",
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              {t.aboutThisEdition}
            </summary>

            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)",
                gap: "8px 20px",
                margin: "18px 0 0",
                color: "#3f362f",
              }}
            >
              <dt style={{ fontWeight: 800 }}>{common.author}</dt>
              <dd style={{ margin: 0 }}>{authorName}</dd>

              {work.edition_title ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Edition</dt>
                  <dd style={{ margin: 0 }}>{work.edition_title}</dd>
                </>
              ) : null}

              {work.edition_version ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Version</dt>
                  <dd style={{ margin: 0 }}>{work.edition_version}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{common.language}</dt>
              <dd style={{ margin: 0 }}>
                {work.edition_language ? editionLanguage : languageLabel}
              </dd>

              {work.original_language ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Original language</dt>
                  <dd style={{ margin: 0 }}>{work.original_language}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{t.editionType}</dt>
              <dd style={{ margin: 0 }}>{originLabel}</dd>

              {work.edition_publisher ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Publisher / imprint</dt>
                  <dd style={{ margin: 0 }}>{work.edition_publisher}</dd>
                </>
              ) : null}

              {work.publication_year ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Publication year</dt>
                  <dd style={{ margin: 0 }}>{work.publication_year}</dd>
                </>
              ) : null}

              {work.edition_license ? (
                <>
                  <dt style={{ fontWeight: 800 }}>License / rights</dt>
                  <dd style={{ margin: 0 }}>{work.edition_license}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{common.source}</dt>
              <dd style={{ margin: 0 }}>{sourceLabel}</dd>

              {work.edition_source_url ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Source URL</dt>
                  <dd style={{ margin: 0 }}>
                    <a
                      href={work.edition_source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--artales-ink)", fontWeight: 700 }}
                    >
                      {work.edition_source_url}
                    </a>
                  </dd>
                </>
              ) : null}

              {work.source_reference ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{common.reference}</dt>
                  <dd style={{ margin: 0 }}>{work.source_reference}</dd>
                </>
              ) : null}

              {work.contributor_summary ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Contributors</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {work.contributor_summary}
                  </dd>
                </>
              ) : null}

              {work.edition_note_public ? (
                <>
                  <dt style={{ fontWeight: 800 }}>Edition note</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {work.edition_note_public}
                  </dd>
                </>
              ) : null}

              {publicIsbnVisible ? (
                <>
                  <dt style={{ fontWeight: 800 }}>ISBN</dt>
                  <dd style={{ margin: 0 }}>{work.isbn}</dd>
                </>
              ) : null}

              {work.isbn_status &&
              work.isbn_status !== "not_required" &&
              !publicIsbnVisible ? (
                <>
                  <dt style={{ fontWeight: 800 }}>ISBN status</dt>
                  <dd style={{ margin: 0 }}>
                    {normalizeIsbnStatus(work.isbn_status)}
                  </dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{t.publicationStatus}</dt>
              <dd style={{ margin: 0 }}>{statusLabel}</dd>
            </dl>
          </details>
        </section>

        {work.author?.bio ? (
          <section style={{ marginBottom: "34px", maxWidth: "780px" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "28px",
              }}
            >
              {t.aboutAuthor}
            </h2>
            <p style={{ margin: 0, color: "#3f362f" }}>{work.author.bio}</p>
          </section>
        ) : null}

        {work.collection?.description ? (
          <section style={{ marginBottom: "34px", maxWidth: "780px" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "28px",
              }}
            >
              {t.aboutCollection}
            </h2>
            <p style={{ margin: 0, color: "#3f362f" }}>
              {work.collection.description}
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
