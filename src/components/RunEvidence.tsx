import { Check, CheckCheck, ChevronRight, Download, FileCode2, Info, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Run } from '../../shared/types';
import { ACTIVE_STATES } from '../../shared/types';
import { Button, Status } from './ui';
import { FocusReplay } from './FocusReplay';

function Result({ value }: { value?: boolean }) { return value === undefined ? <span className="result neutral"><Minus size={14} />Pending</span> : value ? <span className="result pass"><Check size={14} />Pass</span> : <span className="result fail"><X size={14} />Fail</span>; }
export function RunEvidence({ run }: { run: Run }) {
  const [view, setView] = useState<'checks' | 'patch' | 'events' | 'replay'>('checks');
  const [attemptIndex, setAttemptIndex] = useState(0);
  useEffect(() => { setAttemptIndex(Math.max(0, run.attempts.length - 1)); }, [run.attempts.length]);
  const attempt = run.attempts[Math.min(attemptIndex, run.attempts.length - 1)];
  const complete = !ACTIVE_STATES.includes(run.state);
  return <section className="panel evidence" aria-labelledby="evidence-title">
    <div className="section-heading"><div><span className="eyebrow">THE EVIDENCE</span><h2 id="evidence-title">Every check. Both versions.</h2></div><div className="action-row">{complete && <a className="button button-secondary" href={`/api/runs/${run.id}/report`} download><Download size={16} />Export report</a>}{run.state === 'accepted' && <a className="button button-primary" href={`/api/runs/${run.id}/patch`} download><FileCode2 size={16} />Download patch</a>}</div></div>
    <div className="result-summary"><Status state={run.state} /><p>{run.summary}</p></div>
    {run.recordedDemo && <div className="notice"><Info size={17} /><span>Recorded live NVIDIA/Nebius repair from 29 October 2026. This saved evidence includes the original model output; viewing it makes no new inference request.</span></div>}
    {run.mode.startsWith('verify-') && <div className="notice"><Info size={17} /><span>{run.mode === 'verify-recorded' ? 'Fresh verification of the original recorded NVIDIA/Nebius candidate. The source was not edited and no new model request was made.' : 'Known-patch exercise. These are real browser results for a prepared candidate; no AI call was made.'}</span></div>}
    <div className="evidence-toolbar"><div className="segmented" aria-label="Evidence view">{(['checks', 'replay', 'patch', 'events'] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'checks' ? 'Check results' : item === 'replay' ? 'Keyboard replay' : item === 'patch' ? 'Source diff' : 'Run events'}</button>)}</div>{run.attempts.length > 1 && <label className="attempt-label">Candidate<select value={attemptIndex} onChange={event => setAttemptIndex(Number(event.target.value))}>{run.attempts.map((item, index) => <option key={item.number} value={index}>Attempt {item.number}{item.accepted ? ' · accepted' : ' · not accepted'}</option>)}</select></label>}</div>
    {view === 'replay' && <FocusReplay key={attempt?.number || 0} runId={run.id} before={run.baseline?.focusTrace} after={attempt?.evidence?.focusTrace} candidate={attempt?.number} />}
    {view === 'checks' && <>
      <div className="table-scroll" tabIndex={0} aria-label="Scrollable check results"><table><thead><tr><th scope="col">Protected check</th><th scope="col">Before</th><th scope="col">Candidate {attempt?.number || ''}</th></tr></thead><tbody>{run.baseline?.checks.map(check => {
        const after = attempt?.evidence?.checks.find(item => item.id === check.id);
        return <tr key={check.id}><th scope="row"><details><summary>{check.name}<ChevronRight size={14} /></summary><div className="check-detail"><strong>Before:</strong> {check.detail}{after && <p><strong>After:</strong> {after.detail}</p>}</div></details></th><td><Result value={check.passed} /></td><td><Result value={after?.passed} /></td></tr>;
      }) || <tr><td colSpan={3}>The browser is collecting baseline evidence.</td></tr>}</tbody></table></div>
      {attempt?.regressions.length ? <div className="error-panel"><strong>Regression detected</strong><ul>{attempt.regressions.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
      {attempt?.error && <p className="error-panel">{attempt.error}</p>}
      {run.baseline?.violations.length ? <details className="scanner-details"><summary>Automated scan · {run.baseline.violations.length} baseline rule violation(s)</summary><ul>{run.baseline.violations.map(rule => <li key={rule.id}><a href={rule.helpUrl} target="_blank" rel="noreferrer">{rule.description}</a><span className="muted"> · {rule.impact}</span><code>{rule.nodes.join('\n')}</code></li>)}</ul></details> : null}
    </>}
    {view === 'patch' && (attempt ? <div className="diff-view"><p><CheckCheck size={16} />{attempt.accepted ? 'Passed the automated gate. Review the patch before applying it.' : 'This candidate has not been accepted. Your source is unchanged.'}</p><p className="muted">{attempt.rationale}</p><pre aria-label="Proposed source changes"><code>{attempt.patch.split('\n').map((line, index) => <span key={index} className={line.startsWith('+') ? 'line-added' : line.startsWith('-') ? 'line-removed' : ''}>{line}{'\n'}</span>)}</code></pre></div> : <div className="inline-empty"><FileCode2 size={24} /><p>No patch has been proposed for this run.</p></div>)}
    {view === 'events' && <ol className="event-list">{run.events.map((event, index) => <li key={`${event.at}-${index}`}><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time><span>{event.message}</span></li>)}</ol>}
    <div className="human-review"><Info size={18} /><div><strong>Keep a human in the review.</strong><p>{run.humanChecks[0]} Automated checks do not establish complete WCAG conformance.</p></div></div>
    <div className="fingerprints"><span>Run <code>{run.id.slice(0, 8)}</code></span><span>Protected checks <code title={run.contractHash}>{run.contractHash.slice(0, 12)}</code></span><span>Source <code title={run.sourceHash}>{run.sourceHash.slice(0, 12)}</code></span></div>
  </section>;
}
