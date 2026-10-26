/** Pure S0 bridge: trusted legal lock -> verified same-edition file proposal.
 * Caller MUST obtain lock from authenticated server DB and catalog from trusted
 * resolver. A selection is NOT a downloaded/archived Snapshot or publishing gate.
 */
import type {GutenbergBook} from "../legal/gutenbergCatalog";
export type LegalSnapshotLock={candidate_id:string;source_id:string;decision_no:number;source_url:string;download_url:string;source_facts:unknown;illustrations:unknown;locked_at:string};
export type SnapshotFileChoice={schema:"artales.snapshot-selection.v1";candidate_id:string;source_id:string;decision_no:number;catalog_url:string;original_locked_url:string;chosen_url:string;format:"epub"|"html"|"plain_text";selection:"locked"|"same_record_alternative";correspondence:"locked_file"|"pending_content_comparison";source_archive_status:"not_captured";semantic_ready:false;publication_authorized:false};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function url(value:string):URL {let u:URL;try{u=new URL(value)}catch{throw Error("invalid_url")}
 if(u.protocol!=="https:"||!["www.gutenberg.org","gutenberg.org","m.gutenberg.org"].includes(u.hostname)||u.port||u.username||u.password||u.search||u.hash||/%|\\/.test(u.pathname))throw Error("untrusted_url");return u;}
function id(value:string){const m=/^\/ebooks\/([1-9]\d{0,7})\/?$/.exec(url(value).pathname);if(!m)throw Error("catalog_identity_mismatch");return Number(m[1]);}
function belongs(value:string,n:number){const path=url(value).pathname,k=String(n);if(!(path.startsWith("/ebooks/"+k+".")||path.startsWith("/cache/epub/"+k+"/")||path.startsWith("/files/"+k+"/")))throw Error("file_record_mismatch");}
const normalized=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function chooseSnapshotFile(lock:LegalSnapshotLock,book:GutenbergBook,alternative?:string):SnapshotFileChoice {
 if(!uuid.test(lock.candidate_id)||!uuid.test(lock.source_id)||!Number.isSafeInteger(lock.decision_no)||lock.decision_no<1||!Number.isFinite(Date.parse(lock.locked_at)))throw Error("invalid_lock");
 const n=id(lock.source_url);belongs(lock.download_url,n);
 if(!lock.source_facts||typeof lock.source_facts!=="object"||Array.isArray(lock.source_facts)||!Array.isArray(lock.illustrations))throw Error("invalid_facts");
 const f=lock.source_facts as Record<string,unknown>;
 if(f.kind!=="gutenberg"||f.identityMatch!=="confirmed"||f.originalRights!=="public_domain"||f.sourceTerms!=="cleared"||!["not_applicable","public_domain","cleared"].includes(String(f.translationRights))||f.languageMatch!=="matches")throw Error("legal_gate_missing");
 if(book.id!==n||id(book.catalogUrl)!==n||normalized(book.title)!==normalized(String(f.edition??""))||!book.files?.length||(f.language&&book.languages.length&&!book.languages.includes(String(f.language)))||(book.translators.length&&f.translationStatus==="original"))throw Error("edition_mismatch");
 const chosen=alternative??lock.download_url;belongs(chosen,n);
 const file=book.files.find(x=>x.url===chosen),different=chosen!==lock.download_url;
 if(different&&!file)throw Error("alternative_not_in_catalog");
 const format=file?.format??(f.textFormat==="epub"?"epub":f.textFormat==="html"?"html":"plain_text");
 if(!different&&f.textFormat!==format&&!(f.textFormat==="txt"&&format==="plain_text"))throw Error("locked_format_mismatch");
 return {schema:"artales.snapshot-selection.v1",candidate_id:lock.candidate_id,source_id:lock.source_id,decision_no:lock.decision_no,catalog_url:lock.source_url,original_locked_url:lock.download_url,chosen_url:chosen,format,selection:different?"same_record_alternative":"locked",correspondence:different?"pending_content_comparison":"locked_file",source_archive_status:"not_captured",semantic_ready:false,publication_authorized:false};
}
