import type {SnapshotActionState} from "@/lib/ingest/generalSnapshotAction";

/** Shared, server-rendered action surface: Legal detail and Snapshot detail.
 * The POST route is independently gated by active admin authentication and
 * a fresh legally approved lock. Rendering the control grants no capability.
 */
export function SnapshotActionPanel({candidateId,state,canArchive}:{
 candidateId:string;
 state:SnapshotActionState;
 canArchive:boolean;
}){
 return <>
  <p><strong>{state.actionLabel}</strong></p>
  {state.status==="archived_verification_pending"?<p>Originál je bezpečně archivován. Kontrola literární shody edice teprve následuje; nic není zveřejněno.</p>:null}
  {state.status==="verified_for_composition"?<p>Kontrola shody byla potvrzena. Pokračuj automatickým zpracováním do redakční karty.</p>:null}
  {state.status==="archiving"||state.status==="acquiring"?<p>Archivace probíhá. Nezahajujte druhý pokus.</p>:null}
  {state.status==="recovery_ready"?<p role="status">Předchozí pokus založil archivní claim, ale upload selhal. Bez změny právního rozhodnutí systém znovu ověří stejný zdroj a SHA-256 a dokončí archivaci pouze při přesné shodě. Nic nepřepisuje.</p>:null}
  {state.status==="reconciliation_required"?<p role="alert">Existuje archivní claim bez potvrzeného receipt. Nové stažení ani upload nejsou povoleny. Administrátor musí prověřit originál ve Storage, SHA-256 a zápisy registru.</p>:null}
  {state.status==="failed"||state.status==="acquisition_required"?<p>Akci nelze automaticky dokončit. Je nutná kontrola zdroje nebo předchozího pokusu.</p>:null}
  {state.status==="ready"&&!canArchive?<p>Zdroj je připraven. Soukromý Snapshot může dokončit pouze oprávněný vlastník zpracování nebo administrátor.</p>:null}
  {(state.status==="ready"||state.status==="recovery_ready")&&canArchive?<>
    <p>Archivuje se pouze původní EPUB ověřené Gutenberg edice. Obsah a případné ilustrace zůstávají soukromé; tato akce nepovoluje zveřejnění ani sémantickou kompozici.</p>
    <form action={`/api/member/snapshot/${candidateId}`} method="post" className="ca-form">
      <input type="hidden" name="candidate_id" value={candidateId}/>
      <label><input type="checkbox" name="private_original_retention" value="archive_only" required/>
      Souhlasím výhradně se soukromou archivací původního souboru včetně vložených obrázků, bez jejich veřejného použití.</label>
      <button type="submit" className="ca-btn ca-primary">{state.status==="recovery_ready"?"Bezpečně dokončit Snapshot":"Vytvořit Snapshot"}</button>
    </form>
  </>:null}
 </>;
}
