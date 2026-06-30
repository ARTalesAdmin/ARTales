import Link from "next/link";
import type { WorkDetailItem } from "@/lib/dbWorks";
import WorkCoverImage from "@/components/work/WorkCoverImage";
import PublicHeader from "@/components/public/PublicHeader";
import ReaderWorkActions from "@/components/reader/ReaderWorkActions";
import WorkFeedbackPanel from "@/components/community/WorkFeedbackPanel";
import { getPublicDictionary } from "@/lib/i18n/public";
import type { SupportedLocale } from "@/lib/i18n/config";
import {
  DEFAULT_PRODUCT_COPY,
  PRODUCT_TYPE_LABELS,
  formatProductPrice,
  getPrimaryProductPrice,
  type WorkProductOffer,
  type ProductType,
} from "@/lib/products";
import { getProductSurfaceItems, isDownloadProduct } from "@/lib/productDelivery";
import { pickLocalizedText } from "@/lib/localizedContent";
import { getLocalizedLanguageLabel } from "@/lib/dictionaries/language";

type WorkDetailClientProps = {
  work: WorkDetailItem;
  languageLabel: string;
  statusLabel: string;
  originLabel: string;
  sourceLabel: string;
  canReadFull: boolean;
  workId: string;
  isSignedIn: boolean;
  isSaved: boolean;
  welcomeUnlockAvailable: boolean;
  products: WorkProductOffer[];
  viewerRole: string | null;
  feedbackStatus?: string | null;
  locale: SupportedLocale;
};


type WorkPublicLabels = ReturnType<typeof getPublicDictionary>["public"];

type AccessStatusCardProps = {
  isSignedIn: boolean;
  canReadFull: boolean;
  welcomeUnlockAvailable: boolean;
  viewerRole: string | null;
  slug: string;
  labels: WorkPublicLabels;
};

function isInternalRole(role: string | null) {
  return role === "admin" || role === "editor" || role === "member";
}

