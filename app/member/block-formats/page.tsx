import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {WORK_BLOCK_TYPES} from "@/lib/blocks";
import {getLegacyBlockStyles} from "@/lib/rendering/legacyBlockStyles.server";
import LegacyBlockFormatManager from "@/components/editor/LegacyBlockFormatManager";
import {saveLegacyBlockFormat} from "./actions";
import "@/components/editor/editorial-workspace.css";
import "./block-formats.css";
export const dynamic="force-dynamic";
export default async function LegacyBlockFormatsPage(){
 await requireEditorOrAdmin();
 const styles=await getLegacyBlockStyles();
 return <main className="ed-page legacy-formats-page">
  <nav className="ed-breadcrumb" aria-label="Drobečková navigace">
   <Link href="/member/works">Díla</Link><span className="ed-breadcrumb__sep">/</span>
   <span>Formáty bloků</span>
  </nav>
  <header className="ed-hero">
   <p className="ed-eyebrow">ARTales · redakční sazba</p>
   <div className="ed-hero__row"><div>
    <h1>Formáty obsahových bloků</h1>
    <p className="ed-hero__subtitle">Výchozí vzhled jednotlivých částí knihy.
     Uložené nastavení platí pro starý Reader a jeho redakční náhled.
     Publikovaná sémantická čtečka se nemění.</p>
   </div><div className="ed-hero__actions">
    <Link href="/member/works" className="ed-button ed-button--soft">Zpět k dílům</Link>
   </div></div>
  </header>
  <div className="legacy-formats-page__summary">
   <span><strong>{WORK_BLOCK_TYPES.length}</strong> společných typů</span>
   <span>Jeden formát pro všechna díla ve starém Readeru</span>
   <span>Lokální výjimky zatím nejsou zapnuté</span>
  </div>
  <LegacyBlockFormatManager initialStyles={styles} save={saveLegacyBlockFormat}/>
 </main>;
}
