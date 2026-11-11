"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {saveCandidateCover,listCandidateCoverUploads} from "@/app/member/editorial-detail/[candidateId]/actions";
import {ARTALES_IMAGES_BUCKET,ARTALES_IMAGE_MAX_UPLOAD_BYTES,
 isAllowedArtalesImageMimeType,getExtensionFromMimeType,getPublicStorageImageUrl} from "@/lib/storageImages";

export default function CandidateCoverInput({candidateId,initialPath="",initialAlt="",initialCaption=""}:{
 candidateId:string;initialPath?:string;initialAlt?:string;initialCaption?:string
}){
 const router=useRouter(),input=useRef<HTMLInputElement>(null);
 const [path,setPath]=useState(initialPath);
 const [alt,setAlt]=useState(initialAlt);
 const [caption,setCaption]=useState(initialCaption);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [problem,setProblem]=useState(false);
 const [existing,setExisting]=useState<string[]>([]);
 const [loadingExisting,setLoadingExisting]=useState(false);
 const upload=async(file:File|undefined)=>{
  if(!file)return;
  if(!isAllowedArtalesImageMimeType(file.type)||file.size>ARTALES_IMAGE_MAX_UPLOAD_BYTES){
   setProblem(true);setMessage("Použij JPG, PNG nebo WebP do 5 MB.");return;
  }
  setBusy(true);setProblem(false);setMessage("");
  const target=`works/${candidateId}/cover/cover-${crypto.randomUUID()}.${getExtensionFromMimeType(file.type)}`;
  try{
   const db=createClient();
   const {error}=await db.storage.from(ARTALES_IMAGES_BUCKET).upload(target,file,{
    cacheControl:"31536000",contentType:file.type,upsert:false
   });
   if(error){setProblem(true);setMessage("Obrázek se nepodařilo nahrát: "+error.message);return;}
   setPath(target);
   setMessage("Obálka nahrána. Teď ulož záznam k dílu.");
  }catch{setProblem(true);setMessage("Nahrávání selhalo. Stávající soubor zůstává zachován.")}
  finally{setBusy(false);if(input.current)input.current.value="";}
 };
 const recover=async()=>{
  setLoadingExisting(true);setProblem(false);setMessage("");
  try{
   const data=await listCandidateCoverUploads(candidateId);
   setExisting(data.paths);
   setProblem(!data.ok);setMessage(data.message);
  }catch{setProblem(true);setMessage("Předchozí soubory se nepodařilo načíst.");}
  finally{setLoadingExisting(false);}
 };
 const save=async()=>{
  if(busy||!path||alt.trim().length<8)return;
  setBusy(true);setProblem(false);setMessage("Ukládám obálku k dílu…");
  try{
   const result=await saveCandidateCover({candidateId,path,alt,caption});
   setProblem(!result.ok);setMessage(result.message);
   if(result.ok)router.refresh();
  }catch{setProblem(true);setMessage("Spojení selhalo. Obrázek zůstává nahraný. Zkus znovu uložit bez nového nahrávání.");}
  finally{setBusy(false);}
 };
 return <div className="ed-filebox">
  <p className="ed-eyebrow">Soubor obálky</p>
  <label className="ed-label">Nahrát nový obrázek
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp"
    disabled={busy||loadingExisting} onChange={event=>void upload(event.target.files?.[0])}/>
  </label>
  <button className="ed-button ed-button--soft ed-button--compact" type="button"
   disabled={busy||loadingExisting} onClick={()=>void recover()}>
   {loadingExisting?"Hledám nahrané soubory…":"Použít již nahranou obálku"}
  </button>
  {existing.length>0?<div className="ed-filebox__existing" aria-label="Nahrané obálky">
    <p>Vyber správný obrázek, není třeba ho nahrávat znovu:</p>
    {existing.map(p=><label key={p} style={{display:"block",marginBottom:8}}>
      <input type="radio" name="existingCoverPath" checked={path===p}
       onChange={()=>{setPath(p);setProblem(false);setMessage("Vybrána dříve nahraná obálka.");}}/>
      {" "}<img src={getPublicStorageImageUrl(p)??""} alt="Náhled uložené obálky"
       width={52} height={68} style={{objectFit:"contain",verticalAlign:"middle",marginInline:8}}/>
      {p.split("/").at(-1)}
    </label>)}
  </div>:null}
  {path?<p className="ed-filebox__path">Vybraná obálka: {path.split("/").at(-1)}</p>:null}
  <label className="ed-label">Alternativní popis obrázku
   <input required minLength={8} maxLength={350} value={alt}
    onChange={e=>setAlt(e.target.value)} placeholder="Co je na obálce zobrazeno?"/>
  </label>
  <label className="ed-label">Popisek nebo kredit (nepovinný)
   <input maxLength={500} value={caption}
    onChange={e=>setCaption(e.target.value)} placeholder="Například autor ilustrace"/>
  </label>
  {message?<p role={problem?"alert":"status"} className="ed-filebox__message">{message}</p>:null}
  <button className="ed-button" type="button" onClick={()=>void save()}
   disabled={busy||loadingExisting||!path||alt.trim().length<8}>
   {busy?"Ukládám…":"Uložit obálku k dílu ✓"}
  </button>
  <small className="ed-help">Po neúspěšném uložení soubor nezmizí. Můžeš uložení zopakovat nebo zvolit již nahraný obrázek.</small>
 </div>;
}
