import Link from "next/link";
import { createSubmission } from "@/lib/actions/submissions";
import { requireMemberZoneAccess } from "@/lib/guards";

export default async function NewSubmissionPage() {
  await requireMemberZoneAccess();

  return (
    <main style={{ padding: "42px 32px", maxWidth: "860px", margin: "0 auto" }}>
      <p>
        <Link href="/member/submissions">← Zpět na příspěvky</Link>
      </p>
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
        Nový příspěvek / návrh
      </h1>
      <p style={{ color: "#5f5247" }}>
        Popiš práci, soubor nebo návrh. Editor/admin ho zkontroluje a výsledek
        se uloží do auditní stopy.
      </p>

      <form
        action={createSubmission}
        className="artales-member-panel"
        style={{
          padding: "22px",
          display: "grid",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <label>
          <strong>Typ</strong>
          <select
            name="type"
            required
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "12px 14px",
            }}
          >
            <option value="correction">Oprava</option>
            <option value="image_asset">Obrázek / asset</option>
            <option value="source_note">Zdroj</option>
            <option value="transcription">Přepis</option>
            <option value="translation_note">Překladová poznámka</option>
            <option value="metadata_suggestion">Metadata</option>
            <option value="other">Jiné</option>
          </select>
        </label>

        <label>
          <strong>Název</strong>
          <input
            name="title"
            type="text"
            required
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "12px 14px",
            }}
          />
        </label>

        <label>
          <strong>Popis</strong>
          <textarea
            name="description"
            rows={7}
            required
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "12px 14px",
            }}
          />
        </label>

        <label>
          <strong>Název souboru / poznámka ke složce</strong>
          <input
            name="file_note"
            type="text"
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: "12px 14px",
            }}
          />
          <span
            style={{
              display: "block",
              marginTop: 8,
              color: "#5f5247",
              fontSize: 14,
            }}
          >
            Pokud jde o obrázek nebo podklad, nahraj ho do domluvené složky a
            sem napiš stejný název souboru.
          </span>
        </label>

        <button
          type="submit"
          className="artales-button"
          style={{ width: "fit-content" }}
        >
          Odeslat příspěvek
        </button>
      </form>
    </main>
  );
}
