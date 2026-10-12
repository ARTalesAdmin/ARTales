import {createHash} from "node:crypto";
import type {RightsPerson} from "../rights/sourceTextEligibility";

export type IllustrationInput=Readonly<{
 candidate_id:string;
 text_snapshot_ref:string;
 component_id:string;
 role:"interior_illustration"|"cover";
 source:Readonly<{
  asset_url:string;
  catalog_url:string;
  archive_ref:string;
  captured_at:string;
  sha256:string;
  bytes:Uint8Array;
 }>;
 author:RightsPerson;
 provenance:"original_artist"|"other_edition_artist"|"unknown";
 us_catalog_status:"public_domain"|"copyrighted"|"permission_only"|"unknown";
 express_no_reuse:boolean;
}>;
export type IllustrationSnapshot=Readonly<{
 schema:"artales.illustration-snapshot.v1";
 candidate_id:string;
 text_snapshot_ref:string;
 component_id:string;
 role:"interior_illustration";
 asset_url:string;catalog_url:string;archive_ref:string;
 captured_at:string;checked_at:string;sha256:string;byte_length:number;
 media_type:"image/png"|"image/gif"|"image/jpeg";
 intrinsic_width:number;intrinsic_height:number;
 author:RightsPerson;
 eu_status:"term_expired"|"protected"|"unknown";
 us_status:"public_domain"|"restricted"|"unknown";
 decision:"eligible_for_editorial_draft"|"exclude_protected_asset"|"needs_rights_review";
 reason_codes:readonly string[];
 publication_authorized:false;
 derived_image_verified:false;
}>;
const digest=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");
const iso=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const https=(s:string|null)=>typeof s==="string"&&/^https:\/\/[^\s/]+/i.test(s);
const hex=/^[a-f0-9]{64}$/;
function officialCatalogNumber(value:string):string|null{
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||!["www.gutenberg.org","gutenberg.org"].includes(u.hostname)||
   u.search||u.hash)return null;
  return /^\/ebooks\/(\d+)\/?$/.exec(u.pathname)?.[1]??null;
 }catch{return null;}
}
function assetMatchesCatalog(assetUrl:string,bookNumber:string):boolean{
 try{
  const u=new URL(assetUrl);
  if(u.protocol!=="https:"||!["www.gutenberg.org","gutenberg.org"].includes(u.hostname)||
   u.search||u.hash)return false;
  return u.pathname.startsWith("/files/"+bookNumber+"/")||
   u.pathname.startsWith("/cache/epub/"+bookNumber+"/");
 }catch{return false;}
}
function dimensions(raw:Uint8Array){
 const b=Buffer.from(raw);
 if(b.length>=32&&b.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))&&
    b.subarray(12,16).toString("ascii")==="IHDR"){
  return {type:"image/png" as const,width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 }
 if(b.length>=14&&["GIF87a","GIF89a"].includes(b.subarray(0,6).toString("ascii"))&&b.at(-1)===0x3b){
  return {type:"image/gif" as const,width:b.readUInt16LE(6),height:b.readUInt16LE(8)};
 }
 if(b.length>=12&&b[0]===0xff&&b[1]===0xd8&&b.at(-2)===0xff&&b.at(-1)===0xd9){
  let index=2;
  while(index+8<b.length){
   if(b[index]!==0xff)break;
   while(b[index]===0xff)index++;
   const marker=b[index++];
   if(marker===0xda)break;
   if([0xd0,0xd1,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0x01].includes(marker))continue;
   if(index+2>b.length)break;
   const size=b.readUInt16BE(index);
   if(size<2||index+size>b.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7)
    return {type:"image/jpeg" as const,width:b.readUInt16BE(index+5),height:b.readUInt16BE(index+3)};
   index+=size;
  }
 }
 throw Error("Unsupported or malformed image format");
}
/**
 * Capture exact interior artwork bytes and independent artist rights.
 * This is a deterministic QA classifier, not an authorization to publish or
 * serve unsanitized originals to browsers.
 */
export function captureIllustration(input:IllustrationInput,checkedAt:string):IllustrationSnapshot{
 if(input.role!=="interior_illustration")throw Error("ARTales cover must always be separately authored");
 if(!iso(checkedAt)||!iso(input.source.captured_at)||
   Date.parse(input.source.captured_at)>Date.parse(checkedAt))
  throw Error("Invalid illustration capture/check chronology");
 const s=input.source;
 if(!input.candidate_id.trim()||!input.component_id.trim()||
   !/^sha256:[a-f0-9]{64}$/.test(input.text_snapshot_ref)||
   !s.archive_ref.trim()||!hex.test(s.sha256)||!s.bytes.length||
   s.bytes.length>10_000_000||digest(s.bytes)!==s.sha256)
  throw Error("Untrusted illustration source or snapshot digest");
 const image=dimensions(s.bytes);
 if(image.width<1||image.height<1||image.width>12000||image.height>12000)
  throw Error("Invalid illustration dimensions");
 const codes:string[]=[];
 const add=(v:string)=>{if(!codes.includes(v))codes.push(v)};
 const catalogId=officialCatalogNumber(s.catalog_url);
 if(!catalogId||!assetMatchesCatalog(s.asset_url,catalogId))add("illustration_catalog_origin_unverified");
 if(input.provenance==="unknown")add("illustration_artist_or_edition_unknown");
 const author=input.author;
 const year=new Date(checkedAt).getUTCFullYear();
 let eu:IllustrationSnapshot["eu_status"]="unknown";
 if(!author.name.trim()||!https(author.evidence_url)||
    (author.living&&author.death_year!==null)||
    (author.death_year!==null&&(!Number.isInteger(author.death_year)||
     author.death_year<1000||author.death_year>year)))add("artist_facts_missing");
 else if(author.living)eu="protected";
 else if(author.death_year!==null)eu=year>author.death_year+70?"term_expired":"protected";
 else add("artist_facts_missing");
 if(eu==="protected")add("artist_still_protected");
 let us:IllustrationSnapshot["us_status"]="unknown";
 if(input.us_catalog_status==="copyrighted"||input.us_catalog_status==="permission_only")
  us="restricted";
 else if(input.us_catalog_status==="public_domain"&&catalogId)
  us="public_domain";
 if(us==="restricted")add("usa_asset_restricted");
 if(us==="unknown")add("usa_asset_evidence_missing");
 if(input.express_no_reuse)add("express_image_reuse_prohibition");
 let decision:IllustrationSnapshot["decision"]="eligible_for_editorial_draft";
 if(eu==="protected"||us==="restricted"||input.express_no_reuse)decision="exclude_protected_asset";
 else if(codes.length)decision="needs_rights_review";
 return {
  schema:"artales.illustration-snapshot.v1",candidate_id:input.candidate_id,
  text_snapshot_ref:input.text_snapshot_ref,component_id:input.component_id,
  role:"interior_illustration",asset_url:s.asset_url,catalog_url:s.catalog_url,
  archive_ref:s.archive_ref,captured_at:s.captured_at,checked_at:checkedAt,
  sha256:s.sha256,byte_length:s.bytes.length,
  media_type:image.type,intrinsic_width:image.width,intrinsic_height:image.height,
  author,eu_status:eu,us_status:us,decision,reason_codes:codes,
  publication_authorized:false,derived_image_verified:false,
 };
}
