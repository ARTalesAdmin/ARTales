import {SNAPSHOT_389_CANDIDATE} from "../snapshot389Pilot";

const allowedOrigins=new Set(["https://artales.net","https://www.artales.net"]);
const MAX_FORM_BYTES=2048;

/** Enforce same-origin, bounded and exact admin intent before reaching any
 * privileged database or Storage call. Authenticated admin is checked separately.
 */
export async function validateSnapshot389Form(request:Request):Promise<void>{
  const origin=request.headers.get("origin")??"";
  const site=request.headers.get("sec-fetch-site");
  if(request.method!=="POST" || !allowedOrigins.has(origin) ||
     (site && site!=="same-origin"))
    throw Error("invalid_request_origin");
  const contentType=request.headers.get("content-type")??"";
  const headerLength=request.headers.get("content-length");
  if(!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType) ||
      !headerLength || !/^\d{1,4}$/.test(headerLength) ||
      Number(headerLength)<1 || Number(headerLength)>MAX_FORM_BYTES)
    throw Error("invalid_request_body");
  const length=Number(headerLength);
  const reader=request.body?.getReader();
  if(!reader)throw Error("invalid_request_body");
  const chunks:Uint8Array[]=[];let actual=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      actual+=value.length;
      if(actual>MAX_FORM_BYTES)throw Error("invalid_request_body");
      chunks.push(value);
    }
  }finally{
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
  if(actual!==length)throw Error("invalid_request_body");
  let text:string;
  try{
    text=new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks,actual));
  }catch{throw Error("invalid_request_body");}
  const body=new URLSearchParams(text);
  if([...body.keys()].length!==2 ||
     body.getAll("candidate_id").length!==1 ||
     body.getAll("confirm_private_original_with_cover").length!==1 ||
     body.get("candidate_id")!==SNAPSHOT_389_CANDIDATE ||
     body.get("confirm_private_original_with_cover")!=="archive_only_not_publication")
    throw Error("explicit_confirmation_required");
}
