import { submitWorkFeedback } from "@/app/work/[slug]/actions";

export default function WorkFeedbackPanel({
  workId,
  slug,
  isSignedIn,
}: {
  workId: string;
  slug: string;
  isSignedIn: boolean;
}) {
  return (
    <section className="artales-community-card artales-community-card--feedback">
      <p className="artales-community-card__eyebrow">Reader signal</p>
      <h2>Help ARTales process this work</h2>
      <p>
        Send a private signal to the ARTales editorial layer: correction, source issue, translation note,
        formatting problem, reader response or community contribution idea. This is not a public comment thread.
      </p>
      <p>
        Useful signals may later become part of the ARTales community processor: corrections, translation work,
        learning, contributor reputation, credits and future editorial roles.
      </p>

      {isSignedIn ? (
        <form action={submitWorkFeedback} className="artales-community-form">
          <input type="hidden" name="work_id" value={workId} />
          <input type="hidden" name="slug" value={slug} />
          <label>
            <span>Signal type</span>
            <select name="feedback_type" defaultValue="general">
              <option value="general">Reader signal</option>
              <option value="correction">Correction / typo</option>
              <option value="translation">Translation suggestion</option>
              <option value="formatting">Formatting / reader issue</option>
              <option value="rights">Rights / source note</option>
              <option value="comment">Private editorial note</option>
            </select>
          </label>
          <label>
            <span>Note</span>
            <textarea
              name="body"
              minLength={3}
              maxLength={4000}
              rows={5}
              placeholder="Write a private ARTales signal. It will be reviewed by the editorial layer before anything reaches an author or wider community."
              required
            />
          </label>
          <button className="artales-button" type="submit">
            Send signal
          </button>
        </form>
      ) : (
        <a className="artales-button-secondary" href={`/login?next=/work/${slug}`}>
          Sign in to send a signal
        </a>
      )}
    </section>
  );
}
