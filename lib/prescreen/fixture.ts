import type { PortfolioInventory, PrescreenWeights } from "./engine";
import { identityKey, DEFAULT_PRESCREEN_WEIGHTS } from "./engine";

/** Deliberately fictional, non-private titles. The fixture cannot disclose drafts. */
export const PRESCREEN_FIXTURE_WORKS=[
 {title:"Fixture Existing Adventure",author:"Demo Writer",status:"published",genre:"prose"},
 {title:"Fixture Existing Poem",author:"Demo Poet",status:"published",genre:"poetry"},
 {title:"Fixture Draft Novel",author:"Demo Novelist",status:"draft",genre:"prose"},
 {title:"Fixture Draft Drama",author:"Demo Dramatist",status:"draft",genre:"drama"}
] as const;
export const fixtureWeights:PrescreenWeights={...DEFAULT_PRESCREEN_WEIGHTS};
export const fixtureInventory:PortfolioInventory={
 genreCounts:{prose:2,poetry:1,drama:1,fairy_tale:0,essay:0,other:0},
 unknownGenre:0,publishedTotal:2,
 existingIdentityKeys:PRESCREEN_FIXTURE_WORKS.map(w=>identityKey(w.title,w.author)),
 existingWorkKeys:[],existingCandidateKeys:[]
};
export const fixtureNotice="Ukázková knihovna: 2 publikovaná a 2 rozpracovaná fiktivní díla. " +
"Zde se testuje algoritmus a průchod bez přihlášení. Skutečných 64 děl a databázový audit ověřujeme až v provozním režimu.";
