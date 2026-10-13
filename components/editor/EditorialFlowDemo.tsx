"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnchoredBlock } from "@/lib/fixtures/ingestComposer";
import {
  FLOW_DEMO_AUTHOR,
  FLOW_DEMO_BASE,
  FLOW_DEMO_COMPOSITION,
  FLOW_DEMO_DEFECTS,
  FLOW_DEMO_KEY,
  FLOW_DEMO_RIGHTS,
  FLOW_DEMO_TITLE,
  claimFlowDemo,
  finishFlowDemo,
  flowDemoInboxCount,
  freshFlowDemo,
  queueFlowDemo,
  readFlowDemo,
  repairFlowDemo,
  type DemoDefectKey,
  type FlowDemoSession,
} from "@/lib/fixtures/editorialFlowDemo";
import "./EditorialFlowDemo.css";

type View = "candidates" | "inbox" | "review";
const now = () => new Date().toISOString();
const previewBlocks = FLOW_DEMO_COMPOSITION.blocks.slice(0, 8);
const defectByBlockId = new Map(FLOW_DEMO_DEFECTS.map((item) => [item.blockId, item]));
const totalDefects = FLOW_DEMO_DEFECTS.length;

function BookBlock({
  item,
  damaged,
}: {
  item: AnchoredBlock;
  damaged?: DemoDefectKey;
}) {
  if (damaged === "chapter") {
    return <p className="flow-demo__damaged-chapter">{item.block.content}</p>;
  }
  if (damaged === "prose") {
    return <p className="flow-demo__damaged-prose">{item.block.content}</p>;
  }
  if (damaged === "poem") {
    return <p className="flow-demo__damaged-poem">{item.block.content}</p>;
  }
  if (item.block.type === "chapter") {
    return <h3 className="flow-demo__book-chapter">{item.block.content}</h3>;
  }
  if (item.block.type === "poem") {
    return <pre className="flow-demo__book-poem">{item.block.content}</pre>;
  }
  return <p className="flow-demo__book-paragraph">{item.block.content}</p>;
}

