/** Display-only typography. Immutable source atoms, source hashes and anchors
 * never change. Gutenberg hard wraps are soft prose breaks; English one-letter
 * words must stay attached to the following word (no dangling I / a).
 */
export function projectSemanticProseText(raw:string):string {
 const soft=raw.replace(/([^\n])\n(?=[^\n])/g,"$1 ");
 return soft.replace(/\b([IaA]) ([^\s])/g,"$1\u00a0$2");
}
