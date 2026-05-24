import Link from "next/link";
import { reviewSubmission } from "@/lib/actions/submissions";
import { listMemberSubmissions } from "@/lib/dbSubmissions";
import { requireMemberZoneAccess } from "@/lib/guards";
import { canReviewSubmissions } from "@/lib/permissions";

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

function typeLabel(type: string) {
  switch (type) {
    case "correction":
      return "Oprava";
    case "image_asset":
      return "Obrázek / asset";
    case "source_note":
      return "Zdroj";
    case "transcription":
      return "Přepis";
    case "translation_note":
      return "Překladová poznámka";
    case "metadata_suggestion":
      return "Metadata";
    default:
      return "Jiné";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "přijato";
    case "rejected":
      return "zamítnuto";
    case "needs_changes":
      return "vráceno k úpravě";
    case "in_review":
      return "v kontrole";
    case "archived":
      return "archivováno";
    default:
      return "odesláno";
  }
}

export default async function SubmissionsPage({ searchParams }: PageProps) {
  const profile = await requireMemberZoneAccess();
  const canReview = canReviewSubmissions(profile);
  const submissions = await listMemberSubmissions(profile);
  const { error, success } = await searchParams;

  return (
    <main
      style={{ padding: "42px 32px", maxWidth: "1100px", margin: "0 auto" }}
    >
      <p
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#8a6a2d",
          fontWeight: 800,
        }}
      >
        ARTales · pracovní tok
      </p>
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "44px",
          margin: "0 0 12px",
        }}
      >
        Příspěvky / návrhy práce
      </h1>
      <p style={{ maxWidth: "760px", color: "#5f5247" }}>
        Tady se sbírají pracovní příspěvky a jejich systémové stopy. Člen odešle
        podklad, editor jej přijme, vrátí k úpravě nebo zamítne. Každý krok má být
        později zapisován automaticky pro tiráž, contributor vrstvu a přínosový ledger.
      </p>

      <section className="artales-member-panel" style={{ padding: "16px", marginTop: "18px" }}>
        <strong>Směr systému:</strong> ručně se zadává jen obsah a rozhodnutí. Záznamy o tom,
        kdo co odeslal, zkontroloval, vrátil nebo publikoval, mají vznikat automaticky.
      </section>

      <p style={{ marginTop: "20px" }}>
        <Link className="artales-button" href="/member/submissions/new">
          Přidat příspěvek
        </Link>
      </p>

      {error ? (
        <p
          className="artales-member-panel"
          style={{ padding: "12px 14px", color: "#7b1d1d" }}
        >
          Akce se nepodařila. Zkontroluj údaje a zkus to znovu.
        </p>
      ) : null}
      {success ? (
        <p
          className="artales-member-panel"
          style={{ padding: "12px 14px", color: "#22602f" }}
        >
          Změna byla uložena.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: "14px", marginTop: "28px" }}>
        {submissions.map((item) => (
          <article
            key={item.id}
            className="artales-member-card"
            style={{ padding: "18px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ maxWidth: "720px" }}>
                <p
                  style={{
                    margin: "0 0 6px",
                    color: "#8a6a2d",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    fontSize: 12,
                  }}
                >
                  {typeLabel(item.type)} · {statusLabel(item.status)}
                </p>
                <h2
                  style={{
                    margin: "0 0 8px",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  {item.title}
                </h2>
                <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>
                {item.file_note ? (
                  <p>
                    <strong>Soubor/poznámka:</strong> {item.file_note}
                  </p>
                ) : null}
                <p style={{ color: "#5f5247", fontSize: 14 }}>
                  Systémový záznam: odesláno {new Date(item.created_at).toLocaleString("cs-CZ")}
                </p>
                {item.review_note ? (
                  <p
                    style={{
                      padding: "10px 12px",
                      background: "#fff8e8",
                      border: "1px solid rgba(13,21,40,.12)",
                    }}
                  >
                    <strong>Kontrola:</strong> {item.review_note}
                  </p>
                ) : null}
              </div>

              {canReview ? (
                <form
                  action={reviewSubmission.bind(null, item.id)}
                  style={{ minWidth: 240, display: "grid", gap: 8 }}
                >
                  <label>
                    <strong>Stav</strong>
                    <select
                      name="status"
                      defaultValue={item.status}
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: 6,
                        padding: "10px",
                      }}
                    >
                      <option value="in_review">v kontrole</option>
                      <option value="accepted">přijato</option>
                      <option value="needs_changes">vrátit k úpravě</option>
                      <option value="rejected">zamítnout</option>
                      <option value="archived">archivovat</option>
                    </select>
                  </label>
                  <label>
                    <strong>Poznámka</strong>
                    <textarea
                      name="review_note"
                      rows={3}
                      defaultValue={item.review_note ?? ""}
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: 6,
                        padding: "10px",
                      }}
                    />
                  </label>
                  <button type="submit" className="artales-button-secondary">
                    Uložit rozhodnutí
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
        {submissions.length === 0 ? (
          <p>Zatím tu nejsou žádné příspěvky. Jakmile člen odešle práci ke kontrole, objeví se zde.</p>
        ) : null}
      </section>
    </main>
  );
}
