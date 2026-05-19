"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isWorkSaved,
  loadReaderProgress,
  setWorkSaved,
} from "@/lib/reader/readerStorage";

type ReaderWorkActionsProps = {
  slug: string;
  readPreviewLabel: string;
  readOnlineLabel: string;
  continueReadingLabel: string;
  saveForLaterLabel: string;
  canReadFull: boolean;
};

export default function ReaderWorkActions({
  slug,
  readPreviewLabel,
  readOnlineLabel,
  continueReadingLabel,
  saveForLaterLabel,
  canReadFull,
}: ReaderWorkActionsProps) {
  const [hasProgress, setHasProgress] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const progress = loadReaderProgress(slug);
    setHasProgress(Boolean(progress && progress.scrollY > 0));
    setSaved(isWorkSaved(slug));
  }, [slug]);

  function toggleSaved() {
    if (!canReadFull) {
      window.location.href = `/login?error=register_required&next=${encodeURIComponent(`/work/${slug}`)}`;
      return;
    }

    const next = !saved;
    setWorkSaved(slug, next);
    setSaved(next);
  }

  return (
    <div className="artales-reader-work-actions">
      <Link className="artales-button" href={`/reader/${slug}?mode=preview`}>
        {readPreviewLabel}
      </Link>
      <Link
        className="artales-button-secondary"
        href={
          canReadFull
            ? `/reader/${slug}?mode=full`
            : `/login?error=register_required&next=${encodeURIComponent(`/reader/${slug}?mode=full`)}`
        }
      >
        {readOnlineLabel}
      </Link>
      {hasProgress ? (
        <Link
          className="artales-button-secondary"
          href={
            canReadFull
              ? `/reader/${slug}?mode=full`
              : `/login?error=register_required&next=${encodeURIComponent(`/reader/${slug}?mode=full`)}`
          }
        >
          {continueReadingLabel}
        </Link>
      ) : null}
      <button
        type="button"
        className="artales-button-secondary"
        onClick={toggleSaved}
      >
        {saved ? "Saved" : saveForLaterLabel}
      </button>
    </div>
  );
}
