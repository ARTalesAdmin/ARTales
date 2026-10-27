import {requireAdmin} from "@/lib/guards";
import {SNAPSHOT_389_CANDIDATE} from "@/lib/ingest/snapshot389Pilot";

export const dynamic="force-dynamic";

export default async function Snapshot389PilotPage(){
  await requireAdmin();
  return (
    <main style={{maxWidth:760,margin:"3rem auto",padding:"1.5rem"}}>
      <p style={{opacity:.72}}>ARTales · Interní Snapshot pilot</p>
      <h1>The Great God Pan — Gutenberg #389</h1>
      <p>Právní screen: schváleno pro ČR/EU, rozhodnutí č. 9, text bez ilustrací.</p>
      <p><strong>Jednorázový test archivu:</strong> server získá originální EPUB přes
        pevně určené Gutenberg zrcadlo, provede validaci EPUB, uloží neměnný
        soubor do soukromého bucketu a znovu ho stáhne pro kontrolu SHA-256.</p>
      <p>Součástí EPUBu je automaticky vytvořená obálka. Potvrzením povolujete
        výhradně její uchování v soukromém archivu jako součást původního
        souboru; nepovolujete veřejné použití ani publikaci knihy.</p>
      <form action="/api/member/snapshot/389" method="post" style={{display:"grid",gap:"1rem"}}>
        <input type="hidden" name="candidate_id" value={SNAPSHOT_389_CANDIDATE}/>
        <label style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <input type="checkbox" required
            name="confirm_private_original_with_cover"
            value="archive_only_not_publication"/>
          Výslovně schvaluji interní uchování originálního EPUBu včetně obálky;
          nikoli její zveřejnění. Souhlasím s jedním pokusem o zápis.
        </label>
        <button type="submit" style={{padding:"1rem",fontWeight:700}}>
          Otestovat Snapshot #389
        </button>
      </form>
      <p style={{opacity:.72}}>Po dokončení se zobrazí potvrzení nebo chyba
        archivace. Snapshot se nepřenese do současného Readeru.</p>
    </main>
  );
}
