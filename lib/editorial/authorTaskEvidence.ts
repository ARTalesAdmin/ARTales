/** Shared input-evidence contract for independently completed author tasks.
 * Application checks avoid pointless closeout attempts; PostgreSQL still
 * validates real assets, source identity, actor rights and task status.
 */
export type AuthorTaskEvidence={
 bio_cs?:string|null;bio_en?:string|null;
 portrait_image_path?:string|null;portrait_image_alt?:string|null;
};
export type AuthorEditorialKind="author_bio"|"author_visual";
export function readyAuthorTaskKinds(e:AuthorTaskEvidence):AuthorEditorialKind[]{
 const result:AuthorEditorialKind[]=[];
 if([e.bio_cs,e.bio_en].every(value=>{
  const len=(value??"").trim().length;
  return len>=200&&len<=800;
 }))result.push("author_bio");
 if(Boolean(e.portrait_image_path?.trim())&&
    (e.portrait_image_alt??"").trim().length>=8)result.push("author_visual");
 return result;
}
