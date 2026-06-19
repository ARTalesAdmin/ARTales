import Link from "next/link";
import { requireEditorOrAdmin } from "@/lib/guards";
import { getTagsForMember, groupTagsByType, getTagLabel } from "@/lib/dbTags";

export default async function MemberTagsPage() {
  await requireEditorOrAdmin();
  const tags = await getTagsForMember();
  const groups = groupTagsByType(tags);

  return (
    <main style={{ padding: "48px 32px", fontFamily: "serif", lineHeight: 1.6, maxWidth: "1120px", margin: "0 auto" }}>
      <p style={{ marginBottom: "20px" }}>
        <Link href="/member">{"<- Zpět do členské zóny"}</Link>
      </p>

      <section style={{ marginBottom: "28px" }}>
        <p style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.7, marginBottom: "10px" }}>
          ARTales · Editor
        </p>
        <h1 style={{ fontSize: "40px", lineHeight: 1.1, marginTop: 0, marginBottom: "14px" }}>Tagy</h1>
        <p style={{ maxWidth: "760px", marginBottom: "18px" }}>
          Technická vrstva pro vyhledávání, filtrování a vícenásobné zařazení děl napříč kolekcemi.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/member/tags/new" style={{ padding: "10px 14px", border: "1px solid #111", textDecoration: "none", color: "#111", fontWeight: 600 }}>
            Nový tag
          </Link>
        </div>
      </section>

      {groups.length === 0 ? (
        <p>Zatím neexistují žádné tagy.</p>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          {groups.map((group) => (
            <section key={group.type} style={{ border: "1px solid rgba(13, 21, 40, 0.14)", borderRadius: "20px", padding: "20px", background: "#fffdf8" }}>
              <h2 style={{ margin: "0 0 14px 0", fontSize: "24px" }}>{group.label}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                {group.items.map((tag) => (
                  <article key={tag.id} style={{ border: "1px solid rgba(13,21,40,0.12)", borderRadius: "16px", padding: "16px", background: "#fff" }}>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "20px" }}>{getTagLabel(tag, "cs")}</h3>
                    <p style={{ margin: "0 0 6px 0", opacity: 0.72 }}><strong>EN:</strong> {tag.label_en ?? "—"}</p>
                    <p style={{ margin: "0 0 6px 0", opacity: 0.72 }}><strong>Slug:</strong> {tag.slug}</p>
                    <p style={{ margin: "0 0 10px 0", opacity: 0.72 }}><strong>Veřejný:</strong> {tag.is_public_visible ? "ano" : "ne"}</p>
                    <p style={{ margin: "0 0 12px 0", minHeight: "2.8em", opacity: 0.82 }}>{tag.description_cs ?? tag.description_en ?? "Bez popisu."}</p>
                    <Link href={`/member/tags/${tag.slug}/edit`} style={{ textDecoration: "none", fontWeight: 600 }}>Editovat</Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
