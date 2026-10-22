import type { BibliographicTitle, PrescreenGenre } from "./engine";
import { identityKey, yearFromDate } from "./engine";
import {formFromSubjects,themesFromSubjects} from "./shadowPolicy";
import {primaryTheme,SHADOW_THEME_WEIGHTS} from "./shadowPolicy";
import type {PrescreenTheme} from "./themes";

type SearchDoc = {
  key?: string; title?: string; author_name?: string[];
  author_key?: string[]; first_publish_year?: number; subject?:string[];
};
type AuthorRecord = { birth_date?: string; death_date?: string };

export const OPEN_LIBRARY_QUERIES: Record<PrescreenGenre,string> = {
  prose: "subject:fiction",
  poetry: "subject:poetry",
  drama: "subject:drama",
  fairy_tale: "subject:fairy_tales",
  essay: "subject:essays",
  other: "subject:nonfiction"
};

/** Limited manual catalog lookup, not a bulk data API or a rights oracle. */
const headers = { "Accept": "application/json", "User-Agent": "ARTales-bibliographic-prescreen/1.0 (https://artales.net)" };
const apiOrigin = "https://openlibrary.org";
const pause = (ms:number) => new Promise(resolve => setTimeout(resolve,ms));

async function getJson(url: URL): Promise<unknown> {
  if(url.origin !== apiOrigin) throw new Error("catalog_endpoint_invalid");
  const response = await fetch(url, {headers,signal:AbortSignal.timeout(10000),
    next:{revalidate:86400}});
  if(!response.ok) throw new Error("catalog_request_" + response.status);
  return response.json();
}

async function search(query:string, offset=0, limit=40):Promise<SearchDoc[]>{
  const url = new URL("/search.json",apiOrigin);
  url.searchParams.set("q",query);
  url.searchParams.set("fields","key,title,author_name,author_key,first_publish_year,subject");
  url.searchParams.set("limit",String(Math.min(50,Math.max(1,limit))));
  url.searchParams.set("offset",String(Math.max(0,offset)));
  const data=await getJson(url) as {docs?:SearchDoc[]};
  return Array.isArray(data.docs)?data.docs:[];
}

function parseDocument(doc:SearchDoc,genre:PrescreenGenre,origin:BibliographicTitle["origin"]):BibliographicTitle|null{
  let workKey = doc.key ?? "";
  if(/^OL\d+W$/.test(workKey)) workKey="/works/"+workKey;
  const authorKey=doc.author_key?.[0] ?? "";
  const title=doc.title?.trim()??"";
  const author=doc.author_name?.[0]?.trim()??"";
  if(!/^\/works\/OL\d+W$/.test(workKey) || !title || !author || !/^OL\d+A$/.test(authorKey))return null;
  const tags=themesFromSubjects(doc.subject);
  return {workKey,title,author,authorKey,genre:formFromSubjects(doc.subject)??genre,origin,
    themes:tags,primaryTheme:primaryTheme(tags,SHADOW_THEME_WEIGHTS),authorCount:doc.author_name?.length??1,
    firstPublished:yearFromDate(doc.first_publish_year),
    authorBorn:null,authorDied:null,
    sourceUrl:apiOrigin+workKey};
}

export async function searchGenre(genre:PrescreenGenre, offset:number, limit=40):Promise<BibliographicTitle[]> {
  const docs=await search(OPEN_LIBRARY_QUERIES[genre],offset,limit);
  return docs.map(d=>parseDocument(d,genre,"catalog")).filter((x):x is BibliographicTitle=>x!==null);
}

export const OPEN_LIBRARY_THEME_QUERIES:Record<PrescreenTheme,string>={
  horror:"subject:horror",romance:"subject:romance",detective:"subject:detective",
  science_fiction:"subject:science_fiction",fantasy:"subject:fantasy",
  adventure:"subject:adventure",humor:"subject:humor",
  historical:"subject:historical_fiction",mystery:"subject:mystery",
  social:"subject:social_fiction"
};
export async function searchTheme(theme:PrescreenTheme,offset:number,limit=16):Promise<BibliographicTitle[]>{
  const docs=await search(OPEN_LIBRARY_THEME_QUERIES[theme],offset,limit);
  return docs.map(d=>parseDocument(d,"other","catalog")).filter((x):x is BibliographicTitle=>x!==null);
}

export async function findSuggestion(title:string,author:string,origin:"editor"|"reader"):Promise<BibliographicTitle|null> {
  if(title.length>180||author.length>140||!title.trim()||!author.trim())return null;
  const docs=await search(`title:"${title.replaceAll('"','')}" AND author:"${author.replaceAll('"','')}"`,0,10);
  const matched=docs.find(d=>identityKey(d.title??"",d.author_name?.[0]??"")===identityKey(title,author));
  return matched?parseDocument(matched,"prose",origin):null;
}

/** First OL author biography provides evidence for a cheap chronology check. */
export async function enrichAuthor(row:BibliographicTitle):Promise<BibliographicTitle> {
  if(!/^OL\d+A$/.test(row.authorKey)) return row;
  const url=new URL("/authors/"+row.authorKey+".json",apiOrigin);
  const data=await getJson(url) as AuthorRecord;
  return {...row,authorBorn:yearFromDate(data.birth_date),authorDied:yearFromDate(data.death_date)};
}

export { pause };
