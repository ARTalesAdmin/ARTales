import type {AuthenticatedCaptureGrant} from "../ingest/gutenbergImageCapturePipeline";

export const ALICE_114_CATALOG="https://www.gutenberg.org/ebooks/114";
export const ALICE_114_HTML="https://www.gutenberg.org/files/114/114-h/114-h.htm";
export const ALICE_114_IMAGE_COUNT=42;
export const ALICE_PINNED_ENGLISH_SOURCE_SHA256="49a0b2726606e1290ac03a63978fa1dd1bd38a8d805704d98265f393533ea094";
export const ALICE_PILOT_CANDIDATE_ID="pilot:alice:original-en";

export type CaptureActor=Readonly<{
 user_id:string|null;
 profile_id:string|null;
 role:string|null;
 is_active:boolean|null;
}>;
export type CaptureRouteProof=Readonly<{
 deployment:"production"|"preview"|"local"|"disabled";
 request_url:string;
 origin:string|null;
 content_type:string|null;
 fetch_site:string|null;
 actor:CaptureActor;
 json:unknown;
}>;
/**
 * This pilot is admin-only until the canonical candidates and assignment tables
 * exist. NEVER accept actor, grant, catalog, URL or rights facts from request JSON.
 */
export function authorizeAlice114Capture(x:CaptureRouteProof):Readonly<{
 ordinal:number;grant:AuthenticatedCaptureGrant;
}>{
 if(x.deployment!=="production")throw Error("capture_deployment_disabled");
 const target=new URL(x.request_url);
 if(target.protocol!=="https:"||target.username||target.password||
  !["artales.net","www.artales.net"].includes(target.hostname)||
  target.port||target.search||target.hash)
  throw Error("capture_wrong_host");
 const canonical=target.origin;
 if(x.origin!==canonical || (x.fetch_site && x.fetch_site!=="same-origin"))
  throw Error("capture_cross_origin");
 if(!x.content_type||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(x.content_type))
  throw Error("capture_content_type");
 if(!x.actor.user_id||x.actor.profile_id!==x.actor.user_id||
  x.actor.role!=="admin"||x.actor.is_active!==true)
  throw Error("capture_admin_required");
 if(!x.json||typeof x.json!=="object"||Array.isArray(x.json))
  throw Error("capture_invalid_body");
 const fields=Object.keys(x.json);
 if(fields.length!==1||fields[0]!=="ordinal")throw Error("capture_unexpected_field");
 const ordinal=(x.json as {ordinal?:unknown}).ordinal;
 if(typeof ordinal!=="number"||!Number.isSafeInteger(ordinal)||
    ordinal<1||ordinal>ALICE_114_IMAGE_COUNT)
  throw Error("capture_invalid_ordinal");
 return {
  ordinal,
  grant:{authenticated:true,role:"admin",
   assigned_candidate_id:ALICE_PILOT_CANDIDATE_ID,
   approved_gutenberg_catalog:ALICE_114_CATALOG}
 };
}
