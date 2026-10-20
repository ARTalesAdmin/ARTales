import assert from "node:assert/strict";
import test from "node:test";
import {DEFAULT_PRESCREEN_WEIGHTS,identityKey,planPrescreen,screenEuCzAuthorTerm,yearFromDate,type BibliographicTitle,type PortfolioInventory} from "../lib/prescreen/engine";

const base=():PortfolioInventory=>({genreCounts:{prose:20,poetry:0,drama:0,fairy_tale:0,essay:0,other:0},unknownGenre:0,publishedTotal:20,existingIdentityKeys:[],existingWorkKeys:[],existingCandidateKeys:[]});
const make=(key:string,genre:BibliographicTitle["genre"]="poetry"):BibliographicTitle=>({workKey:"/works/OL"+key+"W",title:"Work "+key,author:"Author "+key,authorKey:"OL"+key+"A",genre,firstPublished:1900,authorBorn:1850,authorDied:1920,sourceUrl:"https://openlibrary.org/works/OL"+key+"W",origin:"catalog"});
test("deduplicates title/author and source keys against existing library and batch",()=>{
 const one=make("1"), duplicate={...one,workKey:"/works/OL99W",authorKey:"OL99A"};
 const result=planPrescreen([one,duplicate,make("2")],base(),3,DEFAULT_PRESCREEN_WEIGHTS);
 assert.equal(result.candidates.length,2);assert.equal(result.decisions.filter(x=>x.outcome==="duplicate").length,1);
 const withExisting=base();withExisting.existingIdentityKeys.push(identityKey(one.title,one.author));
 assert.equal(planPrescreen([one],withExisting,1,DEFAULT_PRESCREEN_WEIGHTS).candidates.length,0);
});
test("incomplete chronology is reviewed, never legally cleared",()=>{
 const invalid={...make("1"),authorDied:null};
 const result=planPrescreen([invalid],base(),1,DEFAULT_PRESCREEN_WEIGHTS);
 assert.equal(result.missing,1);assert.equal(result.decisions[0].reason,"historical_dates_missing");
});
test("date parser handles common bibliographic date formats",()=>{
 assert.equal(yearFromDate("22 January 1832"),1832);assert.equal(yearFromDate("1832-01-22"),1832);assert.equal(yearFromDate("unknown"),null);
});
test("rejects illegal weights and bounded request sizes",()=>{
 assert.throws(()=>planPrescreen([],base(),13,DEFAULT_PRESCREEN_WEIGHTS));
 assert.throws(()=>planPrescreen([],base(),2,{...DEFAULT_PRESCREEN_WEIGHTS,prose:101}));
});
test("stable selection gives underrepresented genres priority",()=>{
 const result=planPrescreen([make("1","prose"),make("2","poetry")],base(),1,DEFAULT_PRESCREEN_WEIGHTS);
 assert.equal(result.candidates[0].genre,"poetry");
});

test("Tolkien 1973 death is deferred through 2043, no candidate in 2026",()=>{
 const row={...make("77","fairy_tale"),title:"Tree and Leaf",author:"J. R. R. Tolkien",authorBorn:1892,authorDied:1973,firstPublished:1964};
 const result=planPrescreen([row],base(),1,DEFAULT_PRESCREEN_WEIGHTS,1,2026);
 assert.equal(result.candidates.length,0);
 assert.equal(result.decisions[0].outcome,"deferred");
 assert.equal(result.decisions[0].reason,"eu_cz_standard_author_term_not_elapsed");
 assert.equal(result.decisions[0].euCzTerm?.standardTermEndYear,2043);
 assert.equal(result.decisions[0].euCzTerm?.reviewNotBeforeYear,2044);
 assert.equal(screenEuCzAuthorTerm(row,2043)?.standardTermElapsed,false);
 assert.equal(screenEuCzAuthorTerm(row,2044)?.standardTermElapsed,true);
});
test("elapsed basic EU/CZ author term still does not imply legal clearance",()=>{
 const row=make("81");
 const result=planPrescreen([row],base(),1,DEFAULT_PRESCREEN_WEIGHTS,1,2026);
 assert.equal(result.candidates.length,1);
 assert.equal(result.decisions[0].reason,"bibliographic_prescreen_passed_basic_term_only_rights_unknown");
 assert.equal(result.decisions[0].euCzTerm?.standardTermElapsed,true);
});
