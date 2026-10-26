import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {captureRawSource,fetchRawSource,assertTrustedSnapshotChoice} from '../lib/ingest/rawSourceSnapshot.ts';
import {archiveRawSource,RAW_SNAPSHOT_BUCKET} from '../lib/ingest/rawSourceArchive.ts';
const cat='https://www.gutenberg.org/ebooks/389';
const locked=cat+'.epub.noimages';
const alternate='https://www.gutenberg.org/cache/epub/389/pg389-images-3.epub';
const txt=cat+'.txt.utf-8';
const selection={schema:'artales.snapshot-selection.v1',candidate_id:'98508359-bce1-4e73-b842-b69a9d1112d0',source_id:'2fbd2f26-89e6-464e-b048-001a8e533cc0',decision_no:9,catalog_url:cat,original_locked_url:locked,chosen_url:locked,format:'epub',selection:'locked',correspondence:'locked_file',source_archive_status:'not_captured',semantic_ready:false,publication_authorized:false};
const digest=(b)=>createHash('sha256').update(b).digest('hex');
function storedZip(files){
 const locals=[],centers=[];let offset=0;
 for(const [name,rawInput] of files){
  const raw=Buffer.from(rawInput),n=Buffer.from(name);const local=Buffer.alloc(30+n.length);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(raw.length,18);
  local.writeUInt32LE(raw.length,22);local.writeUInt16LE(n.length,26);n.copy(local,30);
  locals.push(local,raw);
  const center=Buffer.alloc(46+n.length);center.writeUInt32LE(0x02014b50,0);
  center.writeUInt16LE(20,4);center.writeUInt16LE(20,6);
  center.writeUInt32LE(raw.length,20);center.writeUInt32LE(raw.length,24);
  center.writeUInt16LE(n.length,28);center.writeUInt32LE(offset,42);n.copy(center,46);
  centers.push(center);offset+=local.length+raw.length;
 }
 const dir=Buffer.concat(centers),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
 end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,dir,end]);
}
const epub=storedZip([
 ['mimetype','application/epub+zip'],
 ['META-INF/container.xml','<container><rootfiles/></container>'],
 ['OEBPS/book.opf','<package><metadata>The Great God Pan</metadata></package>'],
 ['OEBPS/chapter.xhtml','<html><body><p>Original source sample, not publication approval.</p></body></html>']]);
const withPicture=storedZip([
 ['mimetype','application/epub+zip'],['OEBPS/chapter.xhtml','<html><body><p>Text</p></body></html>'],
 ['OEBPS/images/illustration.png','synthetic bytes']]);
const timestamp='2026-10-26T18:20:00.000Z';
function mockStore(){let stored=null,uploads=0;const client={storage:{from(bucket){return {
  async upload(path,bytes,opts){assert.equal(bucket,RAW_SNAPSHOT_BUCKET);assert.equal(opts.upsert,false);stored=Buffer.from(bytes);uploads++;return {error:null}},
  async download(path){assert.ok(path.includes('gutenberg/389/sha256/'));return {data:{async arrayBuffer(){return Uint8Array.from(stored).buffer}},error:null}}
 }}}};return {client,getUploads:()=>uploads,mutate:()=>{stored=Buffer.from('corrupt')}};}

