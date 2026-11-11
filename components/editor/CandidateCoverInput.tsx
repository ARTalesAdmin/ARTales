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
 const [pendingFile,setPendingFile]=useState<File|null>(null);
 const [alt,setAlt]=useState(initialAlt);
 const [caption,setCaption]=useState(initialCaption);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [problem,setProblem]=useState(false);
 const [existing,setExisting]=useState<string[]>([]);
 const [loadingExisting,setLoadingExisting]=useState(false);
 const selectFile=(file:File|undefined)=>{
  if(!file)return;
  if(!isAllowedArtalesImageMimeType(file.type)||file.size>ARTALES_IMAGE_MAX_UPLOAD_BYTES){
   setProblem(true);setMessage("Použij JPG, PNG nebo WebP do 5 MB.");return;
  }
  // Nothing is uploaded until the editor also supplies a valid description.
  // One button performs Storage upload, candidate link and task closeout.
  setPendingFile(file);
  setProblem(false);
  setMessage("Obrázek připraven. Doplň popis a potvrď uložení.");
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
  if(busy||(!path&&!pendingFile)||alt.trim().length<8)return;
  setBusy(true);setProblem(false);setMessage("Nahrávám a propojuji obálku s dílem…");
  try{
   let pathToSave=path;
   if(pendingFile){
    const target=`works/${candidateId}/cover/cover-${crypto.randomUUID()}.${getExtensionFromMimeType(pendingFile.type)}`;
    const db=createClient();
    const {error}=await db.storage.from(ARTALES_IMAGES_BUCKET).upload(target,pendingFile,{
     cacheControl:"31536000",contentType:pendingFile.type,upsert:false
    });
    if(error){setProblem(true);setMessage("Nahrání selhalo: "+error.message);return;}
    // Durable path is retained even if the later DB operation fails.
    pathToSave=target;
    setPath(target);
    setPendingFile(null);
    if(input.current)input.current.value="";
   }
   const result=await saveCandidateCover({candidateId,path:pathToSave,alt,caption});
   setProblem(!result.ok);setMessage(result.message);
   if(result.ok)router.refresh();
  }catch{setProblem(true);setMessage("Spojení selhalo. Pokud již byl obrázek nahrán, lze jeho uložení zopakovat bez dalšího uploadu.");}
  finally{setBusy(false);}
 };
 return <div className="ed-filebox">
  <p className="ed-eyebrow">Soubor obálky</p>
  <label className="ed-label">Nahrát nový obrázek
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp"
    disabled={busy||loadingExisting} onChange={event=>selectFile(event.target.files?.[0])}/>
  </label>
  <button className="ed-button ed-button--soft ed-button--compact" type="button"
   disabled={busy||loadingExisting} onClick={()=>void recover()}>
   {loadingExisting?"Hledám nahrané soubory…":"Použít již nahranou obálku"}
  </button>
  {existing.length>0?<div className="ed-filebox__existing" aria-label="Nahrané obálky">
    <p>Vyber správný obrázek, není třeba ho nahrávat znovu:</p>
    {existing.map(p=><label key={p} style={{display:"block",marginBottom:8}}>
      <input type="radio" name="existingCoverPath" checked={path===p}
       onChange={()=>{setPath(p);setPendingFile(null);if(input.current)input.current.value="";setProblem(false);setMessage("Vybrána dříve nahraná obálka.");}}/>
      {" "}<img src={getPublicStorageImageUrl(p)??""} alt="Náhled uložené obálky"
       width={52} height={68} style={{objectFit:"contain",verticalAlign:"middle",marginInline:8}}/>
      {p.split("/").at(-1)}
    </label>)}
  </div>:null}
  {pendingFile?<p className="ed-filebox__path">Připravený obrázek: {pendingFile.name}</p>:
   path?<p className="ed-filebox__path">Vybraná obálka: {path.split("/").at(-1)}</p>:null}
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
   disabled={busy||loadingExisting||(!path&&!pendingFile)||alt.trim().length<8}>
   {busy?"Ukládám…":"Nahrát a dokončit obálku ✓"}
  </button>
  <small className="ed-help">Jedno potvrzení nahraje obrázek a uloží jej k dílu. Pokud se propojení nezdaří, soubor zůstane v úložišti pro opakování bez nového nahrávání.</small>
 </div>;
}
