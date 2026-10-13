import test from "node:test";
import assert from "node:assert/strict";
import {
 editorialFlowDefects, claimFlowDemo, finishFlowDemo, flowDemoInboxCount,
 freshFlowDemo, noteFlowDemo, queueFlowDemo, readFlowDemo, repairFlowDemo,
 type EditorialFlowBook,
} from "../lib/fixtures/editorialFlowDemo";
const at="2026-10-13T08:00:00.000Z";
test("candidate -> profile badge -> inbox -> revision -> completion",()=>{
 const queued=queueFlowDemo(freshFlowDemo(),at);
 assert.equal(flowDemoInboxCount(queued),1);
 const active=claimFlowDemo(queued);
 const noted=noteFlowDemo(active,"a:123","Zkontrolovat mezeru",at);
 const amended=repairFlowDemo(noted,"chapter","Opravit vzhled nadpisu",at);
 const done=finishFlowDemo(amended,at);
 assert.equal(done.status,"done");
 assert.equal(flowDemoInboxCount(done),0);
 assert.equal(readFlowDemo(JSON.stringify(done)).repairs.chapter?.text,"Opravit vzhled nadpisu");
});
test("corrupt state, unauthorized edit, empty completion fail closed",()=>{
 assert.throws(()=>repairFlowDemo(freshFlowDemo(),"chapter","Opravit",at));
 assert.throws(()=>finishFlowDemo(claimFlowDemo(queueFlowDemo(freshFlowDemo(),at)),at));
 assert.equal(readFlowDemo("{bad").status,"new");
 const bad={...queueFlowDemo(freshFlowDemo(),at),repairs:{chapter:{text:"foo",recordedAt:at}}};
 assert.equal(readFlowDemo(JSON.stringify(bad)).status,"new");
});
test("full chapter defect anchors are unique and spread across text",()=>{
 const blocks=Array.from({length:14},(_,i)=>({id:"b"+i,kind:i===0?"chapter":"paragraph",original:"text",display:"text",gapBefore:"\n\n",start:i*10,end:i*10+4})) as EditorialFlowBook["blocks"];
 const book:EditorialFlowBook={title:"Alice",author:"Lewis Carroll",sourceLabel:"PG11",blocks,
 sourceTail:"",sourceLength:134,chapterOnly:true,releaseAllowed:false};
 const defects=editorialFlowDefects(book);
 assert.equal(defects.length,3);
 assert.equal(new Set(defects.map(x=>x.blockId)).size,3);
 assert.ok(blocks.findIndex(b=>b.id===defects[2].blockId)>7);
});
