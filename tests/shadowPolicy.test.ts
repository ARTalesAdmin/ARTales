import assert from "node:assert/strict";
import test from "node:test";
import {SHADOW_FORM_WEIGHTS,SHADOW_THEME_WEIGHTS,rebalancePercentages,
  themesFromSubjects,formFromSubjects,primaryTheme,preliminaryShadowDecision,planShadowQueries}
  from "../lib/prescreen/shadowPolicy";
import type {BibliographicTitle} from "../lib/prescreen/engine";

const title=(died:number|null=1973):BibliographicTitle=>({
  workKey:"/works/OL100W",title:"Tree and Leaf",author:"J. R. R. Tolkien",
  authorKey:"OL100A",genre:"prose",firstPublished:1964,authorBorn:1892,
  authorDied:died,sourceUrl:"https://openlibrary.org/works/OL100W",origin:"catalog"
});
test("both default sections sum to 100 and are integers",()=>{
  assert.equal(Object.values(SHADOW_FORM_WEIGHTS).reduce((a,b)=>a+b,0),100);
  assert.equal(Object.values(SHADOW_THEME_WEIGHTS).reduce((a,b)=>a+b,0),100);
});
test("slider and numeric edits rebalance only their own section to 100",()=>{
  for(const target of [0,1,20,67,99,100]){
    const next=rebalancePercentages(SHADOW_THEME_WEIGHTS,"horror",target);
    assert.equal(next.horror,target);
    assert.equal(Object.values(next).reduce((a,b)=>a+b,0),100);
    assert.ok(Object.values(next).every(v=>Number.isInteger(v)&&v>=0));
  }
  assert.equal(rebalancePercentages(SHADOW_FORM_WEIGHTS,"prose",60).prose,60);
  assert.equal(SHADOW_THEME_WEIGHTS.horror,12);
  assert.throws(()=>rebalancePercentages(SHADOW_THEME_WEIGHTS,"horror",NaN));
});
test("source-supported themes and primary theme are deterministic",()=>{
  const tags=themesFromSubjects(["Horror stories","Fantasy fiction","Horror stories"]);
  assert.deepEqual(tags,["horror","fantasy"]);
  assert.equal(primaryTheme(tags,SHADOW_THEME_WEIGHTS),"horror");
  assert.equal(formFromSubjects(["Drama","History"]),"drama");
  assert.deepEqual(themesFromSubjects(["Unrelated metadata"]),[]);
});
test("EU/CZ Tolkien 1973 term reaches reconsideration in 2044",()=>{
  assert.deepEqual(preliminaryShadowDecision(title(),2026),{
    state:"deferred",reason:"eu_cz_author_life_plus_70_not_elapsed",
    reconsiderYear:2044,standardTermEndYear:2043
  });
  assert.equal(preliminaryShadowDecision(title(),2044).state,"suggested");
  assert.equal(preliminaryShadowDecision(title(null),2044).state,"review");
  assert.equal(preliminaryShadowDecision({...title(),authorCount:2},2044).reason,
    "multiple_authors_need_individual_terms");
});
test("thematic weights affect actual query planning",()=>{
  const order=planShadowQueries([],SHADOW_FORM_WEIGHTS,SHADOW_THEME_WEIGHTS,4);
  assert.deepEqual(order,[
    {kind:"form",key:"prose"},{kind:"theme",key:"adventure"},
    {kind:"form",key:"fairy_tale"},{kind:"theme",key:"detective"}
  ]);
});
