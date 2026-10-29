import { missions, type CheckCase, type MissionId, type PracticeRun } from '../../shared/firststep';
import type { PracticeSession } from './session';

export const PRODUCT_NAME = 'PatchTrek';
export const MAX_ATTEMPTS = 10;
export interface Attempt extends PracticeRun { attempt: number }
export interface CustomRun extends PracticeRun { cases: CheckCase[]; suiteText: string }
export interface CoachEvidence { model: string; generatedAt: string; usage: unknown }

export function exampleCases(id: MissionId): string {
  return JSON.stringify([{
    label: id === 'checkout' ? 'Blank email after a free coupon' : 'Eligibility must be explicit',
    input: id === 'checkout' ? { totalCents: 0, email: '   ', paymentToken: null } : { feeCents: 0, eligible: 'true', paymentToken: null },
    expected: 'reject',
  }], null, 2);
}

function validJson(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value && typeof value === 'object') return Object.values(value).every(item => validJson(item, depth + 1));
  return true;
}

export function parseCustomCases(text: string): CheckCase[] {
  if (text.length > 6000) throw new Error('Keep the custom suite within 6,000 characters.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Use valid JSON: an array of cases with input and expected fields.'); }
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error('Add between 1 and 8 custom cases.');
  return value.map((item: unknown, index): CheckCase => {
    const prefix = `Case ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${prefix}: use an object with input and expected fields.`);
    const row = item as Record<string, unknown>;
    if (!row.input || typeof row.input !== 'object' || Array.isArray(row.input) || !validJson(row.input)) throw new Error(`${prefix}: input must be a JSON object with finite numbers and at most 8 nested levels.`);
    if (row.expected !== 'confirm' && row.expected !== 'charge' && row.expected !== 'reject') throw new Error(`${prefix}: expected must be reject, confirm, or charge.`);
    if (row.label !== undefined && (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 80)) throw new Error(`${prefix}: label must contain 1–80 characters.`);
    return { id: `custom-${index + 1}`, label: typeof row.label === 'string' ? row.label.trim() : prefix, input: row.input as Record<string, unknown>, expected: row.expected, reason: 'Learner-defined expectation; separate from the authored assessment.' };
  });
}

export function compareAttempts(previous: PracticeRun, latest: PracticeRun) {
  const before = new Map(previous.results.map(result => [result.id, result.passed]));
  return {
    improved: latest.results.filter(result => before.get(result.id) === false && result.passed),
    regressed: latest.results.filter(result => before.get(result.id) === true && !result.passed),
  };
}

// User text is fenced, so notes, source and model metadata cannot become Markdown links or HTML.
export function fenced(value: string, language = 'text'): string {
  const fence = '`'.repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), match => match[0].length + 1)));
  return `${fence}${language}\n${value}\n${fence}`;
}
const tally = (run: PracticeRun) => `${run.results.filter(result => result.passed).length}/${run.results.length}`;

export function engineeringReport(session: PracticeSession, coaching: CoachEvidence[], at = new Date().toISOString()): string {
  const lines = [
    `# ${PRODUCT_NAME} — Engineering practice report`, '', `Exported: ${at}`, '',
    'Self-reported practice record, not a verified credential or proof of independent work. Passing authored examples does not prove general correctness or learning gains.', '',
    'Drafts and notes may be restored from this browser tab. Execution evidence covers this page session only. Authored hints are counted across the restored tab draft; live coaching below covers replies received on this page only. Disclose other assistance in your handoff.', '',
    `Live coach replies recorded on this page: ${coaching.length}`, '',
    fenced(JSON.stringify(coaching, null, 2), 'json'), '',
  ];
  for (const id of ['checkout', 'reservation'] as const) {
    const mission = missions[id]; const progress = session.progress[id];
    lines.push(`## ${mission.ticket}: ${mission.title}`, '', mission.summary, '',
      '### Acceptance criteria', '', ...mission.contract.map(rule => `- ${rule}`), '',
      `Original baseline: ${progress.baseline ? tally(progress.baseline) + ' checks passed' : 'not run on this page'}.`,
      `Latest authored check run: ${progress.review ? tally(progress.review) + ' checks passed' + (progress.review.source === progress.source ? ' for the current draft' : ' for an EARLIER draft; current draft is unverified') : 'not verified for this draft'}.`,
      `Completed authored runs in this tab draft: ${progress.attempts}. Authored hints revealed: ${progress.hints}.`, '',
      '### Reviewer handoff', '', fenced(progress.notes || 'No explanation recorded.'), '',
      '### Attempt history', '', `Retained runs: ${progress.history.length} (latest ${MAX_ATTEMPTS} per mission, this page only).`, '',
      '| Attempt | Passed | Newly passing | Regressions | Executed at |', '| --- | --- | --- | --- | --- |');
    progress.history.forEach((run, index) => {
      const previous = progress.history[index - 1];
      const delta = previous ? compareAttempts(previous, run) : null;
      lines.push(`| ${run.attempt} | ${tally(run)} | ${delta?.improved.length ?? '—'} | ${delta?.regressed.length ?? '—'} | ${run.at} |`);
    });
    lines.push('', '### Authored results', '', fenced(JSON.stringify(progress.review?.results ?? [], null, 2), 'json'), '',
      '### Custom edge cases', '', 'Expectations below are learner-defined. They do not determine mission completion.', '');
    if (progress.customRun) {
      const custom = progress.customRun;
      lines.push(`${tally(custom)} custom cases passed. ${custom.source === progress.source && custom.suiteText === progress.customDraft ? 'Matches the current draft and suite.' : 'STALE: source or suite has changed since this run.'}`, '',
        fenced(JSON.stringify({ executedAt: custom.at, cases: custom.cases, results: custom.results }, null, 2), 'json'));
    } else lines.push('No custom cases executed on this page.');
    lines.push('', '### Current custom suite draft (may be unexecuted)', '', fenced(progress.customDraft, 'json'), '',
      '### Current source', '', fenced(progress.source, 'javascript'), '');
    if (progress.review && progress.review.source !== progress.source) lines.push('### Source of the latest authored run', '', fenced(progress.review.source, 'javascript'), '');
    if (progress.customRun && progress.customRun.source !== progress.source) lines.push('### Source of the custom case run', '', fenced(progress.customRun.source, 'javascript'), '');
  }
  return lines.join('\n');
}
