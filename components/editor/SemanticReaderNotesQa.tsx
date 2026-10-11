"use client";

import {useEffect,useRef,useState} from "react";
import {getPublicDictionary} from "@/lib/i18n/public";
import {readerNoteColors,type ReaderNoteColor} from "@/lib/reader/readerStorage";
import type {SessionReaderNote} from "@/lib/semantic/qaNoteSession";

const labels=getPublicDictionary("cs").reader;

/** Same user flow as ReaderToolbar notes, but no persistence or production actions.
 * Kept isolated from the production Reader until main-thread integration.
 */
export type QaLocatedNote={saved:SessionReaderNote;pageIndex:number|null;unitId:string|null};
type Props={
  notes:QaLocatedNote[];
  selectedNoteId:string|null;
  selectedNoteIndex:number;
  listExpanded:boolean;
  canAddNote:boolean;
  status:string;
  onAdd:(input:{title:string;body:string;color:ReaderNoteColor})=>boolean;
  onGoTo:(saved:SessionReaderNote)=>void;
  onPrevious:()=>void;
  onNext:()=>void;
  onListExpanded:(next:boolean)=>void;
  onDelete:(saved:SessionReaderNote)=>void;
};

export default function SemanticReaderNotesQa(props:Props){
  const [menuOpen,setMenuOpen]=useState(false);
  const [formOpen,setFormOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [color,setColor]=useState<ReaderNoteColor>("gold");
  const menuRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const selected=props.notes.find(item=>item.saved.note.id===props.selectedNoteId);
  const selectedIndex=props.selectedNoteIndex;

  useEffect(()=>{
    if(!menuOpen)return;
    const closeOutside=(event:MouseEvent)=>{
      if(!menuRef.current?.contains(event.target as Node))setMenuOpen(false);
    };
    const closeEscape=(event:KeyboardEvent)=>{
      if(event.key!=="Escape")return;
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown",closeOutside);
    document.addEventListener("keydown",closeEscape);
    return()=>{
      document.removeEventListener("mousedown",closeOutside);
      document.removeEventListener("keydown",closeEscape);
    };
  },[menuOpen]);

  return <nav className="semantic-reader__notes-toolbar" aria-label="Poznámky čtenáře (QA)">
    <div className="semantic-reader__notes-menu" ref={menuRef}>
      <button ref={triggerRef} type="button" className="semantic-reader__notes-trigger"
        aria-expanded={menuOpen} aria-controls="semantic-reader-note-menu"
        onClick={()=>setMenuOpen(v=>!v)}>
        <span aria-hidden="true">•••</span> {labels.notes}
        {props.notes.length>0&&<span className="semantic-reader__notes-count">{props.notes.length}</span>}
      </button>
      {menuOpen&&<section id="semantic-reader-note-menu" className="semantic-reader__notes-panel"
        aria-label={labels.notes}>
        <div className="semantic-reader__notes-title">
          <strong>{labels.notes}</strong><small>Pouze QA · bez uložení do účtu</small>
        </div>
        <div className="artales-reader-notes__heading">
          <button type="button" onClick={()=>setFormOpen(open=>!open)}
            aria-expanded={formOpen} disabled={!props.canAddNote}>{labels.addNote}</button>
          <span>Jen v této relaci</span>
        </div>
        {!props.canAddNote&&<p className="semantic-reader__notes-hint">
          Posuň se na text díla. Titulní list nemá literární kotvu.
        </p>}
        {formOpen&&<form className="artales-reader-note-form" onSubmit={event=>{
          event.preventDefault();
          if(!props.onAdd({title,body,color}))return;
          setTitle("");setBody("");setFormOpen(false);
        }}>
          <label>{labels.noteTitle}<input maxLength={160} value={title}
            onChange={event=>setTitle(event.target.value)} /></label>
          <label>{labels.noteBody}<textarea maxLength={4000} rows={3} value={body}
            onChange={event=>setBody(event.target.value)}/></label>
          <label>{labels.noteColor}<select value={color}
            onChange={event=>setColor(event.target.value as ReaderNoteColor)}>
            {readerNoteColors.map(value=><option value={value} key={value}>{labels.noteColors[value]}</option>)}
          </select></label>
          <button type="submit" disabled={!props.canAddNote}>{labels.saveNote}</button>
        </form>}
        <div className="artales-reader-notes__navigation" aria-label={labels.noteNavigation}>
          <button type="button" onClick={props.onPrevious} disabled={selectedIndex<=0}
            aria-label={labels.previousNote}>‹</button>
          <span aria-live="polite">{props.notes.length?String(selectedIndex+1)+" / "+props.notes.length:"0 / 0"}</span>
          <button type="button" onClick={props.onNext}
            disabled={selectedIndex<0||selectedIndex>=props.notes.length-1}
            aria-label={labels.nextNote}>›</button>
        </div>
        {!props.listExpanded&&selected&&<div className="artales-reader-notes__selected-summary"
          aria-live="polite">
          <span className={"artales-reader-note-color artales-reader-note-color--"+selected.saved.note.color} aria-hidden="true"/>
          <div><strong>{selected.saved.note.title||labels.page+" "+((selected.pageIndex??0)+1)}</strong>
            <small>{labels.page} {selected.pageIndex===null?"—":selected.pageIndex+1}</small></div>
        </div>}
        {props.notes.length>0?
          <button type="button" className="artales-reader-notes__list-toggle"
            onClick={()=>props.onListExpanded(!props.listExpanded)}
            aria-expanded={props.listExpanded} aria-controls="semantic-reader-all-notes">
            {labels.allNotes} ({props.notes.length}) <span aria-hidden="true">{props.listExpanded?"−":"+"}</span>
          </button>:<h3>{labels.allNotes}</h3>}
        {props.notes.length&&props.listExpanded?
          <ul id="semantic-reader-all-notes" className="artales-reader-notes__list">
            {props.notes.map(({saved,pageIndex})=>{
              const note=saved.note;
              const name=note.title||labels.page+" "+((pageIndex??0)+1);
              const active=note.id===props.selectedNoteId;
              return <li key={note.id} className={active?"artales-reader-notes__item--selected":undefined}
                aria-current={active?"location":undefined}>
                <span className={"artales-reader-note-color artales-reader-note-color--"+note.color}
                  aria-hidden="true"/>
                <div className="semantic-reader__note-detail">
                  <strong>{name}</strong>
                  {note.body&&<p>{note.body}</p>}
                  <small>{labels.page} {pageIndex===null?"—":pageIndex+1}</small>
                </div>
                <div className="artales-reader-notes__actions">
                  <button type="button" onClick={()=>props.onGoTo(saved)}>{labels.goToNote}</button>
                  <button type="button" aria-label={labels.deleteNote+": "+name}
                    onClick={()=>props.onDelete(saved)}>{labels.deleteNote}</button>
                </div>
              </li>;
            })}
          </ul>:<p className="artales-reader-notes__empty">{labels.noNotes}</p>}
        <p className="semantic-reader__notes-status" role="status" aria-live="polite">{props.status}</p>
      </section>}
    </div>
  </nav>;
}
