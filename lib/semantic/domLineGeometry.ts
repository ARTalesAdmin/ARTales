import {semanticWordRanges} from "./protectedSpans";

/** Physical words/rows measured from one rendered DOM paragraph.
 * sourceEnd is the UTF-16 offset immediately after the final ink-bearing word
 * in the ORIGINAL atom (display transformations preserve code-unit lengths).
 * The geometry is relative to the paragraph box. The caller measures the
 * unfragmented remainder with text-align:start to obtain NATURAL line fill.
 */
export type SemanticDomRow={
 top:number;
 bottom:number;
 fill:number;
 words:number;
 sourceEnd:number;
};

export type SemanticDomLastRow={
 top:number;
 right:number;
 words:number;
 fill:number;
};

export function measureSemanticDomRows(
 paragraph:HTMLElement,sourceStart=0,textRoot:Node=paragraph,
):SemanticDomRow[]{
 const box=paragraph.getBoundingClientRect();
 if(!Number.isFinite(box.width)||box.width<=0)return [];
 const walker=document.createTreeWalker(textRoot,NodeFilter.SHOW_TEXT);
 let node:Node|null;
 let sourceCursor=sourceStart;
 const rows:Array<{top:number;bottom:number;right:number;words:number;sourceEnd:number}>=[];
 while((node=walker.nextNode())){
  const text=node.textContent??"";
  for(const word of semanticWordRanges(text)){
   const range=document.createRange();
   range.setStart(node,word.start);
   range.setEnd(node,word.end);
   const rects=range.getClientRects();
   for(const rect of rects){
    if(rect.width<=.2||rect.height<=.2)continue;
    let row=rows.find(item=>Math.abs(item.top-rect.top)<=1.5);
    if(!row){
     row={top:rect.top,bottom:rect.bottom,right:rect.right,words:0,
      sourceEnd:sourceCursor+word.end};
     rows.push(row);
    }
    row.bottom=Math.max(row.bottom,rect.bottom);
    row.right=Math.max(row.right,rect.right);
    row.sourceEnd=Math.max(row.sourceEnd,sourceCursor+word.end);
    row.words++;
   }
  }
  sourceCursor+=text.length;
 }
 return rows.sort((a,b)=>a.top-b.top).map(row=>({
  top:row.top-box.top,
  bottom:row.bottom-box.top,
  fill:Math.max(0,Math.min(1,(row.right-box.left)/box.width)),
  words:row.words,
  sourceEnd:row.sourceEnd,
 }));
}

export function measureSemanticDomLastRow(element:HTMLElement):SemanticDomLastRow|null{
 const box=element.getBoundingClientRect();
 const root=element.querySelector(".semantic-reader__atom")??element;
 const rows=measureSemanticDomRows(element,0,root);
 const last=rows.at(-1);
 if(!last)return null;
 return {top:box.top+last.top,
  right:box.left+last.fill*box.width,
  words:last.words,fill:last.fill};
}
