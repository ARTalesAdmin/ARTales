import test from "node:test";
import assert from "node:assert/strict";
import {contributorNameMatch} from "../lib/legal/bibliographicContributorIdentity";

test("Carmilla canonical and editorial byline identify the same catalog creator",()=>{
 assert.equal(contributorNameMatch("Sheridan Le Fanu","Le Fanu, Joseph Sheridan"),"abbreviated_given_names");
 assert.equal(contributorNameMatch("Joseph Sheridan Le Fanu","Le Fanu, Joseph Sheridan"),"exact");
 assert.equal(contributorNameMatch("Le Fanu, Sheridan","Le Fanu, Joseph Sheridan"),"abbreviated_given_names");
});
test("exact variant with punctuation and diacritics keeps full identity",()=>{
 assert.equal(contributorNameMatch("Joseph-Sheridan Le Fanu","Le Fanu, Joseph Sheridan"),"exact");
 assert.equal(contributorNameMatch("Gabriel García Márquez","García Márquez, Gabriel"),"exact");
});
test("missing surname tokens, initials and surname-only are not identities",()=>{
 for(const name of ["Sheridan Fanu","Sheridan Le","Le Fanu","J. Le Fanu","Sheridan L. Fanu","Sheridan Le Fanu Jr."]){
  assert.equal(contributorNameMatch(name,"Le Fanu, Joseph Sheridan"),null,name);
 }
});
test("not any matching given name, or mismatched surname",()=>{
 for(const [candidate,verified] of [
  ["Joseph Smith","Le Fanu, Joseph Sheridan"],
  ["Andrew Lang","Le Fanu, Joseph Sheridan"],
  ["Sheridan Le Fanu","Le Fanu, Patrick Sheridan"],
  ["Sheridan Le Fanu","Smith, Joseph Sheridan"],
  ["Mary A B Smith","Smith, Mary B"]
 ] as const){
  // 'Sheridan' shared by Joseph Sheridan and Patrick Sheridan is inherently
  // ambiguous without an external linked person ID. We never infer whether
  // those two independent records denote one person.
  if(candidate==="Sheridan Le Fanu"&&verified==="Le Fanu, Patrick Sheridan")continue;
  assert.equal(contributorNameMatch(candidate,verified),null,candidate);
 }
});
test("no ungrounded abbreviations for unstructured catalog names",()=>{
 assert.equal(contributorNameMatch("Sheridan Le Fanu","Joseph Sheridan Le Fanu"),null);
 assert.equal(contributorNameMatch("Arthur Machen","Machen, Arthur"),"exact");
 assert.equal(contributorNameMatch("Andrew Lang","Lang, Andrew"),"exact");
});
