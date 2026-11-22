import Link from "next/link";
import {requireEditorOrAdmin} from "@/lib/guards";
import {getLegacyBlockStyles} from "@/lib/rendering/legacyBlockStyles.server";
import LegacyBlockFormatManager from "@/components/editor/LegacyBlockFormatManager";
import {saveLegacyBlockFormat} from "./actions";

export const dynamic = "force-dynamic";

export default async function LegacyBlockFormatsPage(){
  await requireEditorOrAdmin();
  const styles=await getLegacyBlockStyles();
  return <main style={{maxWidth:1120,margin:"0 auto",padding:"28px 18px 70px"}}>
    <nav style={{marginBottom:18,fontSize:14}}>
      <Link href="/member/works">Díla</Link> / Formáty bloků
    </nav>
    <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(26px,3vw,36px)"}}>
      Formáty obsahových bloků
    </h1>
    <p style={{maxWidth:780,lineHeight:1.65}}>
      Společný výchozí vzhled všech 17 typů pro starý Reader.
      Změny se projeví ve veřejném i redakčním náhledu starého Readeru;
      publikovaná sémantická čtečka je nedotčená. Lokální výjimky pro dílo
      ani vytváření vlastních typů zatím nejsou součástí tohoto nástroje.
    </p>
    <LegacyBlockFormatManager initialStyles={styles} save={saveLegacyBlockFormat}/>
  </main>;
}
