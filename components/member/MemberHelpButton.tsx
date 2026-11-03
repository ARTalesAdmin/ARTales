"use client";
import {usePathname,useRouter} from "next/navigation";
import {useState,useTransition} from "react";
import {requestEditorialHelp} from "@/app/member/editorial-help/actions";
import "./MemberHelpButton.css";
export default function MemberHelpButton(){
 const path=usePathname()??"";
 const router=useRouter();
 const [opened,setOpened]=useState(false);
 const [subject,setSubject]=useState("");
 const [details,setDetails]=useState("");
 const [status,setStatus]=useState("");
 const [pending,startTransition]=useTransition();
 if(!/^\/member\/(semantic|authors|collections|works|editorial-pipeline)(\/|$)/.test(path))return null;
 return <div className="artales-member-help">
  <button type="button" onClick={()=>setOpened(v=>!v)} aria-expanded={opened}>
   Požádat Luboše o pomoc</button>
  {opened?<form onSubmit={e=>{
   e.preventDefault();
   startTransition(async()=>{
    const result=await requestEditorialHelp({contextPath:path,subject,details});
    setStatus(result.message);
    if(result.ok){setOpened(false);setSubject("");setDetails("");router.refresh();}
   });
  }} className="artales-member-help__form">
   <h3>Požádat o pomoc / eskalovat</h3>
   <p>Dotaz se uloží jako přiřazený úkol garantovi s odkazem na aktuální stránku.</p>
   <label>Předmět<input required minLength={5} maxLength={160} value={subject}
    onChange={e=>setSubject(e.target.value)}/></label>
   <label>Problém, nejasnost nebo návrh
    <textarea required minLength={20} maxLength={4000} rows={4} value={details}
     onChange={e=>setDetails(e.target.value)}/></label>
   <button disabled={pending||subject.trim().length<5||details.trim().length<20}>Odeslat garantovi</button>
   <button type="button" onClick={()=>setOpened(false)}>Zavřít</button>
  </form>:null}
  <span role="status">{status}</span>
 </div>;
}
