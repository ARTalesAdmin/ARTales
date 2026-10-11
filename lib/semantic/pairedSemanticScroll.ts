import {alignedScrollTop} from "../fixtures/pairedScroll";

export type SemanticMarker={regionIndex:number;top:number};
export type SemanticPaneGeometry={
  markers:readonly SemanticMarker[];
  scrollTop:number;
  clientHeight:number;
  scrollHeight:number;
};

/** Shared source anchors provide symmetric scroll interpolation in either direction. */
export function synchronizeSemanticPanes(source:SemanticPaneGeometry,target:SemanticPaneGeometry):number{
  const sourceMax=Math.max(0,source.scrollHeight-source.clientHeight);
  const targetMax=Math.max(0,target.scrollHeight-target.clientHeight);
  if(sourceMax<=0||targetMax<=0)return 0;
  const map=new Map(target.markers.map(mark=>[mark.regionIndex,mark.top]));
  const ordered=[...source.markers].sort((a,b)=>a.regionIndex-b.regionIndex);
  const xs:number[]=[];
  const ys:number[]=[];
  for(const mark of ordered){
    const mapped=map.get(mark.regionIndex);
    if(mapped===undefined||!Number.isFinite(mapped)||!Number.isFinite(mark.top))continue;
    if((xs.length&&mark.top<=xs.at(-1)!+0.5) ||
      (ys.length&&mapped<ys.at(-1)!-0.5))continue;
    xs.push(Math.max(0,Math.min(mark.top,source.scrollHeight)));
    ys.push(Math.max(0,Math.min(mapped,target.scrollHeight)));
  }
  if(!xs.length)return Math.max(0,Math.min(targetMax,source.scrollTop/sourceMax*targetMax));
  try{
    return alignedScrollTop({
      sourceStarts:xs,targetStarts:ys,sourceScrollTop:source.scrollTop,
      sourceClientHeight:source.clientHeight,sourceScrollHeight:source.scrollHeight,
      targetClientHeight:target.clientHeight,targetScrollHeight:target.scrollHeight,
    });
  }catch{
    // During hydration or responsive remount use bounded proportional sync.
    return Math.max(0,Math.min(targetMax,source.scrollTop/sourceMax*targetMax));
  }
}