/** No server actions, API calls, real editorial tasks, or account state. */
export default function EditorialFlowDemo({ view }: { view: View }) {
  const router = useRouter();
  const [session, setSession] = useState<FlowDemoSession>(freshFlowDemo);
  const [ready, setReady] = useState(false);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<DemoDefectKey>("chapter");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const storage = window.localStorage;
      const restored = readFlowDemo(storage.getItem(FLOW_DEMO_KEY));
      // LocalStorage is the sole demo state store. No candidate/work data is fetched.
      setSession(restored);
      setStorageEnabled(true);
    } catch {
      setStorageEnabled(false);
    }
    setReady(true);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function commit(next: FlowDemoSession): boolean {
    try {
      window.localStorage.setItem(FLOW_DEMO_KEY, JSON.stringify(next));
      setSession(next);
      return true;
    } catch {
      setStorageEnabled(false);
      setFeedback("Úložiště prohlížeče není dostupné. Ukázkové změny nelze uchovat.");
      return false;
    }
  }

  function restart() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setChecking(false);
    setSelected("chapter");
    setNote("");
    setFeedback("");
    if (commit(freshFlowDemo())) router.push(FLOW_DEMO_BASE);
  }

  function begin() {
    if (checking || !storageEnabled || session.status !== "new") return;
    setChecking(true);
    setFeedback("");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      commit(queueFlowDemo(session, now()));
      setChecking(false);
    }, 950);
  }

  function openReview() {
    if (!storageEnabled) return;
    if (session.status !== "queued" && session.status !== "in_review") return;
    const next = claimFlowDemo(session);
    if (commit(next)) router.push(FLOW_DEMO_BASE + "/review");
  }

  const selectedDefect = FLOW_DEMO_DEFECTS.find((item) => item.key === selected)!;
  const selectedRepair = session.repairs[selected];
  const repairedCount = Object.keys(session.repairs).length;
  const pending = flowDemoInboxCount(session);

  function chooseBlock(key: DemoDefectKey) {
    setSelected(key);
    setNote("");
    setFeedback("");
  }

  function applyRepair() {
    try {
      const next = repairFlowDemo(session, selected, note, now());
      if (commit(next)) {
        setNote("");
        setFeedback("Ukázková oprava proběhla: změnil se pouze vzhled vybraného bloku. Zdrojový text zůstal beze změny.");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Ukázkovou opravu nelze provést.");
    }
  }

  function complete() {
    try {
      const next = finishFlowDemo(session, now());
      if (commit(next)) router.push(FLOW_DEMO_BASE + "/inbox");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Dokončení není možné.");
    }
  }

  return (
    <div className="flow-demo">
      <header className="flow-demo__header">
        <div className="flow-demo__header-inner">
          <Link href={FLOW_DEMO_BASE} className="flow-demo__brand">ARTales <span>· Redakční laboratoř</span></Link>
          <nav className="flow-demo__nav" aria-label="Navigace demonstrační redakcí">
            <Link href={FLOW_DEMO_BASE} aria-current={view === "candidates" ? "page" : undefined}>Kandidáti</Link>
            <Link href={FLOW_DEMO_BASE + "/inbox"} aria-current={view === "inbox" ? "page" : undefined}>Redakční práce</Link>
            <Link href={FLOW_DEMO_BASE + "/inbox"} className="flow-demo__profile" aria-label={pending ? "Profil fiktivního editora, jeden čekající úkol" : "Profil fiktivního editora, bez čekajících úkolů"}>
              <span aria-hidden="true">◉</span> Profil · editor
              {ready && pending > 0 ? <strong className="flow-demo__badge" aria-label="1 nový úkol">1</strong> : null}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flow-demo__main">
        <p className="flow-demo__eyebrow">ARTales · interaktivní redakční fixture</p>
        <div className="flow-demo__disclaimer" role="note">
          <strong>DEMO / fiktivní text.</strong> Bez skutečné AI, právní clearance, publikace a zápisu do Supabase. Veškeré výsledky a úkoly jsou jen v tomto prohlížeči.
        </div>

        {!ready ? (
          <p role="status">Načítám ukázkovou relaci…</p>
        ) : !storageEnabled ? (
          <div className="flow-demo__panel" role="alert">
            <h2>Prohlížeč blokuje lokální uložení</h2>
            <p>Celý ukázkový průchod používá pouze místní úložiště, bez backendu. Povolte lokální úložiště, aby přechod z kandidátů do inboxu fungoval.</p>
          </div>
        ) : view === "candidates" ? (
          <section className="flow-demo__section">
            <div className="flow-demo__heading-row">
              <div>
                <h1>Kandidáti</h1>
                <p>Vyberte ukázkový literární titul k redakčnímu zpracování.</p>
              </div>
              <span className="flow-demo__counter">1 ukázkový kandidát</span>
            </div>
            <article className="flow-demo__panel flow-demo__candidate">
              <div className="flow-demo__book-icon" aria-hidden="true">A</div>
              <div className="flow-demo__candidate-copy">
                <small>Syntetický kandidát · připraven k demonstraci</small>
                <h2>{FLOW_DEMO_TITLE}</h2>
                <p>{FLOW_DEMO_AUTHOR}</p>
                <p className="flow-demo__muted">Předem připravená ukázka importu a strojového rozdělení rukopisu na bloky.</p>
              </div>
              <div className="flow-demo__candidate-action">
                {session.status === "new" ? (
                  <button type="button" className="flow-demo__primary" disabled={checking} onClick={begin}>
                    {checking ? <><span className="flow-demo__spinner" aria-hidden="true" /> Zpracovávám…</> : "Zahájit zpracování"}
                  </button>
                ) : (
                  <Link href={FLOW_DEMO_BASE + "/inbox"} className="flow-demo__primary">
                    {session.status === "done" ? "Zobrazit dokončenou práci" : "Přejít do redakčního inboxu"}
                  </Link>
                )}
              </div>
            </article>
            {checking ? (
              <div className="flow-demo__panel flow-demo__check" role="status">
                <span className="flow-demo__spinner flow-demo__spinner--ink" aria-hidden="true" />
                Zachycuji modelový zdroj, rozpoznávám kapitoly a vytvářím ukázkový úkol…
              </div>
            ) : null}
            {session.status !== "new" ? (
              <section className="flow-demo__panel flow-demo__check" aria-label="Výsledek modelového právního checku">
                <h2>Ukázkový check dokončen</h2>
                <p><strong>Pouze syntetické výsledky.</strong> Nejde o ověření práv ke skutečné edici ani povolení k vydání.</p>
                <ul className="flow-demo__checklist">
                  {FLOW_DEMO_RIGHTS.map((item) => (
                    <li key={item.label}><span>{item.label}</span><strong>{item.result}</strong></li>
                  ))}
                </ul>
                <p className="flow-demo__notice">
                  {session.status === "done" ? "Redakční kontrola byla lokálně dokončena." : "U profilu nyní svítí 1 nový úkol. Klikněte na profil a vyberte jej z inboxu."}
                </p>
              </section>
            ) : !checking ? (
              <p className="flow-demo__hint">Po spuštění se krátce zobrazí zpracování a demonstrace komponentového checku. Potom se u profilu rozsvítí nový úkol.</p>
            ) : null}
          </section>
        ) : view === "inbox" ? (
          <section className="flow-demo__section">
            <div className="flow-demo__heading-row">
              <div>
                <h1>Moje redakční práce</h1>
                <p>Inbox fiktivního editora · úkoly k převzetí, rozpracované a dokončené.</p>
              </div>
              <span className="flow-demo__counter">{pending} k vyřízení</span>
            </div>
            {session.status === "new" ? (
              <div className="flow-demo__panel">
                <h2>Zatím žádné redakční úkoly</h2>
                <p>Nejprve vyberte kandidáta a zahajte demonstrační zpracování.</p>
                <Link href={FLOW_DEMO_BASE} className="flow-demo__primary">Otevřít kandidáty</Link>
              </div>
            ) : (
              <article className="flow-demo__panel flow-demo__task">
                <div>
                  <span className={"flow-demo__task-status" + (session.status === "done" ? " flow-demo__task-status--done" : "")}>
                    {session.status === "queued" ? "Nový úkol" : session.status === "in_review" ? "Rozpracováno" : "Dokončeno lokálně"}
                  </span>
                  <h2>{FLOW_DEMO_TITLE}</h2>
                  <p>Textová a bloková kontrola · {FLOW_DEMO_AUTHOR}</p>
                  <p className="flow-demo__muted">Opraveno bloků: {repairedCount} ze {totalDefects}. Bez právního schválení a bez publikace.</p>
                </div>
                {session.status === "done" ? (
                  <button type="button" className="flow-demo__secondary" onClick={restart}>Spustit ukázku znovu</button>
                ) : (
                  <button type="button" className="flow-demo__primary" onClick={openReview}>
                    {session.status === "queued" ? "Převzít a otevřít kontrolu" : "Pokračovat v kontrole"}
                  </button>
                )}
              </article>
            )}
            <p className="flow-demo__hint">Tento inbox je pouze ukázková navigace; nemění skutečné přidělení redakčních úkolů.</p>
          </section>
        ) : session.status !== "in_review" ? (
          <section className="flow-demo__section flow-demo__panel">
            <h1>Duální redakční kontrola</h1>
            <p>Úkol není aktuálně rozpracovaný. Převzetí i návrat do kontroly se provádí přes demonstrační inbox.</p>
            <Link className="flow-demo__primary" href={FLOW_DEMO_BASE + "/inbox"}>Přejít do inboxu</Link>
          </section>
        ) : (
          <section className="flow-demo__section">
            <div className="flow-demo__heading-row">
              <div>
                <Link className="flow-demo__back" href={FLOW_DEMO_BASE + "/inbox"}>← Zpět do inboxu</Link>
                <h1>Duální kontrola · {FLOW_DEMO_TITLE}</h1>
                <p>Vlevo nedotčený rukopis, vpravo sázený návrh. Tři chyby jsou záměrné.</p>
              </div>
              <span className="flow-demo__counter">{repairedCount} / {totalDefects} opraveno</span>
            </div>
            <div className="flow-demo__review-grid">
              <section className="flow-demo__book">
                <div className="flow-demo__book-head">
                  <strong>Originál</strong><span>Neměnný zdroj</span>
                </div>
                <div className="flow-demo__book-scroll">
                  {previewBlocks.map((item) => {
                    const defect = defectByBlockId.get(item.block.id);
                    return <div key={item.block.id} className={"flow-demo__source-block" + (defect?.key === selected ? " flow-demo__source-block--selected" : "")}>
                      <BookBlock item={item} />
                    </div>;
                  })}
                </div>
              </section>
              <section className="flow-demo__book">
                <div className="flow-demo__book-head">
                  <strong>ARTales Reader · návrh</strong><span>{FLOW_DEMO_COMPOSITION.qa.ok ? "Integrita textu: OK" : "Integrita zdroje: CHYBA"}</span>
                </div>
                <div className="flow-demo__book-scroll">
                  {previewBlocks.map((item) => {
                    const defect = defectByBlockId.get(item.block.id);
                    const fixed = defect ? Boolean(session.repairs[defect.key]) : false;
                    return defect ? (
                      <button key={item.block.id} type="button"
                        className={"flow-demo__selectable" +
                          (defect.key === selected ? " flow-demo__selectable--active" : "") +
                          (fixed ? " flow-demo__selectable--fixed" : " flow-demo__selectable--broken")}
                        onClick={() => chooseBlock(defect.key)}
                        aria-pressed={defect.key === selected}>
                        <span className="flow-demo__block-tag">{fixed ? "✓ Opraveno" : "⚠ " + defect.title}</span>
                        <BookBlock item={item} damaged={fixed ? undefined : defect.key} />
                      </button>
                    ) : (
                      <div key={item.block.id} className="flow-demo__normal-block"><BookBlock item={item} /></div>
                    );
                  })}
                </div>
              </section>
            </div>
            <section className="flow-demo__panel flow-demo__notes" aria-label="Připomínka k vybranému bloku">
              <div className="flow-demo__notes-head">
                <div>
                  <small>Redakční připomínka · vybraný blok</small>
                  <h2>{selectedDefect.title}</h2>
                  <p>{selectedDefect.problem}</p>
                </div>
                <span className="flow-demo__task-status">{selectedRepair ? "Opraveno" : "K opravě"}</span>
              </div>
              {selectedRepair ? (
                <p className="flow-demo__repair-result">✓ Oprava je vidět v pravé stránce. Poznámka editora: „{selectedRepair.note}“</p>
              ) : (
                <div className="flow-demo__note-form">
                  <label htmlFor="flow-demo-note">Co je potřeba opravit?</label>
                  <textarea id="flow-demo-note" value={note} maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={selectedDefect.example} rows={2} />
                  <button type="button" className="flow-demo__primary" onClick={applyRepair} disabled={note.trim().length < 3}>
                    Odeslat připomínku a opravit blok
                  </button>
                  <small>Ukázková oprava je předem definovaná podle vybraného bloku; text poznámky se neodesílá žádnému AI modelu.</small>
                </div>
              )}
              {feedback ? <p role="status" className="flow-demo__notice">{feedback}</p> : null}
              <div className="flow-demo__finish">
                <p>Po opravě alespoň dvou bloků můžete kontrolu dokončit. Bez změny původního obsahu.</p>
                <button type="button" className="flow-demo__primary" onClick={complete}
                  disabled={repairedCount < 2 || !FLOW_DEMO_COMPOSITION.qa.ok}>
                  Uložit a dokončit kontrolu
                </button>
              </div>
            </section>
          </section>
        )}
        {ready && session.status !== "new" && view !== "review" ? (
          <p className="flow-demo__reset"><button type="button" onClick={restart}>Obnovit demonstrační scénář od začátku</button></p>
        ) : null}
      </main>
    </div>
  );
}
