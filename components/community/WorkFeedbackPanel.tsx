import { submitWorkFeedback } from "@/app/work/[slug]/actions";

type WorkFeedbackLabels = {
  readerSignalEyebrow: string;
  readerSignalTitle: string;
  readerSignalText: string;
  readerSignalCommunityText: string;
  signalType: string;
  signalTypeGeneral: string;
  signalTypeCorrection: string;
  signalTypeTranslation: string;
  signalTypeFormatting: string;
  signalTypeRights: string;
  signalTypeComment: string;
  signalNote: string;
  signalPlaceholder: string;
  sendSignal: string;
  signInToSendSignal: string;
};

export default function WorkFeedbackPanel({
  workId,
  slug,
  isSignedIn,
  labels,
}: {
  workId: string;
  slug: string;
  isSignedIn: boolean;
  labels: WorkFeedbackLabels;
}) {
  return (
    <section className="artales-community-card artales-community-card--feedback">
      <p className="artales-community-card__eyebrow">{labels.readerSignalEyebrow}</p>
      <h2>{labels.readerSignalTitle}</h2>
      <p>{labels.readerSignalText}</p>
      <p>{labels.readerSignalCommunityText}</p>

      {isSignedIn ? (
        <form action={submitWorkFeedback} className="artales-community-form">
          <input type="hidden" name="work_id" value={workId} />
          <input type="hidden" name="slug" value={slug} />
          <label>
            <span>{labels.signalType}</span>
            <select name="feedback_type" defaultValue="general">
              <option value="general">{labels.signalTypeGeneral}</option>
              <option value="correction">{labels.signalTypeCorrection}</option>
              <option value="translation">{labels.signalTypeTranslation}</option>
              <option value="formatting">{labels.signalTypeFormatting}</option>
              <option value="rights">{labels.signalTypeRights}</option>
              <option value="comment">{labels.signalTypeComment}</option>
            </select>
          </label>
          <label>
            <span>{labels.signalNote}</span>
            <textarea
              name="body"
              minLength={3}
              maxLength={4000}
              rows={5}
              placeholder={labels.signalPlaceholder}
              required
            />
          </label>
          <button className="artales-button" type="submit">
            {labels.sendSignal}
          </button>
        </form>
      ) : (
        <a className="artales-button-secondary" href={`/login?next=/work/${slug}`}>
          {labels.signInToSendSignal}
        </a>
      )}
    </section>
  );
}
