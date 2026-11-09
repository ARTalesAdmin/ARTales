import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("components/editor/semantic-reader-theme.css","utf8");
const base=readFileSync("components/editor/semantic-reader.css","utf8");
const editor=readFileSync("components/editor/SemanticReaderLab.tsx","utf8");
const publicReader=readFileSync("components/reader/reader.css","utf8");
function cssBlock(selector){
 const offset=css.indexOf(selector+" {");
 assert.notEqual(offset,-1,"Missing "+selector);
 const start=css.indexOf("{",offset)+1;
 return css.slice(start,css.indexOf("}",start));
}
function value(block,key){
 const m=block.match(new RegExp("--"+key+":\\s*(#[a-f0-9]{6})\\s*;","i"));
 assert.ok(m,"Missing #hex token "+key);
 return m[1];
}
const channels=x=>x.match(/[a-f0-9]{2}/gi).map(n=>parseInt(n,16)/255);
const lum=hex=>{
 const [r,g,b]=channels(hex.slice(1)).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b;
};
const ratio=(a,b)=>{const [hi,lo]=[lum(a),lum(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);};
test("light and dark semantic QA surfaces use original Reader paper and text",()=>{
 for(const [selector,theme] of [
  [".semantic-reader",".artales-reader--theme-light"],
  ['html[data-artales-theme="dark"] .semantic-reader',".artales-reader--theme-dark"]
 ]){
  const palette=cssBlock(selector);
  const reference=publicReader.slice(publicReader.indexOf(theme+" {"));
  const publicPaper=reference.match(/--reader-paper:\s*(#[a-f0-9]{6})/i)?.[1];
  const publicText=reference.match(/--reader-paper-text:\s*(#[a-f0-9]{6})/i)?.[1];
  assert.equal(value(palette,"qa-paper"),publicPaper);
  assert.equal(value(palette,"qa-ink"),publicText);
  for(const bg of ["qa-paper","qa-surface","qa-selected","qa-changed","qa-finding",
                    "qa-pending","qa-accepted","qa-returned"]){
   assert.ok(ratio(value(palette,"qa-ink"),value(palette,bg))>=4.5,
    "WCAG AA foreground contrast in "+selector+" on "+bg);
  }
  assert.ok(ratio(value(palette,"qa-muted"),value(palette,"qa-paper"))>=4.5,
    "muted text must be readable on paper");
 }
});
test("both panes, fullscreen, and review overlays use scoped paired ink and background",()=>{
 assert.match(css,/\.semantic-reader \.semantic-reader__source-sheet/);
 assert.match(css,/\.semantic-reader \.semantic-reader__page/);
 assert.match(css,/background: var\(--qa-paper\) !important;/);
 assert.match(css,/color: var\(--qa-ink\) !important;/);
 assert.match(css,/\.semantic-reader:fullscreen/);
 assert.match(css,/\.semantic-reader \.semantic-reader__proposal-review/);
 assert.match(css,/\.semantic-reader \.semantic-reader__review-bar/);
 assert.match(css,/\.semantic-reader \.semantic-qa-overlay/);
 assert.match(css,/\.semantic-reader__source-region\[data-review-state/);
 assert.match(css,/\.semantic-reader__unit\[data-selected="true"\]/);
 assert.match(css,/\.semantic-reader__page :is\(section,article\)/);
});
test("new QA theme is loaded after base CSS and legacy public reader is not replaced",()=>{
 assert.ok(editor.indexOf('import "./semantic-reader.css"')<
           editor.indexOf('import "./semantic-reader-theme.css"'));
 assert.doesNotMatch(editor,/Gutenberg #389/);
 assert.match(editor,/Archivní Gutenberg · původní text/);
 assert.match(base,/semantic-reader__source-sheet/);
 assert.match(publicReader,/\.artales-reader--theme-script/);
});
