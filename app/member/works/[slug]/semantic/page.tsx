import Link from "next/link";
import {notFound} from "next/navigation";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {requireEditorOrAdmin} from "@/lib/guards";
import {getWorkForEditBySlug} from "@/lib/dbWorks";
import {observeExistingAliceReadOnly,ALICE_LEGACY_SLUG} from "@/lib/pilots/aliceObservedLegacy";
import {captureGutenbergBytes,getPg11FixtureRequest} from "@/lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11} from "@/lib/semantic/compose";
import {walkSemanticAtoms} from "@/lib/semantic/compose";
import {getSemanticPageUnits} from "@/lib/semantic/readerProjection";
import {projectSemanticProseText} from "@/lib/semantic/displayText";

export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
type Props={params:Promise<{slug:string}>};

/** Editor-only E1 workbench. Existing work observation is never treated as archived evidence. */
export default async function AliceSemanticWorkbench({params}:Props){
  await requireEditorOrAdmin();
  if(process.env.VERCEL_ENV==="production"||process.env.NODE_ENV!=="development"&&process.env.VERCEL_ENV!=="preview")notFound();
  const {slug}=await params;
  if(slug!==ALICE_LEGACY_SLUG)notFound();
  const work=await getWorkForEditBySlug(slug);
  if(!work)notFound();
  const observed=observeExistingAliceReadOnly(work);
  const bytes=readFileSync(join(process.cwd(),"tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt"));
  const pinned=captureGutenbergBytes(bytes,getPg11FixtureRequest());
  const {revision,original_raw}=composeSemanticPg11(pinned,{work_id:work.id,work_slug:work.slug,chapter_only:false});
  const units=getSemanticPageUnits(revision);
  const newText=walkSemanticAtoms(revision.blocks).map(a=>a.raw).join("");
  const oldText=observed.blocks.map(b=>b.content).join("\n\n");
  return <main style={{maxWidth:1480,margin:"auto",padding:"32px 20px"}}>
    <p><Link href={`/member/works/${work.slug}/edit`}>← Zpět na dílo</Link></p>
    <p style={{fontSize:12,letterSpacing:".1em"}}>ARTales · Interní redakční laboratoř</p>
    <h1>{work.title} — sémantická rekonstrukce</h1>
    <p><strong>Stávající work_id:</strong> <code>{work.id}</code> · slug <code>{work.slug}</code> · veřejný status {observed.work_status}</p>
    <div role="status" style={{border:"1px solid #b88",padding:14,borderRadius:10,marginBottom:18}}>
      <strong>Pouze čtení. Žádné ukládání, schválení ani publikování.</strong>
      <p>Zdroj je přesný lokální pinned Gutenberg #11, nikoli dosud důvěryhodně zachycený produkční snapshot. Stará verze je aktuálně pozorovaný obsah existujícího díla, ne nezávisle archivovaná evidence. Právní a redakční kontroly dosud nejsou uzavřené.</p>
    </div>
    <p>Zdroj SHA-256: <code>{pinned.bytes_sha256}</code> · sémantická revize: <code>{revision.revision_ref}</code> · {revision.blocks.filter(x=>x.kind==="chapter").length} kapitol · {units.length} sémantických jednotek.</p>
    <section aria-label="Trojité porovnání" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
      <article style={{minWidth:0}}><h2>Archivní Gutenberg #11</h2><p>Lokální přesný zdroj · bez právního schválení</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:580,overflow:"auto",border:"1px solid #bbb",padding:16}}>{original_raw}</pre></article>
      <article style={{minWidth:0}}><h2>Nový Semantic Composer v2</h2><p>Nový návrh bez zápisu do databáze</p><div style={{maxHeight:580,overflow:"auto",border:"1px solid #bbb",padding:16}}>
        {units.map(unit=><section key={unit.id} style={{marginBottom:16}}>
          {(unit.node.kind==="chapter"||unit.node.kind==="section")?<h3>{unit.node.heading.raw}</h3>:
           unit.node.kind==="poem"?<pre style={{whiteSpace:"pre-wrap"}}>{unit.node.stanzas.flatMap(s=>s.lines.map(l=>l.atom.raw)).join("\n")}</pre>:
           "atom" in unit.node?<p>{projectSemanticProseText(unit.node.atom.raw)}</p>:null}
        </section>)}
      </div></article>
      <article style={{minWidth:0}}><h2>Současný ARTales</h2><p>Živé čtení pro oprávněného editora · nearchivovaná evidence · {observed.blocks.length} bloků, {observed.non_text_components} netextových komponent</p><div style={{maxHeight:580,overflow:"auto",border:"1px solid #bbb",padding:16}}>
        {observed.blocks.map(block=><section key={block.id}><small>{block.type}</small><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{block.content}</p></section>)}
        {!observed.has_legacy_content?<p>Obsah ve stávajícím záznamu není dostupný.</p>:null}
      </div></article>
    </section>
    <p>Rozsah starého textu: {oldText.length} znaků; nový text: {newText.length} znaků. Tyto počty <strong>neprokazují věcnou shodu</strong>.</p>
    <h2>Brány pro pokračování</h2><ul>{observed.blockers.map(b=><li key={b}>{b.replaceAll("_"," ")}</li>)}</ul>
    <p>Veřejný Reader, poznámky a čtenářský progres se touto stránkou nemění.</p>
  </main>;
}
