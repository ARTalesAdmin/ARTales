"use client";
import {useState,useTransition} from "react";
import {WORK_BLOCK_TYPES,WORK_BLOCK_TYPE_META,type WorkBlockType} from "@/lib/blocks";
import {DEFAULT_LEGACY_BLOCK_STYLES,type LegacyBlockStyle,type LegacyBlockStyleMap} from "@/lib/rendering/legacyBlockStyles";
import LegacyBlockSpreadPreview from "./LegacyBlockSpreadPreview";
import "./legacy-block-format-manager.css";

type Props={initialStyles:LegacyBlockStyleMap;save:(type:string,style:LegacyBlockStyle)=>Promise<{ok:boolean;message:string}>};
const families={serif:"Patkové (Georgia)",sans:"Bezpatkové (Arial)",mono:"Psací stroj"};
const aligns={left:"Vlevo",center:"Na střed",right:"Vpravo",justify:"Do bloku"};
const weights={400:"Normální",500:"Střední",600:"Polotučné",700:"Tučné"};
const styles={normal:"Běžné písmo",italic:"Kurzíva"};
const numbers=[
 {field:"font_size_em",title:"Velikost písma",min:.7,max:2.8,step:.05,hint:"1 = běžná velikost"},
 {field:"line_height",title:"Řádkování",min:1,max:2.6,step:.05,hint:"Vyšší číslo = větší odstup řádků"},
 {field:"text_indent_em",title:"Odsazení prvního řádku",min:0,max:4,step:.1,hint:"0 = bez odsazení"},
 {field:"space_before_em",title:"Mezera před blokem",min:0,max:7,step:.1,hint:"0 = bez mezery"},
 {field:"space_after_em",title:"Mezera za blokem",min:0,max:7,step:.1,hint:"0 = bez mezery"},
] as const;
const pageChoices=[
 {field:"page_break_before",title:"Začít na nové stránce",detail:"Blok nezačne na konci předchozí strany."},
 {field:"own_page",title:"Samostatná stránka",detail:"Následující blok až na další stránce."},
 {field:"keep_together",title:"Držet pohromadě",detail:"Nedělit blok, pokud se vejde."},
] as const;
export default function LegacyBlockFormatManager({initialStyles,save}:Props){
 const [selected,setSelected]=useState<WorkBlockType>("paragraph");
 const [values,setValues]=useState<LegacyBlockStyleMap>(initialStyles);
 const [saved,setSaved]=useState<LegacyBlockStyleMap>(initialStyles);
 const [busy,startTransition]=useTransition();
 const [feedback,setFeedback]=useState("");
 const current=values[selected];
 const changed=JSON.stringify(current)!==JSON.stringify(saved[selected]);
 function update<K extends keyof LegacyBlockStyle>(field:K,value:LegacyBlockStyle[K]){
  setValues(v=>({...v,[selected]:{...v[selected],[field]:value}}));
  setFeedback("");
 }
 function saveCurrent(){
  const type=selected,style={...current};
  startTransition(async()=>{
   try{
    const result=await save(type,style);
    if(result.ok)setSaved(v=>({...v,[type]:style}));
    setFeedback(result.message);
   }catch{setFeedback("Uložení se nepodařilo. Zkus to znovu.");}
  });
 }
 return <div className="legacy-format-manager">
  <aside className="legacy-format-manager__sidebar" aria-label="Typy bloků">
   <header className="legacy-format-manager__sidebar-head">
    <p className="ed-eyebrow">Struktura knihy</p>
    <h2>Typy bloků</h2>
    <p>Vyber typ textu a nastav jeho společný vzhled.</p>
   </header>
   <div className="legacy-format-manager__items">
    {WORK_BLOCK_TYPES.map(type=><button key={type} type="button"
     className={"legacy-format-manager__item"+(selected===type?" is-selected":"")}
     aria-pressed={selected===type} onClick={()=>{setSelected(type);setFeedback("");}}>
     <span>{WORK_BLOCK_TYPE_META[type].internalLabel}</span>
     {JSON.stringify(values[type])!==JSON.stringify(saved[type])
      ?<span aria-label="Neuložené změny" className="legacy-format-manager__dot">●</span>:null}
    </button>)}
   </div>
  </aside>
  <div className="legacy-format-manager__main">
   <section className="ed-card legacy-format-manager__settings">
    <header className="legacy-format-manager__heading">
     <div><p className="ed-eyebrow">Výchozí formát</p>
      <h2>{WORK_BLOCK_TYPE_META[selected].internalLabel}</h2>
      <p>{WORK_BLOCK_TYPE_META[selected].internalHelp}</p>
     </div>{changed?<span className="legacy-format-manager__unsaved">Neuložené změny</span>:null}
    </header>
    <div className="legacy-format-manager__section">
     <h3>Písmo a zarovnání</h3>
     <div className="legacy-format-manager__fields">
      <label className="legacy-format-manager__field">Písmo
       <select value={current.font_family} onChange={e=>update("font_family",e.target.value as LegacyBlockStyle["font_family"])}>
        {Object.entries(families).map(([v,name])=><option key={v} value={v}>{name}</option>)}
       </select>
      </label>
      <label className="legacy-format-manager__field">Tučnost
       <select value={current.font_weight} onChange={e=>update("font_weight",Number(e.target.value) as LegacyBlockStyle["font_weight"])}>
        {Object.entries(weights).map(([v,name])=><option key={v} value={v}>{name}</option>)}
       </select>
      </label>
      <label className="legacy-format-manager__field">Řez písma
       <select value={current.font_style} onChange={e=>update("font_style",e.target.value as LegacyBlockStyle["font_style"])}>
        {Object.entries(styles).map(([v,name])=><option key={v} value={v}>{name}</option>)}
       </select>
      </label>
      <label className="legacy-format-manager__field">Zarovnání
       <select value={current.text_align} onChange={e=>update("text_align",e.target.value as LegacyBlockStyle["text_align"])}>
        {Object.entries(aligns).map(([v,name])=><option key={v} value={v}>{name}</option>)}
       </select>
      </label>
     </div>
    </div>
    <div className="legacy-format-manager__section">
     <h3>Velikost a mezery</h3>
     <p className="legacy-format-manager__help">Hodnoty jsou přizpůsobivé:
      <strong> 1 </strong>odpovídá aktuální velikosti písma.
      Při zvětšení textu čtenářem se odstupy také zvětšují.</p>
     <div className="legacy-format-manager__fields legacy-format-manager__fields--numbers">
      {numbers.map(({field,title,min,max,step,hint})=><label className="legacy-format-manager__field" key={field}>
       {title}
       <input type="number" min={min} max={max} step={step} value={current[field]}
        onChange={e=>update(field,Number(e.target.value))}/>
       <small>{hint}</small>
      </label>)}
     </div>
    </div>
   </section>
   <fieldset className="ed-card legacy-format-manager__behavior">
    <legend>Chování při stránkování</legend>
    <div className="legacy-format-manager__choices">
     {pageChoices.map(({field,title,detail})=><label key={field} className="legacy-format-manager__choice">
      <input type="checkbox" checked={current[field]} onChange={e=>update(field,e.target.checked)}/>
      <span><strong>{title}</strong><small>{detail}</small></span>
     </label>)}
    </div>
    <p>Čtečka měří skutečné řádky, pokud má platnou geometrii. Při chybě měření
     použije bezpečnou náhradní cestu; obsah nikdy nesmí zmizet.</p>
   </fieldset>
   <LegacyBlockSpreadPreview blockType={selected} style={current}/>
   <div className="legacy-format-manager__footer">
    <button type="button" className="ed-button" disabled={busy||!changed} onClick={saveCurrent}>
     {busy?"Ukládám…":"Uložit formát"}
    </button>
    <button type="button" className="ed-button ed-button--soft" disabled={busy}
     onClick={()=>{setValues(v=>({...v,[selected]:{...DEFAULT_LEGACY_BLOCK_STYLES[selected]}}));setFeedback("");}}>
     Obnovit výchozí hodnoty
    </button>
    <span role="status" aria-live="polite">{feedback}</span>
   </div>
  </div>
 </div>;
}
