import { useEffect, useState } from 'react';
import { Atom, Check, Code2, FileSearch, Info, LoaderCircle, Play, ShieldCheck, Sparkles, Square, Terminal, X } from 'lucide-react';
import type { Config, FixtureId, Run, RunMode } from '../../shared/types';
import { Button, Status } from './ui';
import { RunEvidence } from './RunEvidence';
import { api } from '../hooks/useWorkbench';
import { contracts } from '../../shared/contracts';

interface Props { config?: Config; run?: Run; active: boolean; busy: boolean; loading: boolean; start: (fixture: string, mode: RunMode) => Promise<void>; cancel: () => Promise<void>; clear: () => void; setup: () => void; }
function BrowserCapture({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setFailed(false); setRetry(0); }, [src]);
  return failed ? <div className="capture-error" role="status"><Info size={24} /><p>This browser capture could not be loaded.</p><Button onClick={() => { setFailed(false); setRetry(value => value + 1); }}>Reload capture</Button></div> : <img className="browser-capture" src={`${src}?retry=${retry}`} alt={alt} onError={() => setFailed(true)} />;
}
export default function Workbench({ config, run, active, busy, loading, start, cancel, clear, setup }: Props) {
  const [fixture, setFixture] = useState<FixtureId>('signup');
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState<{ source: string; file: string }>();
  const [sourceError, setSourceError] = useState('');
  const [capture, setCapture] = useState<'before' | 'after'>('before');
  const savedFixture = config?.fixtures.find(item => item.id === run?.fixture)?.id;
  useEffect(() => { if (savedFixture) setFixture(savedFixture); }, [run?.id, savedFixture]);
  useEffect(() => { setCapture('before'); }, [run?.id]);
  useEffect(() => {
    if (!showSource) return;
    if (run) { setSource({ source: run.source, file: run.file }); setSourceError(''); return; }
    const controller = new AbortController(); setSource(undefined); setSourceError('');
    api<{ source: string; file: string }>(`/api/fixtures/${fixture}/source`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setSource(value); }).catch(() => { if (!controller.signal.aborted) setSourceError('Could not load source. Close and reopen this panel to retry.'); });
    return () => controller.abort();
  }, [fixture, run?.id, showSource]);
  const customRun = !!run && !config?.fixtures.some(item => item.id === run.fixture);
  const contract = config?.fixtures.find(item => item.id === fixture)?.contract || run?.contract || 'signup';
  const journey = contracts[contract];
  const exerciseFixture = contract === 'signup' ? 'signup' : fixture;
  const last = run?.attempts.at(-1);
  const evidence = capture === 'after' ? last?.evidence : run?.baseline;
  const latestStage = run?.state;
  const steps = [
    { name: 'Reproduce the barrier', text: 'Run automated checks on the journey to find real accessibility issues.', done: !!run?.baseline, active: latestStage === 'auditing' },
    { name: 'Ask Nemotron for a patch', text: 'Get a targeted component change with an explanation you can review.', done: !!run?.attempts.length, active: latestStage === 'proposing' },
    { name: 'Replay the same checks', text: 'Verify the fix and catch regressions with the original acceptance tests.', done: !!last?.evidence, active: latestStage === 'verifying' },
    { name: 'Review the evidence', text: 'Compare results and source changes. Decide what is ready to keep.', done: latestStage === 'accepted' || latestStage === 'clean', active: false },
  ];
  const startRun = (mode: RunMode) => { setCapture('before'); void start(fixture, mode); };
  const repairAvailable = config?.repairAvailable ?? config?.providerConfigured;
  return <>
    <div className="page-heading"><div><h1>Make the next step possible.</h1><p>Reproduce a barrier. Propose a fix. Prove the journey works.</p></div><Button onClick={() => setShowSource(!showSource)} aria-expanded={showSource} aria-controls="component-source"><Code2 size={18} />{showSource ? 'Hide source' : 'View source'}</Button></div>
    {config?.hostedDemo && <div className="notice"><Info size={17} /><span>{config.judgeWorker ? 'Private Mac worker · inference disabled. Run fresh browser audits' : 'Judge demo: run fresh browser audits'} on the included fixtures, or <a href="#history">inspect the recorded live NVIDIA/Nebius repair</a>. Recorded evidence makes no new model call.{config.ephemeralStorage && ' Fresh checks can take up to three minutes per component on free hosting.'}</span></div>}
    {showSource && <section className="panel source-panel" id="component-source"><div className="section-heading"><h2>{source?.file || 'Component source'}</h2><span className="tag">Read only</span></div>{sourceError ? <p role="alert">{sourceError}</p> : <pre><code>{source?.source || 'Loading component…'}</code></pre>}</section>}
    <section className="run-setup" aria-label="Configure an accessibility run"><div className="fixture-field"><Atom size={31} strokeWidth={1.5} /><div><label className="sr-only" htmlFor="fixture">Choose a component fixture</label><select id="fixture" value={customRun ? 'local' : fixture} disabled={active || busy} onChange={event => { setFixture(event.target.value as FixtureId); clear(); setShowSource(false); }}>{customRun && <option value="local" disabled>Local: {run.fixtureName}</option>}{config?.fixtures.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span>{customRun ? 'CLI evidence · select a fixture to run again' : 'Controlled fixture'}</span></div></div><div className="check-scope"><span className="scope-icon"><Check size={13} /></span>{journey.scope}</div><div className="setup-actions">{active ? <Button onClick={() => void cancel()} busy={busy}><Square size={15} />Cancel run</Button> : <Button variant="primary" busy={busy} disabled={loading || !config || customRun} onClick={() => startRun('audit')}><Play size={15} fill="currentColor" />Run audit</Button>}</div></section>
    <div className="workbench-grid">
      <section className="panel journey" aria-labelledby="journey-title"><div className="section-heading"><h2 id="journey-title">The user journey</h2>{run && <Status state={run.state} />}</div><span className="eyebrow">01 / {journey.journey.toUpperCase()}</span><p className="muted journey-description">{journey.name}, tested from the keyboard.</p>
        {run?.baseline && <div className="capture-toolbar"><div className="segmented" aria-label="Browser capture"><button aria-pressed={capture === 'before'} onClick={() => setCapture('before')}>Before</button><button disabled={!last?.evidence} aria-pressed={capture === 'after'} onClick={() => setCapture('after')}>Candidate {last?.number || ''}</button></div><a className="caption" href={evidence && run ? `/api/runs/${run.id}/artifacts/${evidence.screenshot}` : undefined} target="_blank" rel="noreferrer">Open Chromium capture</a></div>}
        <div className="browser-frame"><div className="browser-chrome"><span className="window-dots"><i /><i /><i /></span><span className="browser-url">localhost / {fixture}</span><span className="browser-shield"><ShieldCheck size={14} /></span></div>{evidence && run ? <BrowserCapture src={`/api/runs/${run.id}/artifacts/${evidence.screenshot}`} alt={`${capture === 'before' ? 'Original' : 'Candidate'} component captured during run ${run.id.slice(0, 8)}`} /> : <iframe key={fixture} title={`${journey.name} fixture preview — intentionally contains barriers`} src={`/api/fixtures/${fixture}/preview`} sandbox="allow-scripts" />}</div>
        <div className="journey-note"><Info size={16} /><span>{run?.baseline ? `${run.baseline.checks.filter(check => !check.passed).length} of ${run.baseline.checks.length} baseline checks failed. Expand each result below for the evidence.` : 'Try the preview with Tab. Browser evidence appears after your first run.'}</span></div>
      </section>
      <section className="panel verification" aria-labelledby="verification-title"><h2 id="verification-title">Verification, step by step</h2><ol className="steps">{steps.map((step, index) => <li key={step.name} className={`${step.done ? 'step-done' : ''} ${step.active ? 'step-active' : ''}`}><span className="step-number">{step.active ? <LoaderCircle size={18} className="spinner" /> : step.done ? <Check size={17} /> : index + 1}</span><div><h3>{run?.mode.startsWith('verify-') && index === 1 ? run.mode === 'verify-recorded' ? 'Load the recorded candidate' : 'Load the known candidate' : step.name}</h3><p>{run?.mode.startsWith('verify-') && index === 1 ? run.mode === 'verify-recorded' ? 'Recheck the original recorded AI candidate. No new model call.' : 'A prepared patch tests the verification gate. This exercise makes no AI call.' : step.text}</p></div></li>)}</ol>
        {run && <div className="run-progress" role="status"><span className={`progress-indicator ${active ? 'is-active' : ''}`} />{run.summary}</div>}
        {run?.baseline && !active && !customRun && !['clean', 'accepted'].includes(run.state) && <div className="repair-action"><Button variant="primary" disabled={!repairAvailable || busy} onClick={() => startRun('repair')}><Sparkles size={17} />Repair with Nemotron</Button>{repairAvailable ? <p>Shares this component and findings with Nebius. Up to {config?.maxAttempts || 2} model request(s).</p> : config?.hostedDemo ? <p>{config.repairUnavailableReason}</p> : <p><button className="text-link" onClick={setup}>Add your Nebius key</button> to enable live repairs.</p>}</div>}
        {run?.usage.requests ? <dl className="usage"><div><dt>Model requests</dt><dd>{run.usage.requests}</dd></div><div><dt>Reported tokens</dt><dd>{(run.usage.inputTokens + run.usage.outputTokens).toLocaleString()}</dd></div><div><dt>Inference time</dt><dd>{(run.usage.latencyMs / 1000).toFixed(1)}s</dd></div></dl> : null}
      </section>
    </div>
    {run ? <RunEvidence key={run.id} run={run} /> : <section className="panel trust-panel"><h2>Built to show its work</h2><div className="trust-grid"><div><FileSearch /><div><h3>Same tests, before and after</h3><p>Replay the original journey on both versions. See exactly what changed.</p></div></div><div><Code2 /><div><h3>Your source stays untouched</h3><p>Review proposed changes in isolation. You decide which patch to keep.</p></div></div><div><ShieldCheck /><div><h3>Unresolved is a valid result</h3><p>If a safe repair cannot be verified, the issue stays open for human review.</p></div></div></div><div className="trust-footnote"><Info size={16} />Automated checks cover this journey. Human accessibility review still matters.</div></section>}
    <details className="verification-lab"><summary><Terminal size={17} />Verification lab<span>Test the gate without an API key</span></summary><div><p>Test a prepared accessible patch or a behavior-breaking candidate against the selected contract. Signup exercises use React signup. Replay the original recorded AI repair with fresh checks and keyboard traces. None of these exercises make a model call.</p><div className="action-row"><Button disabled={active || busy || !config} onClick={() => { setFixture(exerciseFixture); void start(exerciseFixture, 'verify-good'); }}><Check size={16} />Test a good patch</Button><Button disabled={active || busy || !config} onClick={() => { setFixture(exerciseFixture); void start(exerciseFixture, 'verify-regression'); }}><X size={16} />Test a regression</Button><Button disabled={active || busy || !config} onClick={() => { setFixture('signup'); void start('signup', 'verify-recorded'); }}><Play size={16} />Replay recorded repair</Button></div></div></details>
  </>;
}
