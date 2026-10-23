/** Bounded admin-triggered discovery; no background crawling. */
export const SHADOW_PAGE_SIZE=12;
export const SHADOW_RUN_BUDGET_MS=42000;
/** A request for 12 may inspect up to 30 NEW titles, never silently just five. */
export function maximumShadowEnrichments(requested:number):number{
  if(!Number.isInteger(requested)||requested<1||requested>12)throw Error("requested_1_to_12");
  return Math.min(30,Math.max(12,requested*3));
}
/** A partial page must restart after the last *persisted* RAW source record.
 * On a complete page, even malformed items contribute to fetchedCount.
 * On an interrupted page, all unprocessed positions remain visitable. */
export function nextShadowOffset(
  pageStart:number,fetchedCount:number,lastProcessedOffset:number|null,interrupted:boolean
):number{
  if(!Number.isInteger(pageStart)||pageStart<0||!Number.isInteger(fetchedCount)||fetchedCount<0)
    throw Error("invalid_catalog_page");
  if(lastProcessedOffset!==null&&
     (!Number.isInteger(lastProcessedOffset)||lastProcessedOffset<pageStart||
      lastProcessedOffset>=pageStart+fetchedCount))throw Error("invalid_catalog_offset");
  return interrupted ? (lastProcessedOffset===null?pageStart:lastProcessedOffset+1)
    :pageStart+fetchedCount;
}
