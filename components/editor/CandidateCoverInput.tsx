"use client";
import {useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {ARTALES_IMAGES_BUCKET,ARTALES_IMAGE_MAX_UPLOAD_BYTES,
 isAllowedArtalesImageMimeType,getExtensionFromMimeType} from "@/lib/storageImages";

export default function CandidateCoverInput({candidateId,initialPath="",initialAlt="",initialCaption=""}:{
 candidateId:string;initialPath?:string;initialAlt?:string;initialCaption?:string
}){
 const input=useRef<HTMLInputElement>(null);
 const [path,setPath]=useState(initialPath);
 const [alt,setAlt]=useState(initialAlt);
 const [caption,setCaption]=useState(initialCaption);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const upload=async(file:File|undefined)=>{
  if(!file)return;
  if(!isAllowedArtalesImageMimeType(file.type)||file.size>ARTALES_IMAGE_MAX_UPLOAD_BYTES){
   setMessage("Použij JPG, PNG nebo WebP do 5 MB.");return;
  }
  setBusy(true);setMessage("");
  const target=`works/${candidateId}/cover/cover-${crypto.randomUUID()}.${getExtensionFromMimeType(file.type)}`;
  try{
   const db=createClient();
   const {error}=await db.storage.from(ARTALES_IMAGES_BUCKET).upload(target,file,{
    cacheControl:"31536000",contentType:file.type,upsert:false
   });
   if(error){setMessage("Obrázek se nepodařilo nahrát: "+error.message);return;}
   setPath(target);
   setMessage("Nahráno. Ulož vazbu na obálku tlačítkem níže.");
  }catch{setMessage("Nahrávání selhalo. Opakuj pokus.")}
  finally{setBusy(false);if(input.current)input.current.value="";}
 };
 return <div style={{display:"grid",gap:10}}>
  <input type="hidden" name="value" value={path}/>
  <label>Soubor obálky
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp"
    disabled={busy} onChange={event=>void upload(event.target.files?.[0])}/>
  </label>
  {path?<p>Vybraný soubor: <code>{path}</code></p>:<p>Nejdřív nahraj obálku.</p>}
  <label>Alternativní popis obrázku (povinný)
   <input name="alt" required minLength={8} maxLength={350} value={alt}
    onChange={e=>setAlt(e.target.value)} placeholder="Obálka knihy The Great God Pan"/>
  </label>
  <label>Popisek obrázku (nepovinný)
   <input name="caption" maxLength={500} value={caption}
    onChange={e=>setCaption(e.target.value)}/>
  </label>
  {message?<p role="status">{message}</p>:null}
  <button type="submit" disabled={busy||!path||alt.trim().length<8}>Uložit obálku díla</button>
 </div>;
}
