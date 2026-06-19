import Link from "next/link";
import { requireEditorOrAdmin } from "@/lib/guards";
import { createCollection } from "@/lib/actions/collections";
import { getDefaultCollectionFormValues } from "@/lib/forms/collectionForm";
import { COLLECTION_TYPE_OPTIONS } from "@/lib/collectionTypes";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "title_missing": return "Alespoň jeden název kolekce je povinný.";
    case "slug_missing": return "Slug je povinný.";
    case "slug_invalid": return "Slug může obsahovat jen malá písmena, čísla a pomlčky.";
    case "collection_type_invalid": return "Typ kolekce není platný.";
    case "sort_order_invalid": return "Pořadí musí být číslo.";
    case "slug_taken": return "Tento slug už existuje.";
    case "save_failed": return "Kolekci se nepodařilo uložit.";
    default: return null;
  }
}

export default async function NewCollectionPage({ searchParams }: PageProps) {
  await requireEditorOrAdmin();
  const defaults = getDefaultCollectionFormValues();
  const { error } = await searchParams;
  const errorMessage = getErrorMessage(error);

  return (
    <main style={{ padding: "48px 32px", fontFamily: "serif", lineHeight: 1.6, maxWidth: "1000px", margin: "0 auto" }}>
      <p style={{ marginBottom: "20px" }}><Link href="/member/collections">{"<- Zpět na kolekce"}</Link></p>
      <h1 style={{ fontSize: "40px", lineHeight: 1.1, marginTop: 0, marginBottom: "12px" }}>Nová kolekce</h1>
      <p style={{ maxWidth: "760px", marginBottom: "20px" }}>Kolekce jsou kurátorské literární galerie. Veřejně se zobrazují podle lokalizace, ale interně drží plnou bilingvní strukturu.</p>
      {errorMessage ? <p style={{ marginBottom: "18px", padding: "12px 14px", border: "1px solid #d99", background: "#fff7f7" }}>{errorMessage}</p> : null}
      <CollectionForm defaults={defaults} action={createCollection} submitLabel="Vytvořit kolekci" />
    </main>
  )
}

function CollectionForm({ defaults, action, submitLabel }: any) {
  return (
    <form action={action} style={{ display: "grid", gap: "22px" }}>
      <section style={{ border: "1px solid #ddd", padding: "24px", display: "grid", gap: "18px" }}>
        <h2 style={{ margin: 0, fontSize: "26px" }}>Základ kolekce</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field id="title_cs" label="Název (CZ)" defaultValue={defaults.title_cs} required />
          <Field id="title_en" label="Název (EN)" defaultValue={defaults.title_en} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field id="subtitle_cs" label="Podtitulek (CZ)" defaultValue={defaults.subtitle_cs} />
          <Field id="subtitle_en" label="Podtitulek (EN)" defaultValue={defaults.subtitle_en} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 180px", gap: "16px" }}>
          <Field id="slug" label="Slug" defaultValue={defaults.slug} />
          <div>
            <label htmlFor="collection_type" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Typ kolekce</label>
            <select id="collection_type" name="collection_type" defaultValue={defaults.collection_type} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }}>
              {COLLECTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <Field id="sort_order" label="Pořadí" defaultValue={defaults.sort_order} />
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", padding: "24px", display: "grid", gap: "18px" }}>
        <h2 style={{ margin: 0, fontSize: "26px" }}>Texty pro veřejný detail</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <TextArea id="description_cs" label="Popis (CZ)" defaultValue={defaults.description_cs} rows={5} />
          <TextArea id="description_en" label="Popis (EN)" defaultValue={defaults.description_en} rows={5} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <TextArea id="curator_note_cs" label="Kurátorská poznámka (CZ)" defaultValue={defaults.curator_note_cs} rows={5} />
          <TextArea id="curator_note_en" label="Kurátorská poznámka (EN)" defaultValue={defaults.curator_note_en} rows={5} />
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", padding: "24px", display: "grid", gap: "18px" }}>
        <h2 style={{ margin: 0, fontSize: "26px" }}>Vizuál a publikace</h2>
        <Field id="cover_image_path" label="Cover image path / URL" defaultValue={defaults.cover_image_path} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field id="cover_image_alt" label="Alt text" defaultValue={defaults.cover_image_alt} />
          <Field id="cover_image_caption" label="Caption" defaultValue={defaults.cover_image_caption} />
        </div>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}><input type="checkbox" name="is_featured" defaultChecked={defaults.is_featured} /> Doporučená / featured kolekce</label>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}><input type="checkbox" name="is_public_visible" defaultChecked={defaults.is_public_visible} /> Veřejně viditelná</label>
        </div>
      </section>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="submit" style={{ padding: "12px 18px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}>{submitLabel}</button>
        <Link href="/member/collections" style={{ padding: "12px 18px", border: "1px solid #ccc", textDecoration: "none", color: "#111" }}>Zrušit</Link>
      </div>
    </form>
  )
}

function Field({ id, label, defaultValue, required = false }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><input id={id} name={id} type="text" required={required} defaultValue={defaultValue} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }} /></div>
}

function TextArea({ id, label, defaultValue, rows = 4 }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><textarea id={id} name={id} defaultValue={defaultValue} rows={rows} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px", resize: "vertical" }} /></div>
}
