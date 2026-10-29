import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import type { FocusTrace } from '../../shared/types';
import { Button } from './ui';

function TraceFrame({ runId, title, trace, index }: { runId: string; title: string; trace?: FocusTrace; index: number }) {
  const step = trace?.steps[Math.min(index, trace.steps.length - 1)];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [step?.screenshot]);
  if (!trace || !step) return <div className="focus-pane"><h3>{title}</h3><p>No keyboard trace was captured for this version. Older saved runs keep their original evidence.</p></div>;
  const rect = step.rect;
  return <section className="focus-pane" aria-label={`${title} keyboard trace`}><div className="section-heading"><h3>{title}</h3><span className="tag">{Math.min(index + 1, trace.steps.length)} / {trace.steps.length}</span></div>
    <div className="focus-image" style={{ aspectRatio: `${trace.width} / ${trace.height}` }}>
      {failed ? <p role="status">This recorded frame is unavailable. Run a fresh audit to capture a new trace.</p> : <img src={`/api/runs/${runId}/artifacts/${step.screenshot}`} alt={`${title}: ${step.action}. Focus: ${step.target}.`} onError={() => setFailed(true)} />}
      {!failed && rect && rect.width > 0 && <span className="focus-marker" aria-hidden="true" style={{ left: `${rect.x / trace.width * 100}%`, top: `${rect.y / trace.height * 100}%`, width: `${rect.width / trace.width * 100}%`, height: `${rect.height / trace.height * 100}%` }} />}
    </div><p className="focus-action"><strong>{step.action}</strong><span>Focus: {step.target}</span></p>
    <p className="muted">{trace.complete ? 'Keyboard journey completed.' : 'Keyboard journey did not complete.'}</p>
  </section>;
}

export function FocusReplay({ runId, before, after, candidate }: { runId: string; before?: FocusTrace; after?: FocusTrace; candidate?: number }) {
  const [index, setIndex] = useState(0); const [playing, setPlaying] = useState(false);
  const count = Math.max(before?.steps.length || 0, after?.steps.length || 0);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => { setIndex(Math.min(index + 1, count - 1)); if (index + 1 >= count - 1) setPlaying(false); }, 1100);
    return () => clearTimeout(timer);
  }, [playing, count, index]);
  if (!count) return <div className="inline-empty"><p>This older run has no keyboard trace. Run a fresh audit, or use “Replay recorded repair” to verify the saved AI candidate with the current checks.</p></div>;
  const move = (value: number) => { setPlaying(false); setIndex(value); };
  return <div className="focus-replay"><p>Actual Chromium captures after each keyboard action. The outline marks the observed focused control; it does not change the component. Shorter traces hold their last frame.</p>
    <div className="replay-controls"><Button onClick={() => { if (index === count - 1) setIndex(0); setPlaying(value => !value); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause replay' : 'Play replay'}</Button><Button onClick={() => move(index - 1)} disabled={!index} aria-label="Previous keyboard step"><ArrowLeft size={16} /></Button><label htmlFor="replay-step" className="sr-only">Keyboard replay step</label><input id="replay-step" type="range" min="0" max={count - 1} value={index} onChange={event => move(Number(event.target.value))} /><Button onClick={() => move(index + 1)} disabled={index >= count - 1} aria-label="Next keyboard step"><ArrowRight size={16} /></Button><span aria-live="polite">Step {index + 1} of {count}</span></div>
    <div className={`focus-comparison ${after ? '' : 'single-trace'}`}><TraceFrame runId={runId} title="Before" trace={before} index={index} />{after && <TraceFrame runId={runId} title={`Candidate ${candidate}`} trace={after} index={index} />}</div>
  </div>;
}
