import Link from "next/link";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getReaderCommerceSummary, type ReaderManualQrPaymentItem, type ReaderCreditLedgerItem } from "@/lib/readerCommerce";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { giftCreditToArtales } from "./actions";
import { getPatronageProgress, formatPatronageLevel } from "@/lib/patronage";

export const dynamic = "force-dynamic";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "cs" ? "cs-CZ" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getPaymentState(payment: ReaderManualQrPaymentItem, dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"]) {
  if (["cancelled", "refunded"].includes(payment.status) || ["failed", "refunded"].includes(payment.paymentStatus)) {
    return {
      label: dictionary.paymentStates.cancelled,
      className: "artales-credit-status artales-credit-status--muted",
      text: payment.status === "refunded" ? dictionary.paymentStateTexts.refunded : dictionary.paymentStateTexts.cancelled,
    };
  }

  if (payment.status === "fulfilled" || payment.fulfillmentStatus === "fulfilled") {
    return {
      label: dictionary.paymentStates.fulfilled,
      className: "artales-credit-status artales-credit-status--success",
      text: payment.checkoutKind === "support"
        ? dictionary.paymentStateTexts.supportAccepted
        : dictionary.paymentStateTexts.creditAdded,
    };
  }

  if (payment.paymentStatus === "paid") {
    return {
      label: dictionary.paymentStates.paid,
      className: "artales-credit-status artales-credit-status--success",
      text: dictionary.paymentStateTexts.paidWaitingFulfillment,
    };
  }

  return {
    label: dictionary.paymentStates.pending,
    className: "artales-credit-status artales-credit-status--pending",
    text: dictionary.paymentStateTexts.pending,
  };
}

function getPaymentKindLabel(payment: ReaderManualQrPaymentItem, dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"]) {
  if (payment.checkoutKind === "support") return dictionary.paymentKinds.support;
  if (payment.checkoutKind === "credit_topup") return dictionary.paymentKinds.creditTopup;
  return dictionary.paymentKinds.other;
}

function getLedgerSourceLabel(source: string, dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"]) {
  if (source in dictionary.ledgerSources) {
    return dictionary.ledgerSources[source as keyof typeof dictionary.ledgerSources];
  }
  return dictionary.ledgerSources.unknown;
}

function getLedgerNoteLabel(note: string | null | undefined, dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"]) {
  if (!note) return null;

  if (note === "Online reading unlocked with AT Credit.") {
    return dictionary.ledgerNotes.onlineReadUnlock;
  }

  const topupPrefix = "Manual QR credit top-up for order ";
  if (note.startsWith(topupPrefix)) {
    return `${dictionary.ledgerNotes.manualQrTopupPrefix} ${note.slice(topupPrefix.length)}`;
  }

  const reversalPrefix = "Manual QR credit reversal for order ";
  if (note.startsWith(reversalPrefix)) {
    return `${dictionary.ledgerNotes.manualQrReversalPrefix} ${note.slice(reversalPrefix.length)}`;
  }

  const membershipPrefix = "Membership activation: ";
  if (note.startsWith(membershipPrefix)) {
    return `${dictionary.ledgerNotes.membershipActivationPrefix}: ${note.slice(membershipPrefix.length)}`;
  }

  return note;
}

function PaymentCard({
  payment,
  locale,
  dictionary,
}: {
  payment: ReaderManualQrPaymentItem;
  locale: string;
  dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"];
}) {
  const state = getPaymentState(payment, dictionary);
  const isActive = !["cancelled", "refunded", "fulfilled"].includes(payment.status) && payment.paymentStatus !== "paid";

  return (
    <article className="artales-credit-payment-card">
      <div className="artales-credit-payment-card__main">
        <div>
          <p className="artales-account-card__label">{getPaymentKindLabel(payment, dictionary)}</p>
          <h3>{payment.formattedAmount}</h3>
          <p className="artales-account-muted">
            {formatDate(payment.createdAt, locale)}
            {payment.creditAmount ? ` · ${payment.creditAmount} ${dictionary.creditUnit}` : ""}
          </p>
        </div>
        <span className={state.className}>{state.label}</span>
      </div>

      <p>{state.text}</p>

      <dl className="artales-credit-payment-meta">
        <div>
          <dt>{dictionary.variableSymbol}</dt>
          <dd>{payment.variableSymbol ?? dictionary.notAvailable}</dd>
        </div>
        <div>
          <dt>{dictionary.country}</dt>
          <dd>{payment.billingCountry ?? dictionary.notAvailable}</dd>
        </div>
        <div>
          <dt>{dictionary.paymentRail}</dt>
          <dd>{payment.paymentRail === "cz_domestic_qr" ? dictionary.paymentRails.cz : dictionary.paymentRails.sepa}</dd>
        </div>
      </dl>

      {isActive ? (
        <Link className="artales-button-secondary" href={`/checkout/qr?order=${encodeURIComponent(payment.id)}`}>
          {dictionary.openPaymentInstruction}
        </Link>
      ) : null}
    </article>
  );
}

