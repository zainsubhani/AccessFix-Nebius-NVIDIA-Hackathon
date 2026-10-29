import { FlaskConical, History, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui';
import { PracticeTextarea } from './fields';
import { compareAttempts, type Attempt, type CustomRun } from './evidence';

export function CustomCaseLab({ draft, source, result, disabled, running, onChange, onRun }: {
  draft: string; source: string; result: CustomRun | null; disabled: boolean; running: boolean;
  onChange: (draft: string) => void; onRun: () => void;
}) {
  const stale = result && (result.source !== source || result.suiteText !== draft);
  return <section className="fs-lab" aria-labelledby="custom-title">
    <div className="fs-panel-heading"><FlaskConical size={18}/><h2 id="custom-title">Edge-case lab</h2><span>YOUR HYPOTHESIS</span></div>
    <p>What else could break? Define up to 8 inputs and the decisions you expect. These cases run against your current code; they do not unlock the transfer task.</p>
    <details><summary>Write and run your own cases</summary>
      <label htmlFor="custom-cases">Custom cases (JSON)</label>
      <p id="custom-help">Each case needs an input object and an expected decision: reject, confirm, or charge. A label is optional. Maximum 6,000 characters.</p>
      <PracticeTextarea id="custom-cases" className="fs-custom-code" rows={10} spellCheck={false} autoCapitalize="off" maxLength={6000} value={draft} readOnly={disabled} aria-describedby="custom-help" onChange={event => onChange(event.target.value)}/>
      <Button onClick={onRun} disabled={disabled} busy={running}>Run custom cases</Button>
      {result && <div className="fs-custom-results" role="status"><strong>{result.results.filter(row => row.passed).length}/{result.results.length} custom cases passed</strong>
        <p>{stale ? 'Source or cases changed. Run custom cases again.' : 'Results match this draft and suite. Expectations are defined by you.'}</p>
        <ul>{result.results.map(row => <li key={row.id}><strong>{row.passed ? 'Pass' : 'Fail'}: {row.label}</strong><span>Expected {row.expected} · received {row.actual}</span></li>)}</ul>
      </div>}
    </details>
  </section>;
}

export function AttemptHistory({ history, disabled, onRestore }: { history: Attempt[]; disabled: boolean; onRestore: (attempt: Attempt) => void }) {
  const latest = history.at(-1); const previous = history.at(-2);
  const comparison = latest && previous ? compareAttempts(previous, latest) : null;
  return <section className="fs-history" aria-labelledby="history-title">
    <div className="fs-panel-heading"><History size={18}/><h2 id="history-title">Attempt history</h2><span>THIS PAGE</span></div>
    <p>Keep the last 10 completed check runs for this mission. Restoring a draft requires a fresh run; history clears on reload.</p>
    {comparison ? <div className="fs-comparison" role="status"><strong>Attempt {previous!.attempt} → {latest!.attempt}: {comparison.improved.length} newly passing · {comparison.regressed.length} regressions</strong>
      {comparison.improved.length > 0 && <p>Now passing: {comparison.improved.map(row => row.label).join('; ')}.</p>}
      {comparison.regressed.length > 0 && <p>Regressed: {comparison.regressed.map(row => row.label).join('; ')}.</p>}
    </div> : <p className="fs-history-empty">Run checks twice to compare changes in behavior.</p>}
    {history.length > 0 && <details><summary>Inspect previous attempts ({history.length})</summary><ol>{history.slice().reverse().map(run => <li key={run.attempt}>
      <div><strong>Attempt {run.attempt} · {run.results.filter(row => row.passed).length}/{run.results.length} passed</strong><time dateTime={run.at}>{new Date(run.at).toLocaleTimeString()}</time></div>
      <details><summary>View source for attempt {run.attempt}</summary><pre tabIndex={0} role="region" aria-label={`Source from attempt ${run.attempt}`}>{run.source}</pre></details>
      <Button variant="quiet" disabled={disabled} onClick={() => onRestore(run)} aria-label={`Restore draft from attempt ${run.attempt}`}><RotateCcw size={14}/>Restore draft</Button>
    </li>)}</ol></details>}
  </section>;
}
