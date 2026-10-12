import {createHash} from "node:crypto";

export const PG114_ILLUSTRATIONS_SOURCE="https://www.gutenberg.org/files/114/114-h/114-h.htm";
export const PG114_ILLUSTRATIONS_CATALOG="https://www.gutenberg.org/ebooks/114";
export const PG114_ILLUSTRATIONS_EXPECTED_COUNT=42;

export type GutenbergImageReference=Readonly<{
 component_id:string;
 ordinal:number;
 source_url:string;
 caption:string;
 catalog_url:string;
 index_sha256:string;
 archive_status:"not_captured";
}>;
export type GutenbergImageManifest=Readonly<{
 schema:"artales.gutenberg-image-manifest.v1";
 catalog_url:string;
 index_source_url:string;
 index_sha256:string;
 expected_count:number|null;
 images:readonly GutenbergImageReference[];
 complete:boolean;
 asset_bytes_archived:false;
}>;

const sha=(v:Uint8Array)=>createHash("sha256").update(v).digest("hex");
const attr=(tag:string,label:string)=>{
 const found=new RegExp("(?:^|\\s)"+label+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))","i").exec(tag);
 return found?(found[1]??found[2]??found[3]??"").trim():null;
};
const decodeAlt=(s:string)=>s.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
 .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();

/**
 * Extract every embedded Gutenberg original, not an arbitrary image URL.
 * This inventory is *discovered*, not a claim that any binaries were saved.
 * An external importer must fetch exact bytes, vet rights and verify Storage.
 */
export function discoverGutenbergImages(args:Readonly<{
 html:string;source_url:string;catalog_url:string;expected_count?:number;
}>):GutenbergImageManifest{
 const bytes=Buffer.from(args.html,"utf8");
 if(bytes.length<35||bytes.length>1_000_000)throw Error("Gutenberg HTML size out of bounds");
 const source=new URL(args.source_url),catalog=new URL(args.catalog_url);
 if(source.protocol!=="https:"||source.hostname!=="www.gutenberg.org"||
    catalog.protocol!=="https:"||catalog.hostname!=="www.gutenberg.org"||
    source.search||source.hash||catalog.search||catalog.hash)
  throw Error("Gutenberg manifest source not trusted");
 const number=/^\/ebooks\/(\d+)\/?$/.exec(catalog.pathname)?.[1];
 if(!number||!source.pathname.startsWith("/files/"+number+"/")||
   !/\.html?$/.test(source.pathname))
  throw Error("Gutenberg catalog and edition index do not match");
 if(args.expected_count!==undefined&&
   (!Number.isSafeInteger(args.expected_count)||args.expected_count<1||args.expected_count>300))
  throw Error("Invalid Gutenberg expected illustration count");
 const digest=sha(bytes),images:GutenbergImageReference[]=[];
 const encountered=new Set<string>();
 for(const tag of args.html.match(/<img\b[^>]*>/gi)??[]){
  const src=attr(tag,"src");
  if(!src)throw Error("Unresolved Gutenberg image tag");
  const url=new URL(src.replace(/&amp;/g,"&"),source);
  if(url.protocol!=="https:"||url.host!=="www.gutenberg.org"||
     !url.pathname.startsWith("/files/"+number+"/")||
     !/\.(?:gif|png|jpe?g)$/i.test(url.pathname)||url.search||url.hash||
     url.pathname.includes("/../")||encountered.has(url.toString()))
   throw Error("Untrusted, repeated or unsupported Gutenberg image reference");
  encountered.add(url.toString());
  const ordinal=images.length+1;
  const caption=decodeAlt(attr(tag,"alt")??"");
  images.push({
   component_id:"gutenberg:"+number+":image:"+String(ordinal).padStart(3,"0"),
   ordinal,source_url:url.toString(),caption,
   catalog_url:args.catalog_url,index_sha256:digest,archive_status:"not_captured"
  });
 }
 if(!images.length||args.expected_count!==undefined&&images.length!==args.expected_count)
  throw Error("Incomplete Gutenberg illustration inventory");
 return {
  schema:"artales.gutenberg-image-manifest.v1",
  catalog_url:args.catalog_url,index_source_url:args.source_url,
  index_sha256:digest,expected_count:args.expected_count??null,
  images,complete:true,asset_bytes_archived:false,
 };
}
