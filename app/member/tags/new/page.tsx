import Link from "next/link";
import { requireEditorOrAdmin } from "@/lib/guards";
import { createTag } from "@/lib/actions/tags";
import { getDefaultTagFormValues } from "@/lib/forms/tagForm";
import { TAG_TYPE_OPTIONS } from "@/lib/tagTypes";
import { getTagsForMember } from "@/lib/dbTags";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "label_cs_missing": return "Český název tagu je povinný.";
    case "slug_missing": return "Slug je povinný.";
    case "slug_invalid": return "Slug může obsahovat jen malá písmena, čísla a pomlčky.";
    case "type_invalid": return "Typ tagu není platný.";
    case "sort_order_invalid": return "Pořadí musí být číslo.";
    case "slug_taken": return "Tento slug už existuje.";
    case "save_failed": return "Tag se nepodařilo uložit.";
    default: return null;
  }
}

export default async function NewTagPage({ searchParams }: PageProps) {
  await requireEditorOrAdmin();
  const defaults = getDefaultTagFormValues();
  const { error } = await searchParams;
  const errorMessage = getErrorMessage(error);
  const tags = await getTagsForMember();

  return (
    <main style={{ padding: "48px 32px", fontFamily: "serif", lineHeight: 1.6, maxWidth: "900px", margin: "0 auto" }}>
      <p style={{ marginBottom: "20px" }}><Link href="/member/tags">{"<- Zpět na tagy"}</Link></p>
      <h1 style={{ fontSize: "40px", lineHeight: 1.1, marginTop: 0, marginBottom: "20px" }}>Nový tag</h1>
      {errorMessage ? <p style={{ marginBottom: "18px", padding: "12px 14px", border: "1px solid #d99", background: "#fff7f7" }}>{errorMessage}</p> : null}
      <TagForm defaults={defaults} action={createTag} tags={tags} submitLabel="Uložit tag" />
    </main>
  );
}

function TagForm({ defaults, action, tags, submitLabel }: any) {
  return (
    <form action={action} style={{ display: "grid", gap: "22px" }}>
      <section style={{ border: "1px solid #ddd", padding: "24px", display: "grid", gap: "18px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field id="label_cs" label="Název (CZ)" defaultValue={defaults.label_cs} required />
          <Field id="label_en" label="Název (EN)" defaultValue={defaults.label_en} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px", gap: "16px" }}>
          <Field id="slug" label="Slug" defaultValue={defaults.slug} />
          <div>
            <label htmlFor="type" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Typ</label>
            <select id="type" name="type" defaultValue={defaults.type} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }}>
              {TAG_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <Field id="sort_order" label="Pořadí" defaultValue={defaults.sort_order} />
        </div>
        <div>
          <label htmlFor="canonical_tag_id" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Kanonicý / mateřský tag</label>
          <select id="canonical_tag_id" name="canonical_tag_id" defaultValue={defaults.canonical_tag_id} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }}>
            <option value="">— Bez návaznosti —</option>
            {tags.map((tag: any) => <option key={tag.id} value={tag.id}>{tag.label_cs}</option>)}
          </select>
        </div>
        <TextArea id="description_cs" label="Popis (CZ)" defaultValue={defaults.description_cs} />
        <TextArea id="description_en" label="Popis (EN)" defaultValue={defaults.description_en} />
        <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}>
          <input type="checkbox" name="is_public_visible" defaultChecked={defaults.is_public_visible} /> Tag je veřejně viditelný
        </label>
      </section>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="submit" style={{ padding: "12px 18px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}>{submitLabel}</button>
        <Link href="/member/tags" style={{ padding: "12px 18px", border: "1px solid #ccc", textDecoration: "none", color: "#111" }}>Zrušit</Link>
      </div>
    </form>
  )
}

function Field({ id, label, defaultValue, required = false }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><input id={id} name={id} type="text" required={required} defaultValue={defaultValue} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }} /></div>
}

function TextArea({ id, label, defaultValue }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><textarea id={id} name={id} defaultValue={defaultValue} rows={4} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px", resize: "vertical" }} /></div>
}
