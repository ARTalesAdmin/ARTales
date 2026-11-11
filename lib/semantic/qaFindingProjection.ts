/** QA findings may still refer to immutable source atoms deliberately absent from
 * the ARTales edition. This uses exactly the Reader's edition projection:
 * never infer removals from a book title, an AI response or a flag comment.
 */
import type {SemanticRevision} from "./model";
import {walkSemanticAtoms} from "./compose";
import {classifyGutenbergApparatus,selectEditorialEdition} from "./editionProjection";
import {getSemanticPageUnits} from "./readerProjection";

export type OmittedQaAtom={
 atomId:string;excerpt:string;
 reason:"gutenberg_apparatus"|"outside_edition"|"editorial_exclusion";
};

export function getOmittedQaAtoms(revision:SemanticRevision):Record<string,OmittedQaAtom>{
 const source=revision.source.normalized_text;
 const range=selectEditorialEdition(source).range;
 const atoms=walkSemanticAtoms(revision.blocks);
 const visible=new Set(getSemanticPageUnits(revision,range).flatMap(u=>u.source_atom_ids));
 const automatic=new Set(classifyGutenbergApparatus(source,atoms,
  revision.editorial_exclusions??[]).automaticAtomIds);
 const manual=new Set(revision.editorial_exclusions??[]);
 const omitted:Record<string,OmittedQaAtom>={};
 for(const atom of atoms){
  if(visible.has(atom.id))continue;
  let reason:OmittedQaAtom["reason"]|null=null;
  if(manual.has(atom.id))reason="editorial_exclusion";
  else if(automatic.has(atom.id))reason="gutenberg_apparatus";
  else if(atom.anchor.normalized_end<=range.start||
          atom.anchor.normalized_start>=range.end)reason="outside_edition";
  // A complex unit can be invisible for other reasons. Do not certify it as omitted.
  if(reason)omitted[atom.id]={atomId:atom.id,excerpt:atom.raw.trim().slice(0,280),reason};
 }
 return omitted;
}
