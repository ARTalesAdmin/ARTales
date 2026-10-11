import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {inspectRealAliceRights} from "../lib/pilots/aliceRealRightsDesk";
const bytes=readFileSync("tests/fixtures/gutenberg/pg11-2016-gitenberg-11-0.txt");
const report=inspectRealAliceRights(bytes);
mkdirSync("artifacts",{recursive:true});
writeFileSync("artifacts/alice-real-rights-desk.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({source_sha256:report.source.sha256,source_bytes:report.source.bytes,
 inventory:report.componentInventory.map(x=>({id:x.id,kind:x.kind,disposition:x.disposition,sha256:x.sha256})),
 outcome:report.scan.outcome,issues:report.scan.issues,
 publicationAuthorized:report.scan.publicationAuthorized},null,2));
