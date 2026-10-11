import assert from "node:assert/strict";
import test from "node:test";
import {projectSemanticProseText} from "../lib/semantic/displayText";
test("semantic prose display removes only archive soft wraps, source untouched",()=>{
 const original="Alice went\ndown the hole.";
 assert.equal(projectSemanticProseText(original),"Alice went down the hole.");
 assert.equal(original,"Alice went\ndown the hole.");
 assert.equal(projectSemanticProseText("Alpha\n\nBeta"),"Alpha\n\nBeta");
 assert.equal(projectSemanticProseText("Verse 1\nVerse 2"),"Verse 1 Verse 2");
});
