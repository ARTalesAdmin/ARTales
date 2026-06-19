import Link from "next/link";
import EditorialImageUploadField from "@/components/media/EditorialImageUploadField";
import { notFound } from "next/navigation";
import { requireEditorOrAdmin } from "@/lib/guards";
import { getCollectionForEditBySlug, getCollectionWorkAssignments } from "@/lib/dbCollections";
import { getWorksForMember } from "@/lib/dbWorks";
import { updateCollection, updateCollectionWorkAssignments } from "@/lib/actions/collections";
import { mapCollectionToFormValues } from "@/lib/forms/collectionForm";
import { COLLECTION_TYPE_OPTIONS } from "@/lib/collectionTypes";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string; works_error?: string }>;
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

function getSuccessMessage(success?: string) {
  switch (success) {
    case "collection_created": return "Kolekce byla vytvořena.";
    case "collection_updated": return "Kolekce byla uložena.";
    case "collection_works_updated": return "Vazby kolekce na díla byly uloženy.";
    default: return null;
  }
}

function getWorksErrorMessage(error?: string) {
  switch (error) {
    case "load_failed": return "Nepodařilo se načíst vazby kolekce.";
    case "save_failed": return "Nepodařilo se uložit vazby kolekce.";
    default: return null;
  }
}

export default async function EditCollectionPage({ params, searchParams }: PageProps) {
  await requireEditorOrAdmin();
  const { slug } = await params;
  const { error, success, works_error } = await searchParams;
  const collection = await getCollectionForEditBySlug(slug);
  if (!collection) notFound();

  const defaults = mapCollectionToFormValues(collection);
  const [works, assignments] = await Promise.all([
    getWorksForMember(),
    getCollectionWorkAssignments(collection.id),
  ]);
  const assignmentMap = new Map(assignments.map((item) => [item.work_id, item]));
  const updateCollectionWithSlug = updateCollection.bind(null, slug);
  const updateWorksWithCollection = updateCollectionWorkAssignments.bind(null, collection.id, slug);

  return (
    <main style={{ padding: "48px 32px", fontFamily: "serif", lineHeight: 1.6, maxWidth: "1100px", margin: "0 auto" }}>
      <p style={{ marginBottom: "20px" }}><Link href="/member/collections">{"<- Zpět na kolekce"}</Link></p>
      <h1 style={{ fontSize: "40px", lineHeight: 1.1, marginTop: 0, marginBottom: "12px" }}>Editace kolekce</h1>
      <p style={{ maxWidth: "760px", marginBottom: "20px" }}>Bilingvní metadata, vizuál i kurátorská vrstva. Níže můžeš zároveň spravovat přiřazení děl a jejich ruční pořadí.</p>
      {getErrorMessage(error) ? <p style={{ marginBottom: "18px", padding: "12px 14px", border: "1px solid #d99", background: "#fff7f7" }}>{getErrorMessage(error)}</p> : null}
      {getSuccessMessage(success) ? <p style={{ marginBottom: "18px", padding: "12px 14px", border: "1px solid #9c9", background: "#f6fff6" }}>{getSuccessMessage(success)}</p> : null}
      {getWorksErrorMessage(works_error) ? <p style={{ marginBottom: "18px", padding: "12px 14px", border: "1px solid #d99", background: "#fff7f7" }}>{getWorksErrorMessage(works_error)}</p> : null}

      <form action={updateCollectionWithSlug} style={{ display: "grid", gap: "22px", marginBottom: "32px" }}>
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

          <EditorialImageUploadField
            kind="collection-cover"
            title={defaults.title_cs || defaults.title_en || "ARTales kolekce"}
            slugInputId="slug"
            titleInputId="title_cs"
            pathName="cover_image_path"
            altName="cover_image_alt"
            captionName="cover_image_caption"
            initialPath={defaults.cover_image_path}
            initialAlt={defaults.cover_image_alt}
            initialCaption={defaults.cover_image_caption}
            heading="Cover kolekce"
            description="Nahraj veřejný vizuál kolekce přímo do ARTales Storage. Doporučený poměr je 3:2, master 1800 × 1200 px."
            uploadLabel="Nahrát cover kolekce"
            uploadingLabel="Nahrávám cover…"
            removeLabel="Odebrat cover"
            emptyHint="Pokud cover zatím není hotový, veřejná kolekce použije decentní ARTales fallback."
            readyHint="Cover kolekce je připravený v ARTales Storage. Ulož kolekci, aby se cesta propsala do databáze."
            altLabel="Alt text coveru"
            altPlaceholder="Krátký popis obrázku pro přístupnost a SEO"
            captionLabel="Popisek / kredit coveru"
            captionPlaceholder="Nepovinný veřejný popisek nebo kredit obrázku"
            defaultAltPrefix="Cover kolekce"
          />

          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}><input type="checkbox" name="is_featured" defaultChecked={defaults.is_featured} /> Doporučená / featured kolekce</label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 600 }}><input type="checkbox" name="is_public_visible" defaultChecked={defaults.is_public_visible} /> Veřejně viditelná</label>
          </div>
        </section>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="submit" style={{ padding: "12px 18px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}>Uložit metadata kolekce</button>
          <Link href={`/collections/${collection.slug}`} style={{ padding: "12px 18px", border: "1px solid #ccc", textDecoration: "none", color: "#111" }}>Veřejný detail</Link>
        </div>
      </form>

      <form action={updateWorksWithCollection} style={{ display: "grid", gap: "18px" }}>
        <section style={{ border: "1px solid #ddd", padding: "24px", display: "grid", gap: "16px" }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "26px" }}>Díla v kolekci</h2>
            <p style={{ margin: 0, maxWidth: "760px" }}>Zaškrtni díla, která do kolekce patří. U zařazených děl můžeš ručně určit pořadí. Tím se řeší kurátorské řazení v rámci kolekce. Primární kolekci konkrétního díla stále určuje editor díla.</p>
          </div>

          {works.length === 0 ? (
            <p>Zatím nejsou vytvořená žádná díla.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {works.map((work, index) => {
                const assigned = assignmentMap.get(work.id);
                const checked = Boolean(assigned);
                return (
                  <label key={work.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: "14px", alignItems: "center", padding: "14px 16px", border: "1px solid rgba(13, 21, 40, 0.12)", borderRadius: "14px", background: checked ? "#fffdf6" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <input type="checkbox" name="assigned_work_ids" value={work.id} defaultChecked={checked} style={{ marginTop: "4px" }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{work.title}</div>
                        <div style={{ fontSize: "14px", opacity: 0.72 }}>/{work.slug} · {work.status} · {work.author?.name ?? "bez autora"}</div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`sort_order_${work.id}`} style={{ display: "block", marginBottom: "6px", fontSize: "14px", opacity: 0.75 }}>Pořadí</label>
                      <input id={`sort_order_${work.id}`} name={`sort_order_${work.id}`} type="number" defaultValue={assigned?.sort_order ?? (index + 1) * 10} style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", fontSize: "15px" }} />
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </section>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="submit" style={{ padding: "12px 18px", border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer", fontSize: "16px", fontWeight: 600 }}>Uložit vazby děl</button>
        </div>
      </form>
    </main>
  )
}

function Field({ id, label, defaultValue, required = false }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><input id={id} name={id} type="text" required={required} defaultValue={defaultValue} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px" }} /></div>
}

function TextArea({ id, label, defaultValue, rows = 4 }: any) {
  return <div><label htmlFor={id} style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label><textarea id={id} name={id} defaultValue={defaultValue} rows={rows} style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", fontSize: "16px", resize: "vertical" }} /></div>
}
