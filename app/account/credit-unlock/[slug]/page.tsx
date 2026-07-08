import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getWorkBySlug } from "@/lib/dbWorks";
import { canOpenFullReader } from "@/lib/entitlements";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { normalizeRole } from "@/lib/permissions";
import { pickLocalizedText } from "@/lib/localizedContent";
import { getReaderMembershipStatus } from "@/lib/readerMembership";
import { useAtCreditOnlineUnlock, useMemberOnlineUnlock } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNotice(error: string | undefined, labels: ReturnType<typeof getPublicDictionary>["account"]["creditUnlock"]) {
  if (!error) return null;
  if (error === "not_enough_member_unlocks") return labels.notEnoughMemberUnlocksNotice;
  if (error === "not_enough_credit") return labels.notEnoughCreditNotice;
  if (error === "already_unlocked") return labels.alreadyUnlockedNotice;
  return labels.failedNotice;
}

export default async function CreditUnlockPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await requireCompletedAccountProfile(`/account/credit-unlock/${slug}`);
  const [work, cookieLocale, membershipStatus] = await Promise.all([
    getWorkBySlug(slug),
    getCookieLocale(),
    getReaderMembershipStatus(profile.id),
  ]);

  if (!work) notFound();

  const locale = resolveProfileLocale(profile, cookieLocale);
  const labels = getPublicDictionary(locale).account.creditUnlock;
  const displayTitle = pickLocalizedText(locale, {
    cs: work.title_cs,
    en: work.title_en,
    fallback: work.title,
  }) ?? work.title;
  const displaySummary = pickLocalizedText(locale, {
    cs: work.summary_cs,
    en: work.summary_en,
    fallback: work.summary,
  }) ?? work.summary;
  const displayAuthor = work.author
    ? pickLocalizedText(locale, {
        cs: work.author.name_cs ?? null,
        en: work.author.name_en ?? null,
        fallback: work.author.name,
      }) ?? work.author.name
    : null;
  const role = normalizeRole(profile.role);
  const canReadFull = await canOpenFullReader(profile, work.id);

  if (canReadFull) {
    redirect(`/reader/${work.slug}?mode=full`);
  }

  const error = firstParam(resolvedSearchParams.error);
  const notice = getNotice(error, labels);
  const hasMemberUnlock = membershipStatus.memberUnlockBalance > 0;
  const hasAtCredit = membershipStatus.creditBalance >= 1;

  return (
    <section className="artales-account-page">
      <p className="artales-account-kicker">{labels.kicker}</p>
      <h1>{labels.title}</h1>
      <p className="artales-account-lede">{labels.lede}</p>

      {notice ? (
        <div className="artales-account-notice artales-account-notice--error">
          {notice}
        </div>
      ) : null}

      <section className="artales-account-panel">
        <p className="artales-account-card__label">{labels.selectedWorkLabel}</p>
        <h2>{displayTitle}</h2>
        <p>{displayAuthor ?? labels.unknownAuthor}</p>
        {displaySummary ? <p>{displaySummary}</p> : null}
      </section>

      {role !== "reader" ? (
        <section className="artales-account-panel">
          <p className="artales-account-card__label">{labels.internalLabel}</p>
          <h2>{labels.internalTitle}</h2>
          <p>{labels.internalText}</p>
          <Link className="artales-button" href={`/reader/${work.slug}?mode=full`}>
            {labels.openFullReader}
          </Link>
        </section>
      ) : (
        <div className="artales-account-tier-grid">
          <section className="artales-account-card artales-account-tier-card">
            <p className="artales-account-card__label">{labels.memberUnlockLabel}</p>
            <h2>{labels.memberUnlockTitle}</h2>
            <p>{labels.memberUnlockText}</p>
            <p className="artales-account-muted">
              {labels.memberUnlockBalanceLabel}: <strong>{membershipStatus.memberUnlockBalance}</strong>
            </p>
            <form action={useMemberOnlineUnlock} className="artales-membership-activation-form">
              <input type="hidden" name="slug" value={work.slug} />
              <input type="hidden" name="work_id" value={work.id} />
              <button className="artales-button" type="submit" disabled={!hasMemberUnlock}>
                {labels.memberUnlockCta}
              </button>
            </form>
            {!hasMemberUnlock ? <p className="artales-account-muted">{labels.memberUnlockUnavailable}</p> : null}
          </section>

          <section className="artales-account-card artales-account-tier-card">
            <p className="artales-account-card__label">{labels.priceLabel}</p>
            <h2>{labels.atCreditTitle}</h2>
            <p>{labels.atCreditText}</p>
            <p className="artales-account-muted">
              {labels.balanceLabel}: <strong>{membershipStatus.creditBalance} {labels.creditUnit}</strong>
            </p>
            <form action={useAtCreditOnlineUnlock} className="artales-membership-activation-form">
              <input type="hidden" name="slug" value={work.slug} />
              <input type="hidden" name="work_id" value={work.id} />
              <button className="artales-button-secondary" type="submit" disabled={!hasAtCredit}>
                {labels.confirmCta}
              </button>
            </form>
            {!hasAtCredit ? (
              <div className="artales-account-actions artales-account-actions--inline">
                <Link className="artales-button-secondary" href="/checkout/credits">
                  {labels.topUpCta}
                </Link>
                <Link className="artales-button-secondary" href="/credits">
                  {labels.learnCreditsCta}
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      )}

      <div className="artales-account-actions">
        <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
          {labels.backToWork}
        </Link>
        <Link className="artales-button-secondary" href="/account/membership">
          {labels.viewMembershipCta}
        </Link>
      </div>
    </section>
  );
}
