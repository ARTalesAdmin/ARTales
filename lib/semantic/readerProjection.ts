import type {SemanticRevision,SemanticPage} from "./model";
import {verifySemanticRevision} from "./compose";
import {
 projectSemanticReader as coreProject,
 verifyReaderProjection as coreVerify,
 locateReaderAnchor as coreLocate,
 remapLegacyPosition as coreRemap
} from "./readerProjectionCore";
import type {SemanticReaderLayout,LegacyPosition} from "./readerProjectionCore";

/** Server-side verification adapter. The pagination algorithm is implemented
 * ONLY in readerProjectionCore, which is safe to use after boundary validation.
 */
export type {SemanticReaderLayout,LegacyPosition,RemapResult} from "./readerProjectionCore";
export {
 getSemanticPageUnits,chooseSemanticParagraphBreak,splitParagraphUnit,
 projectSemanticUnits
} from "./readerProjectionCore";
export function projectSemanticReader(revision:SemanticRevision,layout:SemanticReaderLayout){
 verifySemanticRevision(revision);
 return coreProject(revision,layout);
}
export function verifyReaderProjection(revision:SemanticRevision,pages:SemanticPage[],
 editionRange?:{start:number;end:number}){
 verifySemanticRevision(revision);
 return coreVerify(revision,pages,editionRange);
}
export function locateReaderAnchor(revision:SemanticRevision,atomId:string,offset=0){
 verifySemanticRevision(revision);
 return coreLocate(revision,atomId,offset);
}
export function remapLegacyPosition(revision:SemanticRevision,previous:LegacyPosition,
 evidence?:{snapshot_ref:string;component_id:string;original_byte_offset:number}){
 verifySemanticRevision(revision);
 return coreRemap(revision,previous,evidence);
}
