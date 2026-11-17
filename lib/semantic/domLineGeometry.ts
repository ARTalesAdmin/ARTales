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
 /** Natural x positions of sentence markers in this physical row. */
 punctuationCuts?:ReadonlyArray<{sourceEnd:number;fill:number}>;
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
 const computedLineHeight=Number.parseFloat(getComputedStyle(paragraph).lineHeight);
 let node:Node|null;
 let sourceCursor=sourceStart;
 const rows:Array<{top:number;bottom:number;right:number;words:number;sourceEnd:number;
  punctuationCuts:Array<{sourceEnd:number;fill:number}>}>=[];
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
      sourceEnd:sourceCursor+word.end,punctuationCuts:[]};
     rows.push(row);
    }
    row.bottom=Math.max(row.bottom,rect.bottom);
    row.right=Math.max(row.right,rect.right);
    row.sourceEnd=Math.max(row.sourceEnd,sourceCursor+word.end);
    row.words++;
   }
  }
  // A punctuation cut is permitted only at a measured source-word boundary.
  // The ink width includes any following closing quotation mark.
  for(const mark of text.matchAll(/[.;][”’"')\]]*/gu)){
   const end=mark.index!+mark[0].length;
   const range=document.createRange();
   range.setStart(node,mark.index!);range.setEnd(node,end);
   const rect=[...range.getClientRects()].filter(r=>r.width>.2).at(-1);
   if(!rect)continue;
   const row=rows.find(item=>Math.abs(item.top-rect.top)<=1.5);
   if(row)row.punctuationCuts.push({sourceEnd:sourceCursor+end,
    fill:Math.max(0,Math.min(1,(rect.right-box.left)/box.width))});
  }
  sourceCursor+=text.length;
 }
 return rows.sort((a,b)=>a.top-b.top).map((row,index)=>({
  top:row.top-box.top,
  // Use the line BOX, not merely the glyph ink. Candidate fragments are
  // independently checked against their rendered CSS height before acceptance.
  bottom:Number.isFinite(computedLineHeight)&&computedLineHeight>0?
   Math.max(row.bottom-box.top,Math.min(box.height,(index+1)*computedLineHeight)):
   row.bottom-box.top,
  fill:Math.max(0,Math.min(1,(row.right-box.left)/box.width)),
  words:row.words,
  sourceEnd:row.sourceEnd,
  punctuationCuts:row.punctuationCuts,
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
