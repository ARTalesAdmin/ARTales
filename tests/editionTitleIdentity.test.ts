import test from "node:test";
import assert from "node:assert/strict";
import {matchesCandidateEditionTitle,sameLockedCatalogEdition} from "../lib/ingest/editionTitleIdentity";
test("bounded Gutenberg edition qualifier is not a different work",()=>{
 assert.equal(matchesCandidateEditionTitle("The Adventures of Tom Sawyer",
  "The Adventures of Tom Sawyer, Complete"),true);
 assert.equal(matchesCandidateEditionTitle("A Tale of Two Cities",
  "A Tale of Two Cities (unabridged)"),true);
 assert.equal(matchesCandidateEditionTitle("The Great God Pan","The Great God Pan"),true);
});
test("never accept work or translation mismatch under a title qualifier",()=>{
 for(const edition of [
  "The Adventures of Huckleberry Finn, Complete",
  "The Adventures of Tom Sawyer, Spanish Translation",
  "The Adventures of Tom Sawyer, Volume 2",
  "The Adventures of Tom Sawyer, Abridged",
  "Tom Sawyer, Complete"
 ])assert.equal(matchesCandidateEditionTitle("The Adventures of Tom Sawyer",edition),false);
 assert.equal(matchesCandidateEditionTitle("It","It, Complete"),false);
});
test("legal lock and live Gutenberg catalog must agree even if candidate has shorter title",()=>{
 assert.equal(sameLockedCatalogEdition("The Adventures of Tom Sawyer, Complete",
  "The Adventures of Tom Sawyer, Complete"),true);
 assert.equal(sameLockedCatalogEdition("The Adventures of Tom Sawyer, Complete",
  "The Adventures of Tom Sawyer"),false);
});
