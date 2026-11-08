/** Compatibility entry point. Both paths use the same verified, resumable
 * automatic flow; the older manual Compose cannot bypass Legal/RDF checks. */
export {POST,runtime,dynamic,maxDuration} from "@/app/api/member/snapshot/[candidateId]/auto-compose/route";
