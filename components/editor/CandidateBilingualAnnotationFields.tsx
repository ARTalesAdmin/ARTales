"use client";
import {useState} from "react";

const min=200,max=800;
function Count({length}:{length:number}){
 const valid=length>=min&&length<=max;
 return <span aria-live="polite" className={"ed-character-count "+(valid?"ed-character-count--valid":"")}>
  {length} / {max} znaků {valid?"✓":length<min?`· zbývá ${min-length}`:"· příliš dlouhé"}
 </span>;
}
export default function CandidateBilingualAnnotationFields({initialCs="",initialEn=""}:{
 initialCs?:string;initialEn?:string
}){
 const [cs,setCs]=useState(initialCs);
 const [en,setEn]=useState(initialEn);
 return <div className="ed-bilingual-fields">
  <div className="ed-bilingual-fields__item">
   <label className="ed-label" htmlFor="candidate-description-cs">Anotace česky <span aria-hidden="true">*</span></label>
   <textarea id="candidate-description-cs" name="description_cs" required
    minLength={min} maxLength={max} rows={7} value={cs}
    onChange={event=>setCs(event.target.value)}
    placeholder="České představení knihy pro čtenáře…"
    aria-describedby="candidate-description-cs-help"/>
   <div className="ed-bilingual-fields__help" id="candidate-description-cs-help">
    <small className="ed-help">Povinné, 200–800 znaků.</small><Count length={cs.trim().length}/>
   </div>
  </div>
  <div className="ed-bilingual-fields__item">
   <label className="ed-label" htmlFor="candidate-description-en">Annotation in English <span aria-hidden="true">*</span></label>
   <textarea id="candidate-description-en" name="description_en" required
    minLength={min} maxLength={max} rows={7} value={en}
    onChange={event=>setEn(event.target.value)}
    placeholder="An original English description for readers…"
    aria-describedby="candidate-description-en-help"/>
   <div className="ed-bilingual-fields__help" id="candidate-description-en-help">
    <small className="ed-help">Required, 200–800 characters.</small><Count length={en.trim().length}/>
   </div>
  </div>
  <small className="ed-help">Obě verze se ukládají společně. Úkol se dokončí až po validaci obou textů.</small>
  <button className="ed-button" type="submit"
   disabled={cs.trim().length<min||cs.trim().length>max||en.trim().length<min||en.trim().length>max}>
   Uložit obě anotace ✓
  </button>
 </div>;
}
