import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, Code2, FileText, FlaskConical, Lightbulb, MessageSquare, Play, RotateCcw, ShieldCheck, Terminal, XCircle } from 'lucide-react';
import { Button } from '../components/ui';
import { allPassed, missions, type MissionId, type PracticeRun } from '../../shared/firststep';
import { runPractice } from './runner';
import { readSession, saveSession, type MissionProgress } from './session';
import { PracticeTextarea } from './fields';
import './firststep.css';

export default function FirstStep() {
  const [initial] = useState(readSession);
  const [session, setSession] = useState(initial.session);
  const [saveWarning, setSaveWarning] = useState(initial.warning);
  const [busy, setBusy] = useState<'baseline' | 'review' | 'preview' | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachReply, setCoachReply] = useState('');
  const [coachEnabled, setCoachEnabled] = useState(false);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachUses, setCoachUses] = useState(0);
  const [previewCase, setPreviewCase] = useState(0);
  const [previewResult, setPreviewResult] = useState<{ source: string; caseId: string; actual: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const coachController = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = session.current;
  const mission = missions[current];
  const progress = session.progress[current];
  const passing = allPassed(progress.review, progress.source, mission.checks.length);
  const unlocked = allPassed(session.progress.checkout.review, session.progress.checkout.source, missions.checkout.checks.length) && session.progress.checkout.notes.trim().length >= 40;
  const update = (change: Partial<MissionProgress>) => setSession(s => ({ ...s, progress: { ...s.progress, [current]: { ...s.progress[current], ...change } } }));

  useEffect(() => {
    if (!saveSession(session)) setSaveWarning('Browser storage is unavailable. Download your evidence before leaving; this draft exists only in this page.');
  }, [session]);
  useEffect(() => {
    document.title = `FirstStep · ${mission.ticket} practice shift`;
  }, [mission.ticket]);
  useEffect(() => {
    if (!saveWarning) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveWarning]);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/firststep/config', { signal: abort.signal }).then(r => r.ok ? r.json() : null).then(data => setCoachEnabled(data?.enabled === true)).catch(() => undefined);
    return () => { abort.abort(); controller.current?.abort(); coachController.current?.abort(); };
  }, []);

  async function run(mode: 'baseline' | 'review') {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    const source = mode === 'baseline' ? mission.starter : progress.source;
    setBusy(mode); setError(''); setStatus('Running the scenario checks…');
    try {
      const results = await runPractice(source, mission.checks, abort.signal);
      const result: PracticeRun = { source, results, at: new Date().toISOString() };
      update(mode === 'baseline' ? { baseline: result } : { review: result, attempts: progress.attempts + 1 });
      setStatus(`${mode === 'baseline' ? 'Original code' : 'Your draft'}: ${results.filter(r => r.passed).length} of ${results.length} checks passed.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Checks could not finish. Try again.'); setStatus('Checks did not finish.'); }
    finally { controller.current = null; setBusy(null); }
  }

  async function preview() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy('preview'); setError('');
    try {
      const result = await runPractice(progress.source, [mission.checks[previewCase]], abort.signal);
      setPreviewResult({ source: progress.source, caseId: result[0].id, actual: result[0].actual });
      setStatus('Test interaction completed against your current draft. Run all checks before accepting a fix.');
    } catch (err) { setError(err instanceof Error ? err.message : 'The test interaction could not finish.'); }
    finally { controller.current = null; setBusy(null); }
  }

  function navigate(id: MissionId) {
    if (busy || coachBusy || (id === 'reservation' && !unlocked)) return;
    setSession(s => ({ ...s, current: id }));
    setError(''); setStatus(''); setExpanded(null); setShowReset(false); setCoachReply(''); setCoachQuestion(''); setCoachError('');
    setPreviewCase(0); setPreviewResult(null);
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function askCoach() {
    if (coachBusy || !coachQuestion.trim()) return;
    const abort = new AbortController(); coachController.current = abort;
    setCoachBusy(true); setCoachError('');
    try {
      const response = await fetch('/api/firststep/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ question: coachQuestion, mission: current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Coaching is unavailable. The authored hints still work.');
      setCoachReply(data.reply); setCoachUses(n => n + 1);
    } catch (err) { if (!abort.signal.aborted) setCoachError(err instanceof Error ? err.message : 'Could not reach the coach. Your draft is unchanged.'); }
    finally { setCoachBusy(false); coachController.current = null; }
  }

  function exportEvidence() {
    const evidence = { product: 'FirstStep', version: 1, exportedAt: new Date().toISOString(), scope: 'Self-directed practice record. Not a verified credential or proof of independent work.', guidance: { authoredHints: session.progress.checkout.hints, liveRepliesReceivedThisPage: coachUses }, progress: session.progress };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'firststep-practice-evidence.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Practice evidence downloaded. It includes your drafts and observations.');
  }

  const reviewed = progress.review;
  const stale = reviewed && reviewed.source !== progress.source;
  return <div className="fs-app">
    <a className="skip-link" href="#practice-main">Skip to practice</a>
    <aside className="fs-rail">
      <a className="fs-brand" href="/" aria-label="FirstStep practice home"><span className="fs-mark"><ArrowUpRight size={23} strokeWidth={2.5} /></span>firststep<span className="fs-brand-dot">.</span></a>
      <div className="fs-rail-caption">YOUR PRACTICE SHIFT</div>
      <nav aria-label="Practice missions">
        <button className="fs-mission-nav" aria-current={current === 'checkout' ? 'page' : undefined} onClick={() => navigate('checkout')} disabled={Boolean(busy || coachBusy)}><Code2 size={19}/><span>Checkout incident<small>Guided investigation</small></span>{unlocked && <Check size={16}/>}</button>
        <button className="fs-mission-nav" aria-current={current === 'reservation' ? 'page' : undefined} onClick={() => navigate('reservation')} disabled={!unlocked || Boolean(busy || coachBusy)} aria-describedby={!unlocked ? 'transfer-lock' : undefined}><FlaskConical size={19}/><span>Transfer task<small>New context · fewer hints</small></span></button>
      </nav>
      {!unlocked && <p id="transfer-lock" className="fs-rail-note">Pass the checkout checks and explain your fix to unlock the next task.</p>}
      <div className="fs-rail-bottom"><div className="fs-practice-label"><span/>Practice prototype</div><p>Real code execution.<br/>Authored scenario evidence.</p><p><a href="https://nebiusglobalaihackathon.devpost.com/" target="_blank" rel="noreferrer">Nebius × NVIDIA<br/>Global AI Hackathon <ArrowUpRight size={14}/></a></p><a href="/accessfix">Companion workbench <ArrowUpRight size={14}/></a></div>
    </aside>
    <main id="practice-main" className="fs-main" tabIndex={-1}>
      <header className="fs-topbar"><span>Engineering lab <ChevronRight size={13}/> First shift</span><span className="fs-save-state">{saveWarning ? 'Draft in this page' : 'Draft saved in this tab'}</span></header>
      {saveWarning && <p className="fs-notice" role="status">{saveWarning}</p>}
      {initial.restored && <p className="fs-notice">Your drafts were restored. Run the checks again to rebuild execution evidence and unlock the transfer task.</p>}
      <div className="fs-heading"><div><div className="fs-kicker"><span>{mission.ticket}</span> {current === 'checkout' ? 'GUIDED MISSION' : 'TRANSFER TASK'}</div><h1 ref={heading} tabIndex={-1}>{mission.title}</h1><p>{mission.summary}</p></div><div className="fs-heading-stamp"><Terminal size={23}/><span>Read. Investigate.<br/><strong>Make it work.</strong></span></div></div>
      <ol className="fs-process" aria-label="Practice progress">
        <li className={progress.viewed.length ? 'is-done' : ''}><span>{progress.viewed.length ? <Check size={14}/> : '1'}</span><div>Investigate<small>{progress.viewed.length} evidence items opened</small></div></li>
        <li className={progress.source !== mission.starter ? 'is-done' : ''}><span>2</span><div>Make a change<small>{progress.source !== mission.starter ? 'Draft edited' : 'Original code loaded'}</small></div></li>
        <li className={passing ? 'is-done' : ''}><span>{passing ? <Check size={14}/> : '3'}</span><div>Verify & explain<small>{passing ? 'Checks passed · add your reasoning' : 'Protect the working paths'}</small></div></li>
      </ol>
      <div className="fs-workspace">
        <section className="fs-case" aria-labelledby="case-title"><div className="fs-panel-heading"><MessageSquare size={17}/><h2 id="case-title">The handoff</h2><span>SIMULATED</span></div>
          <div className="fs-customer"><div className="fs-avatar">{current === 'checkout' ? 'M' : 'N'}</div><div><strong>{mission.customer}</strong><small>Initial support ticket</small></div></div>
          <p className="fs-message">{mission.customerMessage}</p>
          <div className="fs-evidence-heading"><h3>Follow the evidence</h3><span>{progress.viewed.length}/{mission.artifacts.length}</span></div>
          <div className="fs-artifacts">{mission.artifacts.map(artifact => <div key={artifact.id} className="fs-artifact"><button aria-expanded={expanded === artifact.id} aria-controls={`artifact-${artifact.id}`} onClick={() => { setExpanded(expanded === artifact.id ? null : artifact.id); if (!progress.viewed.includes(artifact.id)) update({ viewed: [...progress.viewed, artifact.id] }); }}><FileText size={17}/><span>{artifact.title}<small>{artifact.kind}</small></span>{progress.viewed.includes(artifact.id) ? <Check size={15}/> : <ChevronRight size={15}/>}</button>{expanded === artifact.id && <div id={`artifact-${artifact.id}`} className="fs-artifact-content">{artifact.content}</div>}</div>)}</div>
          <details className="fs-contract"><summary><BookOpen size={16}/>Acceptance criteria</summary><ul>{mission.contract.map(rule => <li key={rule}>{rule}</li>)}</ul></details>
          <div className="fs-baseline"><Button onClick={() => void run('baseline')} busy={busy === 'baseline'} disabled={Boolean(busy)}><Play size={15}/>Reproduce incident</Button><p>{progress.baseline ? `Original code passes ${progress.baseline.results.filter(r => r.passed).length}/${mission.checks.length} checks. ${progress.baseline.results.filter(r => !r.passed).length} failures reproduced.` : 'Run the original code to establish a baseline.'}</p></div>
          <div className="fs-coach"><div className="fs-panel-heading"><Lightbulb size={18}/><h2>When you get stuck</h2></div>
            {current === 'checkout' ? <><p>Hints reveal one more step of the reasoning. They are recorded in your practice evidence.</p>{mission.hints.slice(0, progress.hints).map((hint, i) => <div className="fs-hint" key={hint}><strong>Hint {i + 1}</strong><p>{hint}</p></div>)}<Button onClick={() => update({ hints: progress.hints + 1 })} disabled={progress.hints >= mission.hints.length}>{progress.hints >= mission.hints.length ? 'All hints revealed' : 'Reveal next hint'}<ArrowRight size={14}/></Button></> : <p>This transfer task has no mentor hints. Use its acceptance criteria and check results; report any outside help in your notes.</p>}
            <p className="fs-coach-mode">Authored guidance · live AI {coachEnabled ? 'available for the guided mission' : 'disabled'}</p>
            {coachEnabled && current === 'checkout' && <form noValidate onSubmit={e => { e.preventDefault(); void askCoach(); }}><label htmlFor="coach-question">Ask the Nemotron coach</label><PracticeTextarea id="coach-question" rows={3} maxLength={800} value={coachQuestion} onChange={e => setCoachQuestion(e.target.value)} /><p>Only this question and the public scenario facts are sent to Nebius. A request uses inference credits.</p><Button type="submit" disabled={!coachQuestion.trim()} busy={coachBusy}>Ask coach</Button>{coachError && <p role="alert">{coachError}</p>}{coachReply && <p className="fs-hint">{coachReply}</p>}</form>}
          </div>
        </section>
        <div className="fs-build-column">
          <section className="fs-preview" aria-labelledby="preview-title"><div className="fs-panel-heading"><FlaskConical size={17}/><h2 id="preview-title">Try the customer’s journey</h2><span>TEST APP</span></div><div className="fs-preview-choices" role="group" aria-label="Test order scenario"><button aria-pressed={previewCase === 0} disabled={Boolean(busy)} onClick={() => setPreviewCase(0)}>{current === 'checkout' ? '100% discount' : 'Complimentary seat'}</button><button aria-pressed={previewCase === 2} disabled={Boolean(busy)} onClick={() => setPreviewCase(2)}>{current === 'checkout' ? 'Paid order' : 'Ineligible attendee'}</button></div><div className="fs-order"><div><span>{current === 'checkout' ? 'Studio Course · Digital product' : 'Design Workshop · Reservation'}</span><strong>{current === 'checkout' && previewCase === 2 ? '€49.00' : '€0.00'}</strong><small>{current === 'checkout' && previewCase === 2 ? 'Test payment token available' : current === 'reservation' && previewCase === 2 ? 'Eligibility: false · no card' : 'No payment method entered'}</small></div><Button busy={busy === 'preview'} disabled={Boolean(busy)} onClick={() => void preview()}>{current === 'checkout' ? 'Place test order' : 'Reserve test seat'}<ArrowRight size={14}/></Button></div><div className="fs-preview-result" role="status">{previewResult && previewResult.source === progress.source && previewResult.caseId === mission.checks[previewCase].id ? previewResult.actual === 'confirm' ? 'Confirmed without payment. The customer can continue.' : previewResult.actual === 'charge' ? 'A payment would be requested. No real charge was made.' : previewResult.actual === 'reject' ? 'Unable to complete. The customer sees a rejected request.' : `Unexpected decision: ${previewResult.actual}` : 'Uses your current draft. All orders and payments are simulated.'}</div></section>
          <section className="fs-editor-panel" aria-labelledby="editor-title"><div className="fs-panel-heading"><Code2 size={17}/><h2 id="editor-title">{mission.file}</h2><span>JAVASCRIPT</span></div><div className="fs-editor-help" id="code-help">Edit <code>decide(input)</code>. Return <code>reject</code>, <code>confirm</code>, or <code>charge</code>.</div>
            <label className="sr-only" htmlFor="practice-code">Decision function</label><PracticeTextarea id="practice-code" className="fs-code" spellCheck={false} autoCapitalize="off" autoComplete="off" aria-describedby="code-help" value={progress.source} maxLength={6000} readOnly={Boolean(busy)} onChange={e => { update({ source: e.target.value }); setStatus('Draft changed. Run checks to verify this version.'); }} />
            <div className="fs-editor-actions"><span>{progress.source.length.toLocaleString('en-US')} / 6,000 characters</span><div><Button variant="quiet" disabled={Boolean(busy)} onClick={() => setShowReset(!showReset)}><RotateCcw size={14}/>Restore original</Button><Button variant="primary" busy={busy === 'review'} disabled={Boolean(busy)} onClick={() => void run('review')}><Play size={15}/>Run checks</Button></div></div>
            {showReset && <div className="fs-reset"><p>Replace this draft with the original code? Your observations and previous results remain.</p><Button disabled={Boolean(busy)} onClick={() => { update({ source: mission.starter }); setShowReset(false); setStatus('Original code restored. Previous results may be out of date.'); }}>Restore code</Button><Button variant="quiet" onClick={() => setShowReset(false)}>Keep editing</Button></div>}
          </section>
          <div className="fs-run-status" role="status" aria-live="polite">{status || 'Ready when you are. No code is sent to a server.'}</div>
          {busy && <Button variant="quiet" onClick={() => controller.current?.abort()}>Cancel checks</Button>}
          {error && <p className="fs-error" role="alert">{error}</p>}
          <section className="fs-review" aria-labelledby="review-title"><div className="fs-panel-heading"><ShieldCheck size={18}/><h2 id="review-title">Review evidence</h2><span>{progress.attempts} RUN{progress.attempts === 1 ? '' : 'S'}</span></div>
            {!reviewed ? <div className="fs-review-empty"><div className="fs-check-glyph"><Check size={22}/></div><div><h3>A fix needs evidence.</h3><p>Run your draft against the business rules. You’ll see what works, what broke, and why.</p></div></div> : <><div className={`fs-review-summary ${passing ? 'is-passing' : ''}`}><strong>{reviewed.results.filter(r => r.passed).length}/{mission.checks.length}</strong><span>{stale ? 'Results belong to an earlier draft. Run checks again.' : passing ? 'All authored checks passed. Explain your reasoning below.' : 'Some behaviours still need attention. Inspect the failed checks.'}</span></div><ul className="fs-checks">{reviewed.results.map(result => <li key={result.id}><details><summary>{result.passed ? <CheckCircle2 size={16} className="fs-pass"/> : <XCircle size={16} className="fs-fail"/>}<span>{result.label}</span><strong>{result.passed ? 'Pass' : 'Fail'}</strong></summary><div><p>{result.reason}</p><p>Expected <code>{result.expected}</code> · received <code>{result.actual}</code></p></div></details></li>)}</ul></>}
          </section>
          <section className="fs-notebook"><label htmlFor="practice-notes">Leave a handoff for your reviewer</label><p id="notes-help">What caused the issue? What did you change, and what could have regressed? Mention any outside assistance. At least 40 characters unlocks the next task; this is not an AI-graded answer.</p><PracticeTextarea id="practice-notes" rows={4} maxLength={2000} placeholder="My hypothesis was… The evidence showed… I checked…" value={progress.notes} onChange={e => update({ notes: e.target.value })} aria-describedby="notes-help"/><div className="fs-notebook-footer"><span>{progress.notes.trim().length}/40 minimum characters</span>{current === 'checkout' ? <Button variant="primary" disabled={!unlocked || Boolean(busy)} onClick={() => navigate('reservation')}>Try the transfer task<ArrowRight size={15}/></Button> : passing && <span className="fs-pass"><CheckCircle2 size={16}/>Transfer checks passed</span>}</div></section>
          <div className="fs-export"><div><strong>Your work, with the evidence.</strong><p>Download drafts, checks, observations and recorded assistance. This is a practice record, not a hiring credential.</p></div><Button onClick={exportEvidence} disabled={Boolean(busy || coachBusy)}><ArrowDownToLine size={16}/>Download evidence</Button></div>
        </div>
      </div>
      <footer className="fs-footer"><span>FirstStep · Nebius × NVIDIA Global AI Hackathon</span><span>Practice locally. Learn deliberately.</span></footer>
    </main>
  </div>;
}