test('trusted source proposal retains legal identity and produces raw SHA256 manifest',()=>{
 const c=captureRawSource(selection,epub,timestamp);assert.equal(c.manifest.selection.decision_no,9);
 assert.equal(c.manifest.snapshot_ref,'sha256:'+digest(epub));assert.equal(c.manifest.bytes,epub.length);
 assert.equal(c.manifest.archive_ready,true);assert.equal(c.manifest.semantic_contract,'artales.semantic-text.v2');
 assert.equal(c.manifest.semantic_ready,false);assert.equal(c.manifest.publication_authorized,false);
 assert.equal(c.manifest.parts.filter(x=>x.kind==='literary_text_candidate').length,1);
});
test('original bytes are copied, and later input mutation cannot alter archive evidence',()=>{
 const input=Buffer.from(epub);const c=captureRawSource(selection,input,timestamp);
 input.fill(0);assert.equal(digest(c.original),c.manifest.sha256);
});
test('alternate same-record EPUB with image is inventoried but private archive remains gated',async()=>{
 const sel={...selection,chosen_url:alternate,selection:'same_record_alternative',correspondence:'pending_content_comparison'};
 const c=captureRawSource(sel,withPicture,timestamp);assert.equal(c.manifest.embedded_images,1);
 assert.equal(c.manifest.archive_scope,'assets_require_review');assert.equal(c.manifest.archive_ready,false);
 assert.equal(c.manifest.parts.find(x=>x.kind==='embedded_image').publication_clearance,'excluded');
 const s=mockStore();await assert.rejects(()=>archiveRawSource(c,s.client,RAW_SNAPSHOT_BUCKET));assert.equal(s.getUploads(),0);
});
test('untrusted catalog, path, format mismatch and substitution are rejected',()=>{
 assert.throws(()=>assertTrustedSnapshotChoice({...selection,chosen_url:'https://evil.example/file.epub'}));
 assert.throws(()=>assertTrustedSnapshotChoice({...selection,catalog_url:'https://www.gutenberg.org/ebooks/540'}));
 assert.throws(()=>assertTrustedSnapshotChoice({...selection,chosen_url:txt}));
 assert.throws(()=>assertTrustedSnapshotChoice({...selection,chosen_url:txt,selection:'same_record_alternative',correspondence:'pending_content_comparison',format:'plain_text',publication_authorized:true}));
});
test('unsafe ZIP traversal and missing mimetype are rejected',()=>{
 const bad=storedZip([['mimetype','application/epub+zip'],['../chapter.xhtml','<html/>']]);
 assert.throws(()=>captureRawSource(selection,bad,timestamp),/unsafe_epub_filename/);
 assert.throws(()=>captureRawSource(selection,Buffer.from('PKbad'),timestamp));
 const missing=storedZip([['manifest.opf','<x/>'],['chapter.xhtml','<html/>']]);
 assert.throws(()=>captureRawSource(selection,missing,timestamp),/epub_mimetype_invalid|incomplete_epub_inventory/);
});
test('duplicate ZIP paths, bad header, and size checks refuse before storage',()=>{
 const badDup=storedZip([['mimetype','application/epub+zip'],['a.xhtml','<html/>'],['a.xhtml','<html/>']]);
 assert.throws(()=>captureRawSource(selection,badDup,timestamp),/unsafe_epub_filename/);
 const broken=Buffer.from(epub);broken.writeUInt16LE(444,broken.length-22+10);
 assert.throws(()=>captureRawSource(selection,broken,timestamp),/unsafe_epub_directory/);
 assert.throws(()=>captureRawSource(selection,epub,'not-a-date'));
});
test('TXT safe source remains separate from semantic parsing and original bytes stay exact',()=>{
 const sel={...selection,chosen_url:txt,format:'plain_text',selection:'same_record_alternative',correspondence:'pending_content_comparison'};
 const bytes=Buffer.from('This is a Gutenberg source sample.\nThe actual text is still pending component review.','utf8');
 const c=captureRawSource(sel,bytes,timestamp);assert.equal(c.manifest.parts[0].kind,'literary_text_candidate');
 assert.equal(c.manifest.embedded_images,0);assert.equal(c.manifest.archive_ready,true);assert.equal(c.manifest.semantic_ready,false);
});
test('mock HTTP exact bytes, declared size, rejected redirect and host drift',async()=>{
 const fetcher=async()=>new Response(epub,{status:200,headers:{'content-length':String(epub.length)}});
 const c=await fetchRawSource(selection,timestamp,fetcher);assert.equal(c.manifest.sha256,digest(epub));
 await assert.rejects(()=>fetchRawSource(selection,timestamp,async()=>new Response('',{status:302,headers:{location:'https://evil.example'}})));
 await assert.rejects(()=>fetchRawSource(selection,timestamp,async()=>new Response(epub,{status:200,headers:{'content-length':'1'}})));
});
test('private raw archive write-once with byte-for-byte readback (mock)',async()=>{
 const c=captureRawSource(selection,epub,timestamp),s=mockStore();const r=await archiveRawSource(c,s.client,RAW_SNAPSHOT_BUCKET);
 assert.equal(r.storage_readback,'sha256_verified');assert.equal(r.snapshot_ref,c.manifest.snapshot_ref);
 assert.equal(r.semantic_ready,false);assert.equal(r.publication_authorized,false);assert.equal(s.getUploads(),1);
 await assert.rejects(()=>archiveRawSource(c,s.client,'artales-source-archive'));
});
test('tampered pre-upload bytes and post-upload readback fail closed',async()=>{
 const c=captureRawSource(selection,epub,timestamp);c.original.fill(0);
 const s=mockStore();await assert.rejects(()=>archiveRawSource(c,s.client,RAW_SNAPSHOT_BUCKET));
 const d=captureRawSource(selection,epub,timestamp);
 const bad={storage:{from:()=>({async upload(){return {error:null}},async download(){return {data:{async arrayBuffer(){return Uint8Array.from(Buffer.from('corrupt')).buffer}},error:null}}})}};
 await assert.rejects(()=>archiveRawSource(d,bad,RAW_SNAPSHOT_BUCKET));
});