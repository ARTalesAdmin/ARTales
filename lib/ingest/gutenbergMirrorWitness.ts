/** Bounded, direct exact-book mirror byte witness. Only numeric Gutenberg IDs
 * are interpolated. No search/redirects/provider swap or persistence here.
 */
export function mirrorUrlForGutenberg(id:number):string{
 if(!Number.isSafeInteger(id)||id<1||id>99_999_999)throw Error("invalid_gutenberg_id");
 return "https://gutenberg.pglaf.org/cache/epub/"+id+"/pg"+id+".epub";
}
export async function fetchGutenbergMirrorForWitness(id:number,fetcher:typeof fetch=fetch):Promise<Uint8Array>{
 const url=mirrorUrlForGutenberg(id),limit=8*1024*1024;
 const response=await fetcher(url,{method:"GET",redirect:"error",cache:"no-store",
  signal:AbortSignal.timeout(20000),
  headers:{Accept:"application/epub+zip, application/octet-stream;q=0.8"}});
 if(response.status!==200||response.redirected||(response.url&&response.url!==url)||!response.body)
  throw Error("gutenberg_mirror_unavailable");
 const len=response.headers.get("content-length");
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>limit))throw Error("gutenberg_mirror_invalid_length");
 const reader=response.body.getReader(),chunks:Buffer[]=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   total+=value.length;if(total>limit)throw Error("gutenberg_mirror_oversize");
   chunks.push(Buffer.from(value));
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(total<100||(len!==null&&total!==Number(len)))throw Error("gutenberg_mirror_truncated");
 return new Uint8Array(Buffer.concat(chunks,total));
}
