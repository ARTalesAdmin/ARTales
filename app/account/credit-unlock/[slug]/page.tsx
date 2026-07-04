import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCompletedAccountProfile } from "@/lib/account";
import { getWorkBySlug } from "@/lib/dbWorks";
import {
  ONLINE_READ_CREDIT_COST,
  canOpenFullReader,
  getAtCreditBalance,
} from "@/lib/entitlements";
import { getPublicDictionary } from "@/lib/i18n/public";
import { getCookieLocale, resolveProfileLocale } from "@/lib/i18n/server";
import { normalizeRole } from "@/lib/permissions";
import { unlockWithCredit } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreditUnlockPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [profile, work, cookieLocale] = await Promise.all([
    requireCompletedAccountProfile(`/account/credit-unlock/${slug}`),
    getWorkBySlug(slug),
    getCookieLocale(),
  ]);

  if (!work) notFound();

  const locale = resolveProfileLocale(profile, cookieLocale);
  const labels = getPublicDictionary(locale).account.creditUnlock;
  const role = normalizeRole(profile.role);
  const canReadFull = await canOpenFullReader(profile, work.id);

  if (canReadFull) {
    redirect(`/reader/${work.slug}?mode=full`);
  }

  if (role !== "reader") {
    redirect(`/reader/${work.slug}?mode=full`);
  }

  const [balance, error] = await Promise.all([
    getAtCreditBalance(profile.id),
    Promise.resolve(firstParam(resolvedSearchParams.error)),
  ]);
  const hasEnoughCredit = balance >= ONLINE_READ_CREDIT_COST;

  return (
    <section className="artales-account-page artales-credit-unlock-page">
      <p className="artales-account-kicker">{labels.kicker}</p>
      <h1>{labels.title}</h1>
      <p className="artales-account-lede">{labels.lede}</p>

      {error === "not_enough_credit" ? (
        <div className="artales-account-notice artales-account-notice--error">
          {labels.notEnoughCreditNotice}
        </div>
      ) : null}

      {error === "credit_unlock_failed" ? (
        <div className="artales-account-notice artales-account-notice--error">
          {labels.failedNotice}
        </div>
      ) : null}

      <section className="artales-account-promo-panel artales-credit-unlock-hero">
        <div>
          <p className="artales-account-card__label">{labels.selectedWorkLabel}</p>
          <h2>{work.title}</h2>
          <p>{work.author?.name ?? labels.unknownAuthor}</p>
          {work.summary ? <p>{work.summary}</p> : null}
        </div>
        <div className="artales-credit-unlock-cost-card">
          <p className="artales-account-card__label">{labels.priceLabel}</p>
          <strong>{ONLINE_READ_CREDIT_COST} {labels.creditUnit}</strong>
          <span>{labels.balanceLabel}: {balance} {labels.creditUnit}</span>
        </div>
      </section>

      <section className="artales-account-panel artales-credit-unlock-decision">
        {hasEnoughCredit ? (
          <>
            <p className="artales-account-card__label">{labels.confirmLabel}</p>
            <h2>{labels.confirmTitle}</h2>
            <p>{labels.confirmText}</p>
            <form action={unlockWithCredit} className="artales-account-actions">
              <input type="hidden" name="slug" value={work.slug} />
              <input type="hidden" name="work_id" value={work.id} />
              <button className="artales-button" type="submit">
                {labels.confirmCta}
              </button>
              <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                {labels.backToWork}
              </Link>
            </form>
          </>
        ) : (
          <>
            <p className="artales-account-card__label">{labels.topUpLabel}</p>
            <h2>{labels.topUpTitle}</h2>
            <p>{labels.topUpText}</p>
            <div className="artales-account-actions">
              <Link className="artales-button" href={`/checkout/credits?next=${encodeURIComponent(`/account/credit-unlock/${work.slug}`)}`}>
                {labels.topUpCta}
              </Link>
              <Link className="artales-button-secondary" href="/credits">
                {labels.learnCreditsCta}
              </Link>
              <Link className="artales-button-secondary" href={`/work/${work.slug}`}>
                {labels.backToWork}
              </Link>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
