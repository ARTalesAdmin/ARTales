import type {AiQaSuggestion} from "./aiQaProposalEngine";

/** Choices are local editorial decisions. No AI output is trusted as authority. */
export type QaProposalDecision={flagId:string;choice:"approve"|"reject"};
export function isSafeWorkTypographyTerm(term:string):boolean{
 return term.length>=2&&term.length<=80&&/^[\p{L}][\p{L} '\u2019-]{1,79}$/u.test(term);
}

export type QaProposalFlag={id:string;kind:string;status:string};
export type QaProposalPlan={
 layout:{flagId:string;action:"compact"|"airy"|"center"}[];
 protectedTerms:{flagId:string;term:string}[];
 confirmedNoChange:string[];
 rejected:string[];
};

export function planQaProposalReview(
 suggestions:readonly AiQaSuggestion[],
 flags:readonly QaProposalFlag[],
 choices:readonly QaProposalDecision[]
):QaProposalPlan{
 if(!Array.isArray(suggestions)||suggestions.length<1||suggestions.length>25||
  !Array.isArray(choices)||choices.length!==suggestions.length||
  new Set(suggestions.map(s=>s.flagId)).size!==suggestions.length||
  new Set(choices.map(c=>c.flagId)).size!==choices.length)
  throw new Error("Návrhy nebo redakční rozhodnutí nejsou úplné.");
 const byFlag=new Map(flags.map(f=>[f.id,f]));
 const byChoice=new Map(choices.map(c=>[c.flagId,c.choice]));
 const result:QaProposalPlan={layout:[],protectedTerms:[],confirmedNoChange:[],rejected:[]};
 for(const suggestion of suggestions){
  const flag=byFlag.get(suggestion.flagId);
  const decision=byChoice.get(suggestion.flagId);
  if(!flag||!["open","resolved"].includes(flag.status)||
    !["approve","reject"].includes(decision??""))
   throw new Error("Nález není ve správné revizi nebo chybí rozhodnutí.");
  if(decision==="reject"){result.rejected.push(flag.id);continue;}
  if(["compact","airy","center"].includes(suggestion.action)){
   if(flag.status!=="open"||!["typography","structure"].includes(flag.kind))
    throw new Error("Schvalovaná sazební oprava nemá otevřený příslušný nález.");
   result.layout.push({flagId:flag.id,
    action:suggestion.action as "compact"|"airy"|"center"});
  }else if(suggestion.action==="protect_term"){
   if(typeof suggestion.term!=="string"||suggestion.term.trim().length<2||
     suggestion.term.length>80)
    throw new Error("Výraz navržený k ochraně neprošel validací.");
   // Punctuation-bearing manuscript notes are not valid non-breaking
   // expressions. Explicit editorial approval acknowledges a checked note,
   // not an invalid work-level typography rule.
   if(isSafeWorkTypographyTerm(suggestion.term.trim()))
    result.protectedTerms.push({flagId:flag.id,term:suggestion.term.trim()});
   else result.confirmedNoChange.push(flag.id);
  }else if(suggestion.action==="manual_review"){
   // Only explicit editor approval in UI may mean "inspected, no change needed".
   result.confirmedNoChange.push(flag.id);
  }else throw new Error("Neznámý druh AI návrhu.");
 }
 return result;
}
