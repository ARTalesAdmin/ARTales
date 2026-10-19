import assert from "node:assert/strict";
import test from "node:test";
import {DEFAULT_PRESCREEN_WEIGHTS} from "../lib/prescreen/engine";
import {countPortfolio,portfolioGenreGaps,parsePrescreenWeights} from "../lib/prescreen/portfolio";

test("published and drafts both occupy portfolio genres, never counted twice",()=>{
 const p=countPortfolio([
  {id:"published-a",status:"published"},{id:"draft-b",status:"draft"},
  {id:"published-a",status:"published"},{id:"draft-c",status:"draft"}
 ],[
  {work_id:"published-a",genre:"prose"},
  {work_id:"draft-b",genre:"poetry"}
 ]);
 assert.equal(p.publishedTotal,1);
 assert.equal(p.draftTotal,2);
 assert.equal(p.genreCounts.prose,1);
 assert.equal(p.genreCounts.poetry,1);
 assert.equal(p.unknownGenre,1);
 assert.equal(p.classificationComplete,false);
});

test("accepted candidates count only if still active and not already a work",()=>{
 const p=countPortfolio([{id:"work-1",status:"draft"}],
  [{work_id:"work-1",genre:"drama"}],[
   {id:"c1",status:"checking",genre:"poetry",matched_work_id:null},
   {id:"c1",status:"checking",genre:"poetry",matched_work_id:null},
   {id:"c2",status:"rejected",genre:"prose"},
   {id:"c3",status:"accepted",genre:"fairy_tale",matched_work_id:"work-1"}
 ]);
 assert.equal(p.genreCounts.poetry,1);
 assert.equal(p.genreCounts.drama,1);
 assert.equal(p.genreCounts.fairy_tale,0);
 assert.equal(p.activeCandidateTotal,1);
 assert.equal(p.knownGenreTotal,2);
});

test("weights are a reviewed 100-percent policy, not guessed genre labels",()=>{
 assert.equal(parsePrescreenWeights(DEFAULT_PRESCREEN_WEIGHTS)?.poetry,20);
 assert.equal(parsePrescreenWeights({...DEFAULT_PRESCREEN_WEIGHTS,prose:26}),null);
 assert.equal(parsePrescreenWeights({...DEFAULT_PRESCREEN_WEIGHTS,prose:"25"}),null);
 assert.equal(parsePrescreenWeights({}),null);
});

test("genre gap uses real known works including drafts and the requested batch",()=>{
 const p=countPortfolio([{id:"draft",status:"draft"},{id:"published",status:"published"}],
  [{work_id:"draft",genre:"prose"},{work_id:"published",genre:"prose"}]);
 const gaps=portfolioGenreGaps(p,DEFAULT_PRESCREEN_WEIGHTS,4);
 assert.equal(gaps[0].genre,"poetry");
 assert.equal(gaps.find(g=>g.genre==="prose")?.actual,2);
});