function LedgerRow({
  item,
  locale,
  dictionary,
}: {
  item: ReaderCreditLedgerItem;
  locale: string;
  dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"];
}) {
  const positive = item.amount >= 0;
  return (
    <article className="artales-credit-ledger-row">
      <div>
        <p className="artales-account-card__label">{getLedgerSourceLabel(item.source, dictionary)}</p>
        <h3>{positive ? "+" : ""}{item.amount} {dictionary.creditUnit}</h3>
        <p className="artales-account-muted">{formatDate(item.createdAt, locale)}</p>
      </div>
      <p>{getLedgerNoteLabel(item.note, dictionary) ?? (positive ? dictionary.ledgerFallbackPositive : dictionary.ledgerFallbackNegative)}</p>
    </article>
  );
}

function PatronagePanel({
  totalAt,
  locale,
  dictionary,
}: {
  totalAt: number;
  locale: string;
  dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"];
}) {
  const language = locale === "en" ? "en" : "cs";
  const progress = getPatronageProgress(totalAt);
  const levelLabel = formatPatronageLevel(progress.level, language);
  const nextLevelLabel = progress.nextLevel ? formatPatronageLevel(progress.nextLevel, language) : null;

  return (
    <section className="artales-account-panel artales-credit-section artales-patronage-panel" id="patronage">
      <div className="artales-patronage-panel__main">
        <div>
          <p className="artales-account-card__label">{dictionary.patronageLabel}</p>
          <h2>{dictionary.patronageTitle}</h2>
          <p>{dictionary.patronageText}</p>
        </div>
        <div className="artales-patronage-badge" aria-label={levelLabel}>
          <span>{progress.level === "mecenat" ? "✦" : progress.level === "patron" ? "◆" : "•"}</span>
          <strong>{levelLabel}</strong>
        </div>
      </div>

      <div className="artales-patronage-meter" aria-label={dictionary.patronageProgressAria}>
        <div className="artales-patronage-meter__head">
          <strong>{dictionary.patronageTotalLabel}: {progress.totalAt} AT</strong>
          {nextLevelLabel && progress.nextThresholdAt ? (
            <span>{dictionary.patronageRemainingPrefix} {progress.remainingAt} AT · {nextLevelLabel}</span>
          ) : (
            <span>{dictionary.patronageTopLevel}</span>
          )}
        </div>
        <div className="artales-patronage-meter__track">
          <span style={{ width: `${progress.progressPercent}%` }} />
        </div>
      </div>

      <div className="artales-patronage-mini-grid">
        {dictionary.patronageCards.map((card) => (
          <article key={card.title}>
            <p className="artales-account-card__label">{card.label}</p>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>

      <p className="artales-account-muted">{dictionary.patronageVisibilityText}</p>
      <div className="artales-account-actions artales-account-actions--compact">
        <Link className="artales-button-secondary" href="/hall">{dictionary.openHall}</Link>
      </div>
    </section>
  );
}

type PageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function getCreditNotice(params: { error?: string; success?: string }, dictionary: ReturnType<typeof getPublicDictionary>["account"]["credits"]) {
  if (params.success === "credit_gifted") return { kind: "success", text: dictionary.creditGiftSuccess };
  if (params.error === "not_enough_credit") return { kind: "error", text: dictionary.creditGiftNotEnough };
  if (params.error) return { kind: "error", text: dictionary.creditGiftError };
  return null;
}

export default async function AccountCreditsPage({ searchParams }: PageProps) {
  const profile = await requireCompletedAccountProfile("/account/credits");
  const [commerce, cookieLocale] = await Promise.all([
    getReaderCommerceSummary(profile.id),
    getCookieLocale(),
  ]);
  const locale = resolveProfileLocale(profile, cookieLocale);
  const dictionary = getPublicDictionary(locale).account.credits;
  const params = (await searchParams) ?? {};
  const notice = getCreditNotice(params, dictionary);
  const activePayments = commerce.payments.filter((payment) => !["cancelled", "refunded"].includes(payment.status)).slice(0, 8);
  const cancelledPayments = commerce.payments.filter((payment) => ["cancelled", "refunded"].includes(payment.status)).slice(0, 4);

  return (
    <section className="artales-account-page artales-credit-page">
      <p className="artales-account-kicker">{dictionary.kicker}</p>
      <h1>{dictionary.title}</h1>
      <p className="artales-account-lede">{dictionary.lede}</p>

      {notice ? (
        <div className={notice.kind === "success" ? "artales-account-notice artales-account-notice--success" : "artales-account-notice artales-account-notice--error"}>
          {notice.text}
        </div>
      ) : null}

      <section className="artales-account-promo-panel artales-credit-hero">
        <div>
          <p className="artales-account-card__label">{dictionary.balanceLabel}</p>
          <h2>{commerce.creditBalance} {dictionary.creditUnit}</h2>
          <p>{dictionary.balanceText}</p>
        </div>
        <div className="artales-credit-hero__actions">
          <Link className="artales-button" href="/checkout/credits">{dictionary.topUpCta}</Link>
          <a className="artales-button-secondary" href="#support">{dictionary.giftCta}</a>
        </div>
      </section>

      <PatronagePanel totalAt={commerce.patronageTotalAt} locale={locale} dictionary={dictionary} />

      <div className="artales-account-grid artales-credit-explainer-grid">
        {dictionary.explainerCards.map((card) => (
          <article className="artales-account-card" key={card.title}>
            <p className="artales-account-card__label">{card.label}</p>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </article>
        ))}
      </div>

      <section className="artales-account-panel artales-credit-section">
        <div className="artales-admin-dashboard__section-header">
          <div>
            <p className="artales-account-card__label">{dictionary.paymentsLabel}</p>
            <h2>{dictionary.paymentsTitle}</h2>
          </div>
          <Link className="artales-button-secondary" href="/checkout/credits">{dictionary.newPayment}</Link>
        </div>
        <p>{dictionary.paymentsText}</p>
        {activePayments.length > 0 ? (
          <div className="artales-credit-payment-grid">
            {activePayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} locale={locale} dictionary={dictionary} />
            ))}
          </div>
        ) : (
          <p className="artales-account-muted">{dictionary.noPayments}</p>
        )}
      </section>

      <section className="artales-account-panel artales-credit-section artales-credit-gift-panel" id="support">
        <div>
          <p className="artales-account-card__label">{dictionary.giftLabel}</p>
          <h2>{dictionary.giftTitle}</h2>
          <p>{dictionary.giftText}</p>
        </div>
        <form action={giftCreditToArtales} className="artales-credit-gift-form">
          <div className="artales-credit-gift-presets" aria-label={dictionary.giftAmountLabel}>
            {[1, 3, 5].map((amount) => (
              <button
                key={amount}
                className="artales-button-secondary"
                type="submit"
                name="amount"
                value={amount}
                disabled={commerce.creditBalance < amount}
              >
                {dictionary.giftPresetPrefix} {amount} AT
              </button>
            ))}
          </div>
          <label>
            {dictionary.giftAmountLabel}
            <input name="amount" type="number" min="1" max={Math.max(commerce.creditBalance, 1)} placeholder="1" />
          </label>
          <button className="artales-button" type="submit" disabled={commerce.creditBalance <= 0}>
            {dictionary.giftCustomCta}
          </button>
        </form>
      </section>

      <section className="artales-account-panel artales-credit-section">
        <p className="artales-account-card__label">{dictionary.ledgerLabel}</p>
        <h2>{dictionary.ledgerTitle}</h2>
        <p>{dictionary.ledgerText}</p>
        {commerce.creditLedger.length > 0 ? (
          <div className="artales-credit-ledger-list">
            {commerce.creditLedger.slice(0, 12).map((item) => (
              <LedgerRow key={item.id} item={item} locale={locale} dictionary={dictionary} />
            ))}
          </div>
        ) : (
          <p className="artales-account-muted">{dictionary.noLedger}</p>
        )}
      </section>

      {cancelledPayments.length > 0 ? (
        <section className="artales-account-panel artales-credit-section artales-credit-section--quiet">
          <p className="artales-account-card__label">{dictionary.cancelledLabel}</p>
          <h2>{dictionary.cancelledTitle}</h2>
          <p>{dictionary.cancelledText}</p>
          <details className="artales-credit-archive-scroll">
            <summary>{dictionary.showCancelled}</summary>
            <div className="artales-credit-payment-grid">
              {cancelledPayments.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} locale={locale} dictionary={dictionary} />
              ))}
            </div>
          </details>
        </section>
      ) : null}

      <div className="artales-account-actions">
        <Link className="artales-button" href="/gallery">{dictionary.browseGallery}</Link>
        <Link className="artales-button-secondary" href="/account/library">{dictionary.openLibrary}</Link>
      </div>
    </section>
  );
}
