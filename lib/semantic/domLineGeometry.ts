import {semanticWordRanges} from "./protectedSpans";

/** One Chromium line-box measurement for the hidden fitting sheet and visible page.
 * All measurements are made on word ranges, NEVER on a multi-line text node's
 * aggregate Range rectangles or CSS-justified text. Call with final-row
 * justification disabled so the reported fill is natural ink, not expanded ink.
 */
export type SemanticDomLastRow={
  top:number;
  right:number;
  words:number;
  fill:number;
};

export function measureSemanticDomLastRow(element:HTMLElement):SemanticDomLastRow|null{
 const box=element.getBoundingClientRect();
 if(!Number.isFinite(box.width)||box.width<=0)return null;
 const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
 let node:Node|null;
 const rows:Array<{top:number;right:number;words:number}>=[];
 while((node=walker.nextNode())){
  const text=node.textContent??"";
  for(const word of semanticWordRanges(text)){
   const range=document.createRange();
   range.setStart(node,word.start);
   range.setEnd(node,word.end);
   const boxes=range.getClientRects();
   for(const rect of boxes){
    if(rect.width<=.2||rect.height<=.2)continue;
    let row=rows.find(item=>Math.abs(item.top-rect.top)<=1.5);
    if(!row){row={top:rect.top,right:rect.right,words:0};rows.push(row);}
    row.right=Math.max(row.right,rect.right);
    row.words++;
   }
  }
 }
 if(!rows.length)return null;
 const last=rows.reduce((a,b)=>a.top>b.top?a:b);
 return {top:last.top,right:last.right,words:last.words,
  fill:Math.max(0,Math.min(1,(last.right-box.left)/box.width))};
}
