import {test} from "node:test";
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const root=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const db=root("ops/sql/20261104_artales_safe_layout_commit_v4.sql");
const decisions=root("ops/sql/20261104_artales_qa_change_decisions_v4.sql");
const close=root("ops/sql/20261104_artales_qa_closeout_v4.sql");
const monthly=root("ops/sql/20261104_artales_monthly_methodology_review.sql");
const actions=root("app/member/semantic/[candidateId]/qa-actions.ts");
const panel=root("components/editor/SemanticQaPanel.tsx");
const reader=root("components/editor/SemanticReaderLab.tsx");
const styles=root("components/editor/semantic-reader.css");
const cron=JSON.parse(root("vercel.json"));

test("editor saves only server-recomposed verified layouts; role key never crosses to browser",()=>{
 assert.match(actions,/requireEditorOrAdmin\(\)/);
 assert.match(actions,/prepareQaPresentationBatch\(input\)/);
 assert.match(actions,/createServiceClient\(url,roleKey/);
 assert.match(actions,/p_editor_id:actor.id/);
 assert.match(actions,/if\(actor.role!=="admin"\)/);
 assert.match(db,/service_only_layout_commit/);
 assert.match(db,/artales_strip_semantic_presentation\(p_revision->'blocks'\)/);
 assert.match(db,/p_revision->'source' IS DISTINCT FROM v_parent.revision->'source'/);
 assert.match(db,/p_revision->'gaps' IS DISTINCT FROM v_parent.revision->'gaps'/);
 assert.match(db,/p_revision->'editorial_exclusions' IS DISTINCT FROM v_parent.revision->'editorial_exclusions'/);
 assert.match(db,/review_history_changed/);
 assert.match(db,/unverified_presentation_change/);
 assert.match(db,/supersede_failed/);
 assert.match(db,/followup_qa_missing/);
});
test("per-block independent acceptance and return require evidence and current ownership",()=>{
 assert.match(decisions,/UNIQUE\(candidate_id,revision_sha256,issue_id\)/);
 assert.match(decisions,/decision IN \('accepted','returned'\)/);
 assert.match(decisions,/p_decision='returned'/);
 assert.match(decisions,/v_task\.status<>'claimed'/);
 assert.match(decisions,/stale_revision/);
 assert.match(decisions,/RETURNING id INTO v_flag/);
 assert.match(panel,/✓ Přijmout/);
 assert.match(panel,/✕ Vrátit s poznámkou/);
 assert.match(panel,/minLength=\{15\}/);
 assert.match(close,/qa_changes_unreviewed/);
 assert.match(close,/artales_finish_semantic_text_qa/);
 assert.match(close,/status='completed',completed_by=v_actor/);
});
test("reader highlights changed and selected blocks distinctly",()=>{
 assert.match(reader,/data-review-fixed/);
 assert.match(reader,/data-selected/);
 assert.match(styles,/data-selected="true"\]\[data-review-fixed="true"\]/);
 assert.match(styles,/semantic-reader__key-swatch--changed/);
 assert.match(styles,/semantic-reader__key-swatch--selected/);
});
test("indeterminate job progress does not promise a false duration",()=>{
 assert.match(panel,/<progress aria-label="Zpracovávání oprav v AI frontě"\/>/);
 assert.match(panel,/Délku zpracování nelze spolehlivě odhadnout/);
 assert.match(panel,/můžeš počkat zde, nebo okno zavřít/);
});
test("controlled monthly human methodology review has one owner, one task per month",()=>{
 assert.match(monthly,/month_start date NOT NULL UNIQUE/);
 assert.match(monthly,/ON CONFLICT\(month_start\) DO NOTHING/);
 assert.match(monthly,/admin_required/);
 assert.match(monthly,/artales_complete_methodology_review/);
 assert(cron.crons.some((entry:{path:string;schedule:string})=>
  entry.path==="/api/internal/editorial/methodology-review"));
});
