import {strict as assert} from "node:assert";
import {test} from "node:test";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const cover=read("components/reader/SemanticEditionTitlePage.tsx");
const qa=read("components/editor/SemanticReaderLab.tsx");
const publicReader=read("components/reader/SemanticPublicReader.tsx");
const route=read("app/reader/[slug]/page.tsx");
test("title page contains exactly the requested words",()=>{
 assert(cover.includes("className={styles.title}>{title}</Heading>"));
 assert(cover.includes("className={styles.author}>{author}</p>"));
 assert(cover.includes("ARTales with love."));
 assert(!/ornament|edition_note|draft-note|review_state|<img/.test(cover));
});
test("existing draft QA books get separate cover without embedded-page duplication",()=>{
 assert(qa.includes("!hasRevisionTitlePage?<article"));
 assert(qa.includes("title={editionTitle} author={editionAuthor}"));
 assert(qa.includes('u.kind==="title_page"&&u.node.kind==="title_page"'));
 assert(!/semantic-reader__front-brand|semantic-reader__front-ornament|ARTales with Love/.test(qa));
});
test("published semantic Reader shares title page while legacy Reader stays untouched",()=>{
 assert(publicReader.includes('const cover:SemanticTitlePage='));
 assert(publicReader.includes('authors:[author||revision.title_page?.authors.join(" · ")||"Autor neuveden"]'));
 assert(route.includes('author={work.author?.name??""}'));
 assert(route.includes("<ReaderClient"));
});