function AccessStatusCard({
  isSignedIn,
  canReadFull,
  welcomeUnlockAvailable,
  viewerRole,
  slug,
  labels,
}: AccessStatusCardProps) {
  const internalAccess = isInternalRole(viewerRole);

  if (internalAccess) {
    return (
      <section className="artales-access-card artales-access-card--internal">
        <p className="artales-access-card__eyebrow">{labels.accessInternalEyebrow}</p>
        <h2>{labels.accessInternalTitle}</h2>
        <p>{labels.accessInternalText}</p>
        <Link className="artales-button-secondary" href={`/reader/${slug}?mode=full`}>
          {labels.openFullReader}
        </Link>
      </section>
    );
  }

  if (canReadFull) {
    return (
      <section className="artales-access-card artales-access-card--owned">
        <p className="artales-access-card__eyebrow">{labels.accessLibraryEyebrow}</p>
        <h2>{labels.accessLibraryTitle}</h2>
        <p>{labels.accessLibraryText}</p>
        <Link className="artales-button" href={`/reader/${slug}?mode=full`}>
          {labels.readNow}
        </Link>
      </section>
    );
  }

  if (!isSignedIn) {
    return (
      <section className="artales-access-card">
        <p className="artales-access-card__eyebrow">{labels.accessPreviewEyebrow}</p>
        <h2>{labels.accessGuestTitle}</h2>
        <p>{labels.accessGuestText}</p>
        <div className="artales-access-card__actions">
          <Link className="artales-button" href="/register">
            {labels.createFreeAccount}
          </Link>
          <Link className="artales-button-secondary" href="/login">
            {labels.signIn}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="artales-access-card">
      <p className="artales-access-card__eyebrow">{labels.accessPreviewEyebrow}</p>
      <h2>{labels.accessReaderTitle}</h2>
      <p>{labels.accessReaderText}</p>
      <div className="artales-access-card__actions">
        {welcomeUnlockAvailable ? (
          <Link className="artales-button" href={`/account/unlock/${slug}`}>
            {labels.useWelcomeUnlock}
          </Link>
        ) : null}
        <Link className="artales-button-secondary" href="/account/membership">
          {labels.viewMembershipOptions}
        </Link>
      </div>
    </section>
  );
}

function getProductTitle(type: ProductType, labels: WorkPublicLabels) {
  switch (type) {
    case "online_unlock":
      return labels.productOnlineTitle;
    case "pdf_download":
      return labels.productPdfTitle;
    case "epub_download":
      return labels.productEpubTitle;
    case "pdf_epub_bundle":
      return labels.productBundleTitle;
    case "print":
      return labels.productPrintTitle;
    default:
      return labels.productAccessTitle;
  }
}

function getProductStatusLabel(status: string, labels: WorkPublicLabels) {
  switch (status) {
    case "unlocked":
      return labels.statusUnlocked;
    case "available":
      return labels.statusAvailable;
    case "preparing":
      return labels.statusPreparing;
    case "coming_later":
      return labels.statusComingLater;
    case "not_available":
      return labels.statusNotAvailable;
    default:
      return labels.statusComingLater;
  }
}

function normalizePlaceholderText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isComingSoonPlaceholder(value: string | null | undefined) {
  const normalized = normalizePlaceholderText(value);
  if (!normalized) return true;

  return (
    normalized === "coming soon" ||
    normalized === "coming later" ||
    normalized === "not available" ||
    normalized === "available soon" ||
    normalized.includes("coming soon") ||
    normalized.includes("coming later") ||
    normalized.includes("available soon")
  );
}

function isPlaceholderProductTitle(
  value: string | null | undefined,
  type: ProductType
) {
  if (isComingSoonPlaceholder(value)) return true;

  const normalized = normalizePlaceholderText(value);
  const genericTitles = [
    DEFAULT_PRODUCT_COPY[type].title,
    PRODUCT_TYPE_LABELS[type],
    type,
  ].map(normalizePlaceholderText);

  return genericTitles.includes(normalized);
}

function isPlaceholderProductDescription(
  value: string | null | undefined,
  type: ProductType
) {
  if (isComingSoonPlaceholder(value)) return true;

  const normalized = normalizePlaceholderText(value);
  const defaultDescription = normalizePlaceholderText(DEFAULT_PRODUCT_COPY[type].description);

  return (
    normalized === defaultDescription ||
    normalized.includes("permanent online reading access") ||
    normalized.includes("downloadable pdf edition") ||
    normalized.includes("downloadable epub edition") ||
    normalized.includes("combined digital edition package") ||
    normalized.includes("printed edition placeholder") ||
    normalized.includes("export tooling is ready") ||
    normalized.includes("delivery is coming")
  );
}

function resolveEditionLanguageCode(
  rawLanguageCode: string | null | undefined,
  work: WorkDetailItem
) {
  const normalized = rawLanguageCode?.trim() || null;

  // Early imports used the UI locale as the default work language. Until all
  // rows are normalized in DB, English public-domain metadata is a stronger
  // signal than an accidental "cs" language code.
  if (
    normalized === "cs" &&
    !work.title_cs &&
    Boolean(work.title_en || work.title)
  ) {
    return "en";
  }

  return normalized;
}

function ProductOptions({
  products,
  canReadFull,
  slug,
  labels,
}: {
  products: WorkProductOffer[];
  canReadFull: boolean;
  slug: string;
  labels: WorkPublicLabels;
}) {
  const surfaceItems = getProductSurfaceItems(products, canReadFull);

  if (surfaceItems.length === 0) {
    return (
      <section className="artales-product-panel artales-product-panel--quiet">
        <p className="artales-product-panel__eyebrow">{labels.productDeliveryLabel}</p>
        <h2>{labels.productDeliveryPreparingTitle}</h2>
        <p>{labels.productDeliveryPreparingText}</p>
      </section>
    );
  }

  return (
    <section className="artales-product-panel">
      <div className="artales-product-panel__header">
        <div>
          <p className="artales-product-panel__eyebrow">{labels.productDeliveryLabel}</p>
          <h2>{labels.productDeliveryTitle}</h2>
          <p className="artales-product-panel__intro">{labels.productDeliveryText}</p>
        </div>
        {canReadFull ? <span className="artales-product-badge">{labels.statusUnlocked}</span> : null}
      </div>

      <div className="artales-product-grid artales-product-grid--delivery">
        {surfaceItems.map((item) => {
          const product = item.product;
          const price = product ? getPrimaryProductPrice(product) : null;
          const title = !product || isPlaceholderProductTitle(product.title, item.key)
            ? getProductTitle(item.key, labels)
            : product.title;
          const description = !product || isPlaceholderProductDescription(product.description, item.key)
            ? isDownloadProduct(item.key)
              ? labels.productDownloadLaterText
              : labels.productOnlineText
            : product.description;

          return (
            <article key={item.key} className={item.status === "unlocked" ? "artales-product-card artales-product-card--owned" : "artales-product-card"}>
              <div className="artales-product-card__topline">
                <h3>{title}</h3>
                <span>{formatProductPrice(price, labels.productPricePreparing)}</span>
              </div>
              <p>{description}</p>
              <p className="artales-product-card__status">{getProductStatusLabel(item.status, labels)}</p>
              {item.status === "unlocked" ? (
                <Link className="artales-button-secondary" href={`/reader/${slug}?mode=full`}>
                  {labels.readNow}
                </Link>
              ) : item.status === "available" && product ? (
                <Link className="artales-button" href="/checkout/credits">
                  {labels.continueAccess}
                </Link>
              ) : (
                <p className="artales-product-card__note">{labels.productNoActionNote}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function normalizeIsbnStatus(status: string | null | undefined, labels: WorkPublicLabels) {
  switch (status) {
    case "assigned":
      return labels.isbnAssigned;
    case "external":
      return labels.isbnExternal;
    case "planned":
      return labels.isbnPlanned;
    case "requested":
      return labels.isbnRequested;
    case "not_applicable":
      return labels.isbnNotApplicable;
    default:
      return labels.isbnNotRequired;
  }
}

export default function WorkDetailClient({
  work,
  languageLabel,
  statusLabel,
  originLabel,
  sourceLabel,
  canReadFull,
  workId,
  isSignedIn,
  isSaved,
  welcomeUnlockAvailable,
  products,
  viewerRole,
  feedbackStatus,
  locale,
}: WorkDetailClientProps) {
  const { common, public: t } = getPublicDictionary(locale);
  const authorName = work.author?.name ?? t.unknownAuthor;
  const title = pickLocalizedText(locale, {
    cs: work.title_cs,
    en: work.title_en,
    fallback: work.title,
  }) ?? work.title;
  const subtitle = pickLocalizedText(locale, {
    cs: work.subtitle_cs,
    en: work.subtitle_en,
    fallback: work.subtitle,
  });
  const summary = pickLocalizedText(locale, {
    cs: work.summary_cs,
    en: work.summary_en,
    fallback: work.summary,
  }) ?? work.summary;
  const publicIsbnVisible =
    Boolean(work.isbn) &&
    (work.isbn_status === "assigned" || work.isbn_status === "external");
  const editionLanguageCode =
    resolveEditionLanguageCode(work.edition_language || work.canonical_language, work) ||
    work.canonical_language;
  const originalLanguageCode = resolveEditionLanguageCode(work.original_language, work);
  const editionLanguage =
    getLocalizedLanguageLabel(editionLanguageCode, locale) ?? languageLabel;
  const originalLanguage =
    getLocalizedLanguageLabel(originalLanguageCode, locale) ?? originalLanguageCode;
  const isOriginalLanguageEdition =
    Boolean(originalLanguageCode) && editionLanguageCode === originalLanguageCode;
  const languageVersionLabel =
    locale === "cs"
      ? isOriginalLanguageEdition
        ? "Původní jazyková verze"
        : "Jazyková edice"
      : isOriginalLanguageEdition
        ? "Original-language edition"
        : "Language edition";
  const languageVersionText =
    locale === "cs"
      ? isOriginalLanguageEdition
        ? "Tato edice odpovídá původnímu jazyku díla."
        : originalLanguage
          ? `Tato edice je jazyková verze díla. Původní jazyk: ${originalLanguage}.`
          : "Tato edice má vlastní jazykovou podobu. Původní jazyk zatím není uveden."
      : isOriginalLanguageEdition
        ? "This edition matches the original language of the work."
        : originalLanguage
          ? `This edition is a language version of the work. Original language: ${originalLanguage}.`
          : "This edition has its own language form. The original language is not listed yet.";
  const localizedCollections = work.collections
    .filter((collection): collection is NonNullable<typeof collection> => Boolean(collection))
    .map((collection) => ({
      ...collection,
      displayTitle:
        pickLocalizedText(locale, {
          cs: collection.title_cs,
          en: collection.title_en,
          fallback: collection.title,
        }) ?? collection.title,
      displayDescription: pickLocalizedText(locale, {
        cs: collection.description_cs,
        en: collection.description_en,
        fallback: collection.description ?? null,
      }),
    }));
  const primaryCollection = localizedCollections[0] ?? null;
  const localizedTags = work.tags
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .map((tag) => ({
      ...tag,
      displayLabel:
        pickLocalizedText(locale, {
          cs: tag.label_cs,
          en: tag.label_en,
          fallback: tag.label_cs,
        }) ?? tag.label_cs,
    }));

  return (
    <div className="artales-public-shell">
      <PublicHeader active="work" />

      <main className="artales-public-main artales-work-detail-main">
        <p style={{ margin: "0 0 22px" }}>
          <Link href="/gallery" style={{ color: "#5f5247" }}>
            {"<- "}
            {t.backToGallery}
          </Link>
        </p>

        <section
          className="artales-work-detail-hero"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 340px) minmax(0, 1fr)",
            gap: "clamp(24px, 5vw, 58px)",
            alignItems: "start",
            marginBottom: "42px",
          }}
        >
          <aside className="artales-work-detail-sidebar">
            <WorkCoverImage
              title={title}
              imagePath={work.cover_image_path}
              alt={work.cover_image_alt}
              caption={work.cover_image_caption}
              variant="detail"
            />

            <div className="artales-work-detail-facts" aria-label={t.aboutThisEdition}>
              <p className="artales-public-kicker artales-public-kicker--small">{t.aboutThisEdition}</p>
              <dl>
                <div>
                  <dt>{common.author}</dt>
                  <dd>
                    {work.author ? (
                      <Link href={`/author/${work.author.slug}`}>{work.author.name}</Link>
                    ) : (
                      t.unknownAuthor
                    )}
                  </dd>
                </div>
                {primaryCollection ? (
                  <div>
                    <dt>{common.collection}</dt>
                    <dd>
                      {localizedCollections.map((collection, index) => (
                        <span key={collection.id}>
                          {index > 0 ? ", " : ""}
                          <Link href={`/collections/${collection.slug}`}>{collection.displayTitle}</Link>
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{locale === "cs" ? "Jazyk edice" : "Edition language"}</dt>
                  <dd>
                    <span className={isOriginalLanguageEdition ? "artales-edition-language-pill artales-edition-language-pill--original" : "artales-edition-language-pill"}>
                      {editionLanguage}
                    </span>
                  </dd>
                </div>
                {originalLanguage && !isOriginalLanguageEdition ? (
                  <div>
                    <dt>{locale === "cs" ? "Původní jazyk" : "Original language"}</dt>
                    <dd>{originalLanguage}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t.editionType}</dt>
                  <dd>{originLabel}</dd>
                </div>
              </dl>
            </div>
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
              {title}
            </h1>

            {subtitle ? (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "20px",
                  color: "#5f5247",
                }}
              >
                {subtitle}
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
              {summary}
            </p>

            {originalLanguageCode ? (
              <div className={isOriginalLanguageEdition ? "artales-edition-language-note artales-edition-language-note--original" : "artales-edition-language-note"}>
                <p className="artales-public-kicker artales-public-kicker--small">{languageVersionLabel}</p>
                <p>{languageVersionText}</p>
              </div>
            ) : null}

            {primaryCollection ? (
              <div style={{ display: "grid", gap: "12px", margin: "0 0 24px" }}>
                <p style={{ margin: 0, color: "#5f5247" }}>
                  {t.partOf}{" "}
                  {localizedCollections.map((collection, index) => (
                    <span key={collection.id}>
                      {index > 0 ? ", " : ""}
                      <Link href={`/collections/${collection.slug}`} style={{ color: "var(--artales-ink)", fontWeight: 800 }}>
                        {collection.displayTitle}
                      </Link>
                    </span>
                  ))}
                </p>
                {localizedTags.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {localizedTags.map((tag) => (
                      <span key={tag.id} style={{ padding: "6px 10px", borderRadius: "999px", background: "rgba(13, 21, 40, 0.08)", color: "#3f362f", fontSize: "14px" }}>
                        {tag.displayLabel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : localizedTags.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "0 0 24px" }}>
                {localizedTags.map((tag) => (
                  <span key={tag.id} style={{ padding: "6px 10px", borderRadius: "999px", background: "rgba(13, 21, 40, 0.08)", color: "#3f362f", fontSize: "14px" }}>
                    {tag.displayLabel}
                  </span>
                ))}
              </div>
            ) : null}

            <AccessStatusCard
              isSignedIn={isSignedIn}
              canReadFull={canReadFull}
              welcomeUnlockAvailable={welcomeUnlockAvailable}
              viewerRole={viewerRole}
              slug={work.slug}
              labels={t}
            />

            <div id="reader-actions">
              <ReaderWorkActions
                slug={work.slug}
                workId={workId}
                isSignedIn={isSignedIn}
                isSaved={isSaved}
                welcomeUnlockAvailable={welcomeUnlockAvailable}
                readPreviewLabel={t.readPreview}
                readOnlineLabel={t.readOnline}
                continueReadingLabel={t.continueReading}
                saveForLaterLabel={t.saveForLater}
                canReadFull={canReadFull}
              />
            </div>

            <ProductOptions products={products} canReadFull={canReadFull} slug={work.slug} labels={t} />

            {feedbackStatus === "sent" ? (
              <p className="artales-account-success" style={{ marginTop: "18px" }}>
                {t.feedbackSent}
              </p>
            ) : null}
            {feedbackStatus === "invalid" ? (
              <p className="artales-account-alert" style={{ marginTop: "18px" }}>
                {t.feedbackInvalid}
              </p>
            ) : null}
            {feedbackStatus === "error" ? (
              <p className="artales-account-alert" style={{ marginTop: "18px" }}>
                {t.feedbackError}
              </p>
            ) : null}

            <WorkFeedbackPanel workId={workId} slug={work.slug} isSignedIn={isSignedIn} labels={t} />
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
                  <dt style={{ fontWeight: 800 }}>{t.edition}</dt>
                  <dd style={{ margin: 0 }}>{work.edition_title}</dd>
                </>
              ) : null}

              {work.edition_version ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.version}</dt>
                  <dd style={{ margin: 0 }}>{work.edition_version}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{common.language}</dt>
              <dd style={{ margin: 0 }}>
                {editionLanguage}
              </dd>

              {work.original_language ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.originalLanguage}</dt>
                  <dd style={{ margin: 0 }}>{originalLanguage}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{t.editionType}</dt>
              <dd style={{ margin: 0 }}>{originLabel}</dd>

              {work.edition_publisher ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.publisherImprint}</dt>
                  <dd style={{ margin: 0 }}>{work.edition_publisher}</dd>
                </>
              ) : null}

              {work.publication_year ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.publicationYear}</dt>
                  <dd style={{ margin: 0 }}>{work.publication_year}</dd>
                </>
              ) : null}

              {work.edition_license ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.licenseRights}</dt>
                  <dd style={{ margin: 0 }}>{work.edition_license}</dd>
                </>
              ) : null}

              <dt style={{ fontWeight: 800 }}>{common.source}</dt>
              <dd style={{ margin: 0 }}>{sourceLabel}</dd>

              {work.edition_source_url ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.sourceUrl}</dt>
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
                  <dt style={{ fontWeight: 800 }}>{t.contributors}</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {work.contributor_summary}
                  </dd>
                </>
              ) : null}

              {work.edition_note_public ? (
                <>
                  <dt style={{ fontWeight: 800 }}>{t.editionNote}</dt>
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
                  <dt style={{ fontWeight: 800 }}>{t.isbnStatus}</dt>
                  <dd style={{ margin: 0 }}>
                    {normalizeIsbnStatus(work.isbn_status, t)}
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

        {primaryCollection?.displayDescription ? (
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
            <p style={{ margin: "0 0 10px 0", color: "#3f362f", fontWeight: 700 }}>
              {primaryCollection.displayTitle}
            </p>
            <p style={{ margin: 0, color: "#3f362f" }}>
              {primaryCollection.displayDescription}
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
