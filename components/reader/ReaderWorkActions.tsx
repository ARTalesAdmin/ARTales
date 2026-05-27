"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setSavedWork } from "@/app/account/library/actions";
import {
  isWorkSaved,
  loadReaderProgress,
  setWorkSaved,
} from "@/lib/reader/readerStorage";

type ReaderWorkActionsProps = {
  slug: string;
  workId: string;
  isSignedIn: boolean;
  isSaved: boolean;
  welcomeUnlockAvailable: boolean;
  readPreviewLabel: string;
  readOnlineLabel: string;
  continueReadingLabel: string;
  saveForLaterLabel: string;
  canReadFull: boolean;
};

export default function ReaderWorkActions({
  slug,
  workId,
  isSignedIn,
  isSaved,
  welcomeUnlockAvailable,
  readPreviewLabel,
  readOnlineLabel,
  continueReadingLabel,
  saveForLaterLabel,
  canReadFull,
}: ReaderWorkActionsProps) {
  const [hasProgress, setHasProgress] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const progress = loadReaderProgress(slug);
    setHasProgress(Boolean(progress && progress.scrollY > 0));
    setSaved(isSignedIn ? isSaved : isWorkSaved(slug));
  }, [isSaved, isSignedIn, slug]);

  function toggleSaved() {
    const next = !saved;
    setSaved(next);

    if (!isSignedIn) {
      setWorkSaved(slug, next);
      return;
    }

    startTransition(async () => {
      try {
        await setSavedWork(workId, next);
      } catch (error) {
        console.error("Saved work update failed:", error);
        setSaved(!next);
      }
    });
  }

  const fullReaderHref = canReadFull ? `/reader/${slug}?mode=full` : "/account/membership";

  return (
    <div className="artales-reader-work-actions">
      <Link className="artales-button" href={`/reader/${slug}?mode=preview`}>
        {readPreviewLabel}
      </Link>
      <Link className="artales-button-secondary" href={fullReaderHref}>
        {readOnlineLabel}
      </Link>
      {welcomeUnlockAvailable ? (
        <Link className="artales-button-secondary artales-button-secondary--accent" href={`/account/unlock/${slug}`}>
          Use welcome unlock
        </Link>
      ) : null}
      {hasProgress ? (
        <Link className="artales-button-secondary" href={fullReaderHref}>
          {continueReadingLabel}
        </Link>
      ) : null}
      <button
        type="button"
        className="artales-button-secondary"
        onClick={toggleSaved}
        disabled={isPending}
      >
        {saved ? "Saved" : saveForLaterLabel}
      </button>
    </div>
  );
}
