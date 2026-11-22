"use client";
import type {ReactNode} from "react";
import type {WorkBlockType} from "@/lib/blocks";
import {WORK_BLOCK_TYPE_META} from "@/lib/blocks";
import {legacyBlockStyleVars,type LegacyBlockStyle} from "@/lib/rendering/legacyBlockStyles";
import "./legacy-block-format-spread.css";

type Props={blockType:WorkBlockType;style:LegacyBlockStyle};

function sample(type:WorkBlockType):ReactNode {
 switch(type){
  case "book_part": return <h3>ČÁST PRVNÍ</h3>;
  case "chapter": return <h3>KAPITOLA I — NOVÉ CESTY</h3>;
  case "headline": return <h3>Malý příběh velkého světa</h3>;
  case "poem": return <p className="legacy-format-spread__poem">Za horami světlo vstává,{"\n"}vítr v korunách si hrává,{"\n"}další řádek do dáli zní.</p>;
  case "quote": return <blockquote>„Kniha nám otevírá místa, kam se jinak nedostaneme.“</blockquote>;
  case "letter": return <><p>Milá přítelkyně,</p><p>píši Ti několik řádků ze své cesty. Každé ráno přináší nový příběh.</p></>;
  case "newspaper_article": return <><h3>Zprávy z města</h3><p>Včerejší události přinesly změnu, kterou málokdo očekával.</p></>;
  case "place_line": return <p>Praha, jaro 1897</p>;
  case "separator": return <p>✦ &nbsp; ✦ &nbsp; ✦</p>;
  case "note": return <><strong>Poznámka</strong><p>Vysvětlující doplnění k vybranému úseku textu.</p></>;
  case "footnote": return <p><sup>1</sup> &nbsp; Doplňující informace pod čarou.</p>;
  case "dedication": return <p>Věnováno všem, kteří nikdy nepřestali číst.</p>;
  case "preface": return <><h3>PŘEDMLUVA</h3><p>Na úvod tohoto vydání několik slov.</p></>;
  case "afterword": return <><h3>DOSLOV</h3><p>Příběh končí, ale jeho ozvěna zůstává.</p></>;
  case "acknowledgement": return <p>Poděkování všem, kdo se na vydání podíleli.</p>;
  case "image": return <figure className="legacy-format-spread__image"><div aria-hidden="true">▧</div><figcaption>Ilustrace a popisek</figcaption></figure>;
  case "table": return <table aria-label="Ukázková tabulka"><tbody><tr><th>Rok</th><th>Událost</th></tr><tr><td>1897</td><td>První vydání</td></tr><tr><td>1902</td><td>Další příběh</td></tr></tbody></table>;
  default: return <p>Byl jednou jeden příběh, který začínal docela obyčejně. Za první větou však čekalo celé dobrodružství. Na každé stránce přibývala další slova.</p>;
 }
}

export default function LegacyBlockSpreadPreview({blockType,style}:Props){
 // This is a truthful illustration of explicit page policies, not a simulation
 // of the legacy Reader's approximate pixel capacity.
 const newPage=style.page_break_before||style.own_page;
 const dedicated=style.own_page;
 const styled=<div data-preview-block-type={blockType} className="legacy-format-spread__sample"
   style={legacyBlockStyleVars(style)}>
   {sample(blockType)}
 </div>;
 return <section className="legacy-format-spread" aria-label="Orientační dvoustranný náhled formátu">
  <div className="legacy-format-spread__heading">
    <strong>Dvoustranný náhled</strong>
    <span>Ilustrační sazba · změny se zobrazují okamžitě</span>
  </div>
  <div className="legacy-format-spread__policies">
   <span>{newPage?"Začátek na nové straně":"Navazuje na předchozí text"}</span>
   <span>{dedicated?"Samostatná strana":"Může sdílet stránku"}</span>
   <span>{style.keep_together?"Držet pohromadě, pokud se vejde":"Dělení povoleno"}</span>
  </div>
  <div className="legacy-format-spread__pages">
   <div className="legacy-format-spread__page legacy-format-spread__page--left">
    <div className="legacy-format-spread__page-header">ARTales · ukázkové vydání</div>
    <p className="legacy-format-spread__context">Předcházející odstavec příběhu vyplňuje část strany. Níže pokračuje zvolený blok, pokud jeho formát nevyžaduje novou stranu.</p>
    {!newPage && styled}
    <div className="legacy-format-spread__page-number">— 12 —</div>
   </div>
   <div className="legacy-format-spread__page legacy-format-spread__page--right">
    <div className="legacy-format-spread__page-header">ARTales · ukázkové vydání</div>
    {newPage && styled}
    {!dedicated && <p className="legacy-format-spread__context legacy-format-spread__following">
      Následující text pokračuje dále ve vyprávění. Jeho umístění závisí na tom, kolik místa předchozí blok skutečně zabere.
    </p>}
    {dedicated && <p className="legacy-format-spread__dedicated-note">
      Následující blok se přesune až na další stranu.
    </p>}
    <div className="legacy-format-spread__page-number">— 13 —</div>
   </div>
  </div>
  <p className="legacy-format-spread__disclaimer">
    Náhled používá stejné hodnoty formátu jako starý Reader a ilustruje volby začátku a samostatné stránky.
    Nejde o přesný výpočet zalomení celé knihy. Skutečné stránky jsou v původním Readeru stále sestavovány odhadem.
    {blockType==="poem"?" U poezie jsou v náhledu zachovány řádky.":""}
  </p>
  <span className="legacy-format-spread__sr-only">{WORK_BLOCK_TYPE_META[blockType].internalLabel}</span>
 </section>;
