import assert from "node:assert/strict";
import test from "node:test";
import {DEFAULT_THEME_WEIGHTS,normalizeThemeTags,themeCoverage,themeDeficitScore,validThemeWeights} from "../lib/prescreen/themes";
test("theme tags permit multiple labels but dedupe and reject unknown",()=>{
 assert.deepEqual(normalizeThemeTags(["romance","horror","romance","invalid"]),["horror","romance"]);
});
test("default thematic weights are complete and sum to 100",()=>{
 assert.equal(validThemeWeights(DEFAULT_THEME_WEIGHTS),true);
 assert.equal(validThemeWeights({...DEFAULT_THEME_WEIGHTS,horror:19}),false);
});
test("count multiple thematic tags per work without duplicate tag inflation",()=>{
 const c=themeCoverage([["horror","romance","horror"],["romance"],[]]);
 assert.equal(c.horror,1);assert.equal(c.romance,2);
});
test("ranking prefers underrepresented thematic focus",()=>{
 const c=themeCoverage([["romance"],["romance"]]);
 assert.ok(themeDeficitScore(["horror"],DEFAULT_THEME_WEIGHTS,c,2)>
           themeDeficitScore(["romance"],DEFAULT_THEME_WEIGHTS,c,2));
});
