/**
 * GOLDEN is SYNTHETIC: Gutenberg #74 is a metadata-shaped fixture only.
 * Its literary test text is invented, never to be published or persisted.
 * No live profiles, candidate IDs, or production authorizations are reused.
 */
export const GOLDEN={
 schema:"artales.golden-editorial.v1",
 candidateId:"7e57a1e5-7e57-4ae5-8ae5-7e57a1e50001",
 sourceId:"7e57a1e5-7e57-4ae5-8ae5-7e57a1e50002",
 actorId:"7e57a1e5-7e57-4ae5-8ae5-7e57a1e50003",
 decisionNo:41,
 gutenbergId:74,
 catalogTitle:"The Adventures of Tom Sawyer, Complete",
 candidateTitle:"The Adventures of Tom Sawyer",
 authorDisplay:"Mark Twain",
 authorCatalog:"Twain, Mark",
 authorDied:1910,
 catalogUrl:"https://www.gutenberg.org/ebooks/74",
 epubUrl:"https://www.gutenberg.org/ebooks/74.epub.noimages",
 scenario:"synthetic-canonical-book",
} as const;
function crc32(bytes:Buffer):number{
 let v=0xffffffff;
 for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}
 return (v^0xffffffff)>>>0;
}
function zip(entries:readonly (readonly [string,string])[]):Buffer{
 const local:Buffer[]=[],central:Buffer[]=[];let cursor=0;
 for(const [name,content] of entries){
  const n=Buffer.from(name),data=Buffer.from(content),crc=crc32(data);
  const h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);
  h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
  local.push(h,n,data);
  const c=Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);
  c.writeUInt16LE(n.length,28);c.writeUInt32LE(cursor,42);
  central.push(c,n);cursor+=30+n.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);
 end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);
 end.writeUInt32LE(cursor,16);
 return Buffer.concat([...local,directory,end]);
}
const first=[
 "<p>*** START OF THE PROJECT GUTENBERG EBOOK THE ADVENTURES OF TOM SAWYER ***</p>",
 "<p>THIS EBOOK WAS ONE OF PROJECT GUTENBERG’S EARLY FILES. THERE IS AN IMPROVED ILLUSTRATED EDITION OF THIS TITLE.</p>",
 "<h1>Chapter I</h1>",
 "<p>A small imaginary hero walks to a small imaginary garden. It is a deliberate and original test story, not the text of Mark Twain.</p>",
 "<p>When the morning comes the hero opens the gate. Nothing changes the source, even if an editor omits a distribution notice.</p>"
].join("");
const second=[
 "<h1>Chapter II</h1>",
 "<p>The afternoon belongs to the same imaginary hero. Every sentence is invented for testing and will never be published.</p>",
 "<p>NOTE.—An uncertain editorial annotation that must remain visible until a human reviewer chooses what to do.</p>",
 "<p>Transcriber’s Notes</p>",
 "<p>New original cover art included with this eBook is granted to the public domain.</p>",
 "<p>*** END OF THE PROJECT GUTENBERG EBOOK THE ADVENTURES OF TOM SAWYER ***</p>"
].join("");
export function createGoldenEpub():Buffer{
 return zip([
  ["mimetype","application/epub+zip"],
  ["META-INF/container.xml",'<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
  ["OEBPS/content.opf",'<package><manifest><item id="a" href="first.xhtml" media-type="application/xhtml+xml"/><item id="b" href="second.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'],
  ["OEBPS/first.xhtml","<html><body>"+first+"</body></html>"],
  ["OEBPS/second.xhtml","<html><body>"+second+"</body></html>"],
 ]);
}
