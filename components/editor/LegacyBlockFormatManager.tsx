"use client";
import {useState, useTransition, type CSSProperties} from "react";
import {WORK_BLOCK_TYPES,WORK_BLOCK_TYPE_META,type WorkBlockType} from "@/lib/blocks";
import {
 DEFAULT_LEGACY_BLOCK_STYLES,legacyBlockStyleVars,
 type LegacyBlockStyle,type LegacyBlockStyleMap
} from "@/lib/rendering/legacyBlockStyles";

type Props={
 initialStyles:LegacyBlockStyleMap;
 save:(type:string,style:LegacyBlockStyle)=>Promise<{ok:boolean;message:string}>;
};
const label:Record<keyof LegacyBlockStyle,string>={
 font_family:"Písmo",font_size_em:"Velikost (násobek základní)",line_height:"Řádkování",
 text_align:"Zarovnání",text_indent_em:"Odsazení prvního řádku (em)",
 space_before_em:"Mezera před (em)",space_after_em:"Mezera za (em)",
 hyphenation:"Dělení slov",page_break_before:"Začít na nové stránce",
 own_page:"Samostatná stránka",keep_together:"Držet blok pohromadě",
};
const numericFields=[
 ["font_size_em",.7,2.8,.05],["line_height",1,2.6,.05],
 ["text_indent_em",0,4,.1],["space_before_em",0,7,.1],["space_after_em",0,7,.1],
] as const;
const families={serif:"Patkové (Georgia)",sans:"Bezpatkové (Arial)",mono:"Neproporcionální"};
const aligns={left:"Vlevo",center:"Na střed",right:"Vpravo",justify:"Do bloku"};
const hyphens={none:"Bez dělení",manual:"Pouze ruční",auto:"Automaticky"};
const control:CSSProperties={width:"100%",minHeight:38,border:"1px solid #b6ab9d",borderRadius:8,padding:"6px 8px",background:"#fff",color:"#28221d"};
export default function LegacyBlockFormatManager({initialStyles,save}:Props){
 const [selected,setSelected]=useState<WorkBlockType>("paragraph");
 const [styles,setStyles]=useState<LegacyBlockStyleMap>(initialStyles);
 const [saved,setSaved]=useState<LegacyBlockStyleMap>(initialStyles);
 const [pending,startTransition]=useTransition();
 const [feedback,setFeedback]=useState("");
 const current=styles[selected];
 const dirty=JSON.stringify(current)!==JSON.stringify(saved[selected]);
 const update=<K extends keyof LegacyBlockStyle>(field:K,value:LegacyBlockStyle[K])=>{
  setStyles(prev=>({...prev,[selected]:{...prev[selected],[field]:value}}));
  setFeedback("");
 };
 const select=(type:WorkBlockType)=>{setSelected(type);setFeedback("")};
 const doSave=()=>{
  const type=selected,style={...current};
  startTransition(async()=>{
    const result=await save(type,style);
    if(result.ok)setSaved(prev=>({...prev,[type]:style}));
    setFeedback(result.message);
  });
 };
 const previewText=selected==="poem"?"V dáli šumí starý les,\nvítr si šeptá svoji píseň."
  :selected==="chapter"?"KAPITOLA PRVNÍ — ZAČÁTEK"
  :selected==="separator"?"* * *"
  :"Toto je orientační ukázka sazby zvoleného typu bloku. Jeho výsledný vzhled v Readeru respektuje nastavené písmo, velikost, mezery, řádkování, zarovnání a odsazení.";
 return <div style={{display:"grid",gridTemplateColumns:"minmax(190px,260px) minmax(0,1fr)",gap:20,alignItems:"start"}}>
  <aside aria-label="Typy bloků" style={{border:"1px solid #d5c7b7",borderRadius:12,padding:10,display:"grid",gap:4,maxHeight:750,overflowY:"auto"}}>
   {WORK_BLOCK_TYPES.map(type=><button type="button" key={type} onClick={()=>select(type)}
    aria-current={selected===type?"true":undefined}
    style={{textAlign:"left",border:"1px solid "+(selected===type?"#8e714c":"transparent"),
      background:selected===type?"#efe4d6":"transparent",padding:9,borderRadius:7,
      cursor:"pointer",color:"#29231d",fontWeight:selected===type?700:400}}>
    {WORK_BLOCK_TYPE_META[type].internalLabel}{JSON.stringify(styles[type])!==JSON.stringify(saved[type])?" •":""}
   </button>)}
  </aside>
  <section style={{minWidth:0,display:"grid",gap:16}}>
   <div>
    <h2 style={{margin:"0 0 6px",fontFamily:"Georgia,serif",fontSize:24}}>{WORK_BLOCK_TYPE_META[selected].internalLabel}</h2>
    <p style={{margin:0,opacity:.8}}>{WORK_BLOCK_TYPE_META[selected].internalHelp}</p>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
    <label style={{display:"grid",gap:5,fontSize:14}}>{label.font_family}
     <select style={control} value={current.font_family} onChange={e=>update("font_family",e.target.value as LegacyBlockStyle["font_family"])}>
      {Object.entries(families).map(([v,l])=><option value={v} key={v}>{l}</option>)}
     </select>
    </label>
    <label style={{display:"grid",gap:5,fontSize:14}}>{label.text_align}
     <select style={control} value={current.text_align} onChange={e=>update("text_align",e.target.value as LegacyBlockStyle["text_align"])}>
      {Object.entries(aligns).map(([v,l])=><option value={v} key={v}>{l}</option>)}
     </select>
    </label>
    <label style={{display:"grid",gap:5,fontSize:14}}>{label.hyphenation}
     <select style={control} value={current.hyphenation} onChange={e=>update("hyphenation",e.target.value as LegacyBlockStyle["hyphenation"])}>
      {Object.entries(hyphens).map(([v,l])=><option value={v} key={v}>{l}</option>)}
     </select>
    </label>
    {numericFields.map(([field,min,max,step])=><label key={field} style={{display:"grid",gap:5,fontSize:14}}>
     {label[field]}
     <input style={control} type="number" min={min} max={max} step={step} value={current[field]}
      onChange={e=>update(field,Number(e.target.value))}/>
    </label>)}
   </div>
   <fieldset style={{border:"1px solid #d5c7b7",borderRadius:10,padding:12,display:"grid",gap:10}}>
    <legend>Chování při stránkování</legend>
    {(["page_break_before","own_page","keep_together"] as const).map(field=>
     <label key={field} style={{display:"flex",gap:8,alignItems:"center"}}>
      <input type="checkbox" checked={current[field]} onChange={e=>update(field,e.target.checked)}/>
      {label[field]}
     </label>)}
    <small>Starý Reader používá váhové odhady. U příliš dlouhého bloku musí dát přednost dostupnosti textu před nedělitelnou stránkou.</small>
   </fieldset>
   <div style={{border:"1px solid #d5c7b7",borderRadius:12,padding:20,background:"#f8f4ec"}}>
    <strong>Orientační náhled</strong>
    <div style={{...legacyBlockStyleVars(current),fontFamily:"var(--artales-block-font)",
      fontSize:`calc(18px * ${current.font_size_em})`,lineHeight:current.line_height,
      textAlign:current.text_align,marginTop:current.space_before_em+"em",
      marginBottom:current.space_after_em+"em",textIndent:current.text_indent_em+"em",
      hyphens:current.hyphenation,whiteSpace:selected==="poem"?"pre-wrap":"normal",
      overflowWrap:"break-word",color:"#29231d"}}>
      {previewText}
    </div>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
    <button type="button" disabled={pending||!dirty} onClick={doSave}
     style={{...control,width:"auto",padding:"9px 20px",background:"#27211d",color:"#fff",cursor:"pointer"}}>
     {pending?"Ukládám…":"Uložit formát"}
    </button>
    <button type="button" disabled={pending} onClick={()=>{
      setStyles(prev=>({...prev,[selected]:{...DEFAULT_LEGACY_BLOCK_STYLES[selected]}}));setFeedback("");
    }} style={{...control,width:"auto",padding:"9px 18px",cursor:"pointer"}}>Výchozí hodnoty</button>
    {dirty?<span role="status">Neuložené změny</span>:null}
    {feedback?<span role="status">{feedback}</span>:null}
   </div>
  </section>
 </div>;
}
