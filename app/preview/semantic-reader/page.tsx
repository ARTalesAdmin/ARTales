import {notFound} from "next/navigation";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import SemanticReaderLab from "@/components/editor/SemanticReaderLab";
import {captureGutenbergBytes,getPg11FixtureRequest} from "@/lib/ingest/gutenbergSnapshot";
import {composeSemanticPg11} from "@/lib/semantic/compose";
import {syntheticLegacyFixture} from "@/lib/semantic/tripleQA";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
/** Nonproduction-only, local fixture data. No production work or reader note is fetched. */
export default function SemanticReaderPreviewPage(){
 if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
 const bytes=readFileSync(join(process.cwd(),"tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt"));
 const snapshot=captureGutenbergBytes(bytes,getPg11FixtureRequest());
 const {revision}=composeSemanticPg11(snapshot,{work_id:"fixture:alice:synthetic",work_slug:"alices-adventures-in-wonderland"});
 const synthetic=syntheticLegacyFixture(revision);
 return <SemanticReaderLab revision={revision} original={revision.source.normalized_text}
  legacySynthetic={synthetic.blocks.map(x=>x.text).join("")}/>;
}
