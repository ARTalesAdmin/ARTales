/**
 * A gallery-level migration plan never changes published works.
 * Every eligible work requires its own editorial/release cutover transaction.
 */
export type GalleryMigrationCandidate=Readonly<{
 work_id:string;slug:string;published:boolean;
 rights:"eligible_for_editorial_draft"|"find_alternative_source"|"needs_facts"|"blocked_protected_work";
 snapshot_pinned:boolean;
 editorial:"not_started"|"in_review"|"approved";
 reader_shadow:"missing"|"blocked"|"ready";
}>;
export type GalleryMigrationDecision=Readonly<{
 work_id:string;slug:string;
 action:"prepare_editorial"|"ready_for_release_review"|"hold";
 reasons:readonly string[];
}>;
export function planGalleryMigration(works:readonly GalleryMigrationCandidate[]):readonly GalleryMigrationDecision[]{
 const seenId=new Set<string>(),seenSlug=new Set<string>();
 return works.map(work=>{
  if(!work.work_id||!work.slug||seenId.has(work.work_id)||seenSlug.has(work.slug))
   throw Error("Duplicate or missing gallery work identity");
  seenId.add(work.work_id);seenSlug.add(work.slug);
  const reasons:string[]=[];
  if(!work.published)reasons.push("not_currently_published");
  if(work.rights!=="eligible_for_editorial_draft")reasons.push("selected_text_rights_not_eligible");
  if(!work.snapshot_pinned)reasons.push("source_snapshot_not_pinned");
  if(reasons.length)return {work_id:work.work_id,slug:work.slug,action:"hold" as const,reasons};
  if(work.editorial==="approved"&&work.reader_shadow==="ready")
   return {work_id:work.work_id,slug:work.slug,
    action:"ready_for_release_review" as const,reasons:[]};
  return {work_id:work.work_id,slug:work.slug,
   action:"prepare_editorial" as const,
   reasons:[work.editorial!=="approved"?"editorial_pending":"reader_shadow_pending"]};
 });
}
