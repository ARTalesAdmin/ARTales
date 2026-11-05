"use client";
import {useState} from "react";

/** Shared candidate-facing copy requirement. The editor can still open legacy
 * profiles without forcibly rewriting historical descriptions. */
export default function BilingualProfileText({field,initialCs="",initialEn="",label,required=false}:{
 field:"bio"|"description";initialCs?:string;initialEn?:string;label:string;required?:boolean
}){
 const [cs,setCs]=useState(initialCs);
 const [en,setEn]=useState(initialEn);
 const input=(lang:"cs"|"en")=>{
  const value=lang==="cs"?cs:en;
  const length=value.trim().length;
  const valid=length>=200&&length<=800;
  return <div style={{minWidth:0}}>
   <label htmlFor={field+"_"+lang} style={{display:"block",marginBottom:8,fontWeight:600}}>
    {label} ({lang==="cs"?"CZ":"EN"}) {required?"*":""}
   </label>
   <textarea id={field+"_"+lang} name={field+"_"+lang}
    rows={7} required={required} minLength={required?200:undefined} maxLength={required?800:undefined}
    value={value} onChange={e=>lang==="cs"?setCs(e.target.value):setEn(e.target.value)}
    style={{width:"100%",minHeight:150,padding:"12px 14px",border:"1px solid #ccc",
      borderRadius:9,fontSize:15,resize:"vertical"}}
    aria-describedby={field+"_"+lang+"_count"}
   />
   <p id={field+"_"+lang+"_count"} aria-live="polite"
    style={{fontSize:12,color:valid?"#356b43":"#95652f",margin:"6px 0 0"}}>
    {length}/800 znaků {valid?"✓":length<200?"· doporučené minimum 200":"· maximum 800"}
   </p>
  </div>;
 };
 return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18}}>
  {input("cs")}{input("en")}
  <p style={{gridColumn:"1/-1",fontSize:13,opacity:.8,margin:0}}>
   {required?"Oba texty jsou povinné, každý má 200–800 znaků.":"U historických profilů lze doplnit chybějící překlady. Pro dokončení redakčního úkolu se vyžadují oba texty (200–800 znaků)."}
  </p>
 </div>;
}
