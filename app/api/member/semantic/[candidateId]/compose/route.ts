/** Compatibility entry: one canonical verified automatic Compose implementation.
 * A legacy caller is never allowed to bypass Legal, archive and RDF evidence. */
import {POST as runAutomaticCompose} from "@/app/api/member/snapshot/[candidateId]/auto-compose/route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(req:Request,ctx:{params:Promise<{candidateId:string}>}){
 return runAutomaticCompose(req,ctx);
}
