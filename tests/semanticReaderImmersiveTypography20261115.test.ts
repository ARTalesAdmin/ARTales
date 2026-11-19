import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {chooseSemanticParagraphBreak} from "../lib/semantic/readerProjection";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("general continuation last line stays natural rather than spaced across whole width",()=>{
 const css=read("components/reader/semantic-public-reader.css");
 assert.match(css,/p\.semantic-reader__fragment:not\(\.semantic-reader__fragment--final\)\{\s*text-align-last:start/);
 assert.doesNotMatch(css,/p\.semantic-reader__fragment:not\(\.semantic-reader__fragment--final\)\{\s*text-align-last:justify/);
});
test("semicolon near measured boundary wins over following ordinary whitespace",()=>{
 const left="word ".repeat(18)+"; ";
 const right="after ".repeat(20);
 const raw=left+right;
 const end=chooseSemanticParagraphBreak(raw,0,105,raw.length,true,30);
 assert(end!==null);
 assert(raw.slice(0,end).trimEnd().endsWith(";"),"semicolon was not chosen near edge");
 assert.equal(raw.slice(0,end)+raw.slice(end),raw,"source remains untouched");
});
test("early punctuation cannot force mostly empty page when prose fits further",()=>{
 const left="phrase ".repeat(7)+"; ";
 const raw=left+"text ".repeat(65);
 const end=chooseSemanticParagraphBreak(raw,0,170,raw.length,true,30);
 assert(end!==null);
 assert(end>=130,"punctuation must not discard nearly half a page");
});
test("fullscreen and desktop/mobile use existing canonical Reader without affecting classic defaults",()=>{
 const client=read("components/reader/SemanticReaderClient.tsx");
 const toolbar=read("components/reader/ReaderToolbar.tsx");
 const css=read("components/reader/semantic-public-reader.css");
 const defaults=read("lib/reader/readerSettings.ts");
 assert.match(client,/root\.requestFullscreen\(\)/);
 assert.match(client,/document\.exitFullscreen\(\)/);
 assert.match(client,/fullscreenchange/);
 assert.match(client,/window\.innerWidth>=860\?"spread":"pagedFlow"/);
 assert.match(client,/settings\.layoutMode==="spread"&&viewport\.width>=860/);
 assert.match(client,/immersive\?" artales-reader--immersive"/);
 assert.match(client,/const scrollTarget=immersive\?readerRootRef\.current:window/);
 assert.match(client,/saveReaderSettings\(\{\.\.\.settings,layoutMode:legacyLayout\}\)/);
 assert.match(client,/artales-semantic-layout-mode/);
 assert.match(client,/protectedTerms=EMPTY_PROTECTED_TERMS,visuals=EMPTY_VISUALS/);
 assert.match(toolbar,/onToggleFullscreen\?: \(\) => void/);
 assert.match(css,/artales-reader--semantic:fullscreen/);
 assert.match(css,/scrollbar-width:thin/);
 assert.match(defaults,/layoutMode: "pagedFlow"/,"classic reader settings must remain unchanged");
});

test("native fullscreen does not change page dimensions or hide the bottom of sheets",()=>{
 const css=read("components/reader/semantic-public-reader.css");
 const client=read("components/reader/SemanticReaderClient.tsx");
 const projection=read("lib/semantic/readerProjection.ts");
 assert.match(client,/const immersive=nativeFullscreen/);
 assert.doesNotMatch(client,/artales-semantic-immersive/);
 assert.match(client,/const pageHeight=Math\.round\(pageWidth\*1\.414\)/);
 assert.match(css,/:fullscreen\{/);
 assert.match(css,/overflow-x:hidden;overflow-y:auto/);
 const fs=css.slice(css.indexOf("/* Browser fullscreen is orthogonal"));
 assert.doesNotMatch(fs,/grid-template-rows:|overflow:hidden!important|\.semantic-public-reader__paper\{/);
 assert.match(projection,/const terminal=before\.replace/);
 assert.match(projection,/const fullest=check\(bestIndex\)/);
 assert.match(projection,/const whitespace=\[/);
});
