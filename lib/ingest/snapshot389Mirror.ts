/** Bounded single-book acquisition from an officially listed Gutenberg mirror.
 * No website crawling, URL parameters, redirects, search, retry, or batch mode.
 * Mirror bytes are unaltered; source/edition correspondence is a separate gate.
 */
export const SNAPSHOT_389_MIRROR_URL = "https://gutenberg.pglaf.org/cache/epub/389/pg389.epub" as const;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export async function fetchSnapshot389FromMirror(fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetcher(SNAPSHOT_389_MIRROR_URL, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: { Accept: "application/epub+zip, application/octet-stream;q=0.8" },
  });
  if(response.status!==200 || response.redirected ||
    (response.url && response.url!==SNAPSHOT_389_MIRROR_URL) || !response.body)
    throw new Error("snapshot_389_mirror_unavailable");
  const raw = response.headers.get("content-length");
  if(raw!==null && (!/^\d+$/.test(raw) || Number(raw)>MAX_SOURCE_BYTES))
    throw new Error("snapshot_389_mirror_declared_size_invalid");
  const chunks:Uint8Array[]=[];
  const reader=response.body.getReader();
  let total=0;
  try {
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_SOURCE_BYTES)throw new Error("snapshot_389_mirror_oversize");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  if(total<64 || (raw!==null&&Number(raw)!==total)) throw new Error("snapshot_389_mirror_size_mismatch");
  return new Uint8Array(Buffer.concat(chunks.map(c=>Buffer.from(c)),total));
}
