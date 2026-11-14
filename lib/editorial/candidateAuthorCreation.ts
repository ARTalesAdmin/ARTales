/** Work-card return path is a navigation hint, not proof of authority.
 * The server action separately checks the live claimed task and role.
 */
const uuid="[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const candidateRoute=new RegExp("^/member/editorial-detail/("+uuid+")(?:#author)?$","i");

export function safeAuthorReturnTo(raw:string|null|undefined):string|null{
 const value=(raw??"").trim();
 return value.startsWith("/")&&!value.startsWith("//")&&
  !value.includes("\\")&&!/[\r\n]/.test(value)?value:null;
}
export function candidateIdFromAuthorReturnTo(raw:string|null|undefined):string|null{
 const value=safeAuthorReturnTo(raw);
 return value?.match(candidateRoute)?.[1]??null;
}
export function newAuthorMatchesCandidateName(byline:string,name:string):boolean{
 return byline.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase();
}
