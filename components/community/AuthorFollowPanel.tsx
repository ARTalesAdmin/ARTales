import { followAuthorAction, unfollowAuthorAction } from "@/app/author/[slug]/actions";

export default function AuthorFollowPanel({
  authorId,
  slug,
  isSignedIn,
  isFollowing,
}: {
  authorId: string;
  slug: string;
  isSignedIn: boolean;
  isFollowing: boolean;
}) {
  return (
    <section className="artales-community-card artales-community-card--compact">
      <p className="artales-community-card__eyebrow">Author updates</p>
      <h2>{isFollowing ? "You follow this author" : "Follow this author"}</h2>
      <p>
        Follow authors to prepare future release notifications, author dashboards and reader community signals.
      </p>
      {isSignedIn ? (
        isFollowing ? (
          <form action={unfollowAuthorAction}>
            <input type="hidden" name="author_id" value={authorId} />
            <input type="hidden" name="slug" value={slug} />
            <button className="artales-button-secondary" type="submit">
              Unfollow author
            </button>
          </form>
        ) : (
          <form action={followAuthorAction}>
            <input type="hidden" name="author_id" value={authorId} />
            <input type="hidden" name="slug" value={slug} />
            <button className="artales-button" type="submit">
              Follow author
            </button>
          </form>
        )
      ) : (
        <a className="artales-button-secondary" href={`/login?next=/author/${slug}`}>
          Sign in to follow
        </a>
      )}
    </section>
  );
}
