import { followAuthorAction, unfollowAuthorAction } from "@/app/author/[slug]/actions";

type AuthorFollowLabels = {
  authorFollowEyebrow: string;
  authorFollowTitleOn: string;
  authorFollowTitleOff: string;
  authorFollowText: string;
  followAuthor: string;
  unfollowAuthor: string;
  signInToFollow: string;
};

export default function AuthorFollowPanel({
  authorId,
  slug,
  isSignedIn,
  isFollowing,
  labels,
}: {
  authorId: string;
  slug: string;
  isSignedIn: boolean;
  isFollowing: boolean;
  labels: AuthorFollowLabels;
}) {
  return (
    <section className="artales-community-card artales-community-card--compact">
      <p className="artales-community-card__eyebrow">{labels.authorFollowEyebrow}</p>
      <h2>{isFollowing ? labels.authorFollowTitleOn : labels.authorFollowTitleOff}</h2>
      <p>{labels.authorFollowText}</p>
      {isSignedIn ? (
        isFollowing ? (
          <form action={unfollowAuthorAction}>
            <input type="hidden" name="author_id" value={authorId} />
            <input type="hidden" name="slug" value={slug} />
            <button className="artales-button-secondary" type="submit">
              {labels.unfollowAuthor}
            </button>
          </form>
        ) : (
          <form action={followAuthorAction}>
            <input type="hidden" name="author_id" value={authorId} />
            <input type="hidden" name="slug" value={slug} />
            <button className="artales-button" type="submit">
              {labels.followAuthor}
            </button>
          </form>
        )
      ) : (
        <a className="artales-button-secondary" href={`/login?next=/author/${slug}`}>
          {labels.signInToFollow}
        </a>
      )}
    </section>
  );
}
