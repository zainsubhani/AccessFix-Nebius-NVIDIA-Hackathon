import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, renameSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { ACTIVE_STATES, type Run, type RunMode } from '../shared/types.js';
import { ROOT, RUNS_DIR, fixtureSource, getFixture, providerConfig } from './config.js';
import { inspectComponent, evaluateCandidate } from './checks.js';
import { requestProposal, type Proposal } from './provider.js';
import { createRepairFeedback, type RepairFeedback } from './repair-context.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const verificationHash = () => sha256(JSON.stringify(['server/checks.ts', 'server/fixture-host.ts'].map(file => ({ file, source: readFileSync(path.join(ROOT, file), 'utf8') }))));
export const runDirectory = (id: string) => path.join(RUNS_DIR, id);
export function saveRun(run: Run) {
  const directory = runDirectory(run.id); mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'run.json.tmp'), JSON.stringify(run, null, 2));
  renameSync(path.join(directory, 'run.json.tmp'), path.join(directory, 'run.json'));
}
export function readRun(id: string): Run | undefined {
  if (!/^[a-f0-9-]{36}$/.test(id)) return undefined;
  try { return JSON.parse(readFileSync(path.join(runDirectory(id), 'run.json'), 'utf8')); } catch { return undefined; }
}
export function listRuns(): Run[] {
  if (!existsSync(RUNS_DIR)) return [];
  return readdirSync(RUNS_DIR).map(readRun).filter((run): run is Run => !!run).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function recoverInterruptedRuns() {
  for (const run of listRuns()) if (ACTIVE_STATES.includes(run.state)) {
    run.state = 'error'; run.error = 'The local runner restarted before this run finished. Start a new run to retry.';
    run.summary = run.error; run.finishedAt = new Date().toISOString(); saveRun(run);
  }
}
export function createRun(fixture: string, mode: RunMode, custom?: { source: string; name: string; file: string }): Run {
  const item = getFixture(fixture);
  if (!item && !custom) throw new Error('Unknown fixture.');
  const source = custom?.source ?? fixtureSource(item!.id);
  const run: Run = {
    id: randomUUID(), fixture, fixtureName: custom?.name || item!.name, file: custom?.file || item!.file, mode, state: 'queued', createdAt: new Date().toISOString(),
    events: [], attempts: [], summary: 'Waiting for the browser runner.', source,
    sourceHash: sha256(source), contractHash: verificationHash(),
    usage: { inputTokens: 0, outputTokens: 0, requests: 0, latencyMs: 0 },
    humanChecks: ['Screen reader announcements and reading order need manual testing with assistive technology.', 'This component harness does not test your full app, backend, authentication, or surrounding routes.', 'Automated checks cover the specified signup journey; they do not establish complete WCAG conformance.'],
  };
  if (mode === 'repair') run.model = providerConfig().model;
  saveRun(run); return run;
}

export function knownCandidate(kind: 'good' | 'regression') {
  const good = fixtureSource('healthy');
  if (kind === 'good') return good;
  return good.replace(/    if \(!terms\) \{[\s\S]*?\n    \}/, '    // Deliberate verification exercise: this candidate incorrectly removes required consent.');
}

export async function executeRun(run: Run, signal: AbortSignal, propose: typeof requestProposal = requestProposal, options: { maxAttempts?: 1 | 2 } = {}): Promise<Run> {
  const transition = (state: Run['state'], message: string) => {
    run.state = state; run.summary = message; run.events.push({ at: new Date().toISOString(), stage: state, message }); saveRun(run);
  };
  const inspect = (source: string, prefix: string) => inspectComponent(source, runDirectory(run.id), prefix, AbortSignal.any([signal, AbortSignal.timeout(60_000)]));
  try {
    if (options.maxAttempts !== undefined && ![1, 2].includes(options.maxAttempts)) throw new Error('Maximum attempts must be 1 or 2.');
    transition('auditing', 'Reproducing the signup journey in Chromium.');
    run.baseline = await inspect(run.source, 'before'); saveRun(run);
    if (run.baseline.checks.every(check => check.passed)) {
      transition('clean', 'All automated checks passed on the baseline. No patch is needed for these checks.');
    } else if (run.mode === 'audit') {
      const failed = run.baseline.checks.filter(check => !check.passed).length;
      transition('audited', `${failed} of ${run.baseline.checks.length} checks failed. Review the evidence or request a repair.`);
    } else {
      let feedback: RepairFeedback | undefined;
      const limit = run.mode === 'repair' ? options.maxAttempts ?? 2 : 1;
      for (let index = 1; index <= limit; index++) {
        signal.throwIfAborted();
        transition('proposing', run.mode === 'repair' ? `Asking NVIDIA Nemotron for a component patch (attempt ${index}/${limit}).` : 'Loading a known candidate for this verification exercise. No model call is made.');
        let proposal: Proposal;
        if (run.mode === 'repair') {
          const requestedAt = Date.now();
          run.usage.requests += 1; saveRun(run);
          try { proposal = await propose(run.source, run.baseline, feedback, signal); }
          finally { run.usage.latencyMs += Date.now() - requestedAt; saveRun(run); }
        }
        else proposal = { source: knownCandidate(run.mode === 'verify-good' ? 'good' : 'regression'), rationale: run.mode === 'verify-good' ? 'Known fixture patch: semantic labels, keyboard submit, linked validation and focus management.' : 'Deliberately flawed fixture: accessibility repairs with the consent validation removed. The gate should reject it.', usage: { inputTokens: 0, outputTokens: 0, requests: 0, latencyMs: 0 } };
        for (const key of ['inputTokens', 'outputTokens'] as const) run.usage[key] += proposal.usage[key];
        if (!proposal.source) { transition('unresolved', `The model abstained: ${proposal.rationale}`); break; }
        const attempt: Run['attempts'][number] = { number: index, rationale: proposal.rationale, source: proposal.source, patch: createTwoFilesPatch(`a/${run.file}`, `b/${run.file}`, run.source, proposal.source, 'original', 'candidate'), accepted: false, regressions: [] };
        run.attempts.push(attempt); saveRun(run);
        transition('verifying', `Replaying the unchanged checks against candidate ${index}.`);
        try {
          attempt.evidence = await inspect(proposal.source, `after-${index}`);
          Object.assign(attempt, evaluateCandidate(run.baseline, attempt.evidence));
        } catch (error) {
          signal.throwIfAborted();
          attempt.error = error instanceof Error ? error.message.slice(0, 800) : 'The candidate could not be tested.';
          attempt.regressions = ['Candidate build or browser execution failed.'];
        }
        if (!attempt.accepted) {
          feedback = createRepairFeedback(run.source, attempt);
          attempt.diagnostics = feedback.diagnostics;
        }
        saveRun(run);
        if (attempt.accepted) { transition('accepted', 'The candidate passed every automated check. The patch is ready for human review.'); break; }
        if (index === limit) transition(attempt.regressions.length ? 'rejected' : 'unresolved', attempt.regressions.length ? 'The candidate introduced a regression or could not run. The patch was rejected.' : 'The attempt limit was reached with failing checks. The issue remains unresolved.');
      }
    }
  } catch (error) {
    if (signal.aborted) transition('cancelled', 'Run cancelled. Original source is unchanged.');
    else {
      run.error = error instanceof Error ? error.message.slice(0, 1000) : 'The run could not finish.';
      transition('error', run.error);
    }
  } finally {
    run.finishedAt = new Date().toISOString(); saveRun(run);
  }
  return run;
}
