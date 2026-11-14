"use client";
import {useFormStatus} from "react-dom";
import type {ReactNode,CSSProperties} from "react";

/** Disable duplicate server-action submission and expose an accessible pending state. */
export default function EditorialPendingButton({children,pendingLabel="Zpracovávám…",
 className="ed-button",disabled=false,style}:{
 children:ReactNode;pendingLabel?:string;className?:string;disabled?:boolean;style?:CSSProperties
}){
 const {pending}=useFormStatus();
 return <>
  <button type="submit" className={className} style={style} disabled={pending||disabled}
   aria-disabled={pending||disabled} aria-busy={pending}>
   {pending?pendingLabel:children}
  </button>
  {pending?<span role="status" aria-live="polite" style={{fontSize:13,opacity:.8}}>
   Ukládám změny. Není třeba klikat znovu.
  </span>:null}
 </>;
}
