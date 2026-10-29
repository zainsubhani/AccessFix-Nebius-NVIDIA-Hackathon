import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareAttempts, engineeringReport, exampleCases, fenced, parseCustomCases } from '../src/firststep/evidence';
import { newSession, readSession, saveSession } from '../src/firststep/session';
import type { PracticeRun } from '../shared/firststep';

const run = (source: string, passed: boolean): PracticeRun => ({ source, at: '2026-10-30T12:00:00Z', results: [{ id: 'free', label: 'Free order', passed, expected: 'confirm', actual: passed ? 'confirm' : 'reject', reason: 'Zero is valid.' }] });

test('custom suites accept bounded JSON objects and reject ambiguous or unsafe input shapes', () => {
  for (const id of ['checkout', 'reservation'] as const) assert.equal(parseCustomCases(exampleCases(id)).length, 1);
  assert.equal(parseCustomCases('[{"input":{"totalCents":0},"expected":"confirm"}]')[0].label, 'Case 1');
  for (const invalid of ['{', '{}', '[]', 'null', '[null]', '[{"input":[],"expected":"reject"}]', '[{"input":{},"expected":"approve"}]', '[{"input":{"n":1e400},"expected":"reject"}]', '[{"input":{},"expected":"reject","label":""}]']) assert.throws(() => parseCustomCases(invalid));
  assert.throws(() => parseCustomCases(JSON.stringify(Array(9).fill({ input: {}, expected: 'reject' }))), /1 and 8/);
  assert.throws(() => parseCustomCases(' '.repeat(6001)), /6,000/);
  const deep = { input: JSON.parse('{"a":'.repeat(10) + '0' + '}'.repeat(10)), expected: 'reject' };
  assert.throws(() => parseCustomCases(JSON.stringify([deep])), /nested/);
});

test('comparison identifies regressions and improvements by check identity, without scoring new checks', () => {
  const fail = run('before', false); const pass = run('after', true);
  assert.equal(compareAttempts(fail, pass).improved.length, 1);
  assert.equal(compareAttempts(pass, fail).regressed.length, 1);
  assert.deepEqual(compareAttempts(pass, pass), { improved: [], regressed: [] });
  assert.deepEqual(compareAttempts({ ...fail, results: [] }, pass), { improved: [], regressed: [] });
});

test('reports distinguish stale evidence, disclose assistance and contain user Markdown inside fences', () => {
  const session = newSession(); const progress = session.progress.checkout;
  progress.source = 'function decide() { return "charge"; }';
  progress.notes = '```\n<script>bad()</script>\n[Injected](https://example.test)';
  progress.hints = 2; progress.review = run('old source', true);
  progress.history = [{ ...run('first', true), attempt: 1 }, { ...run('second', false), attempt: 2 }];
  progress.customRun = { ...run('older custom source', true), cases: parseCustomCases(progress.customDraft), suiteText: 'old suite' };
  const report = engineeringReport(session, [{ model: 'nvidia/test', generatedAt: '2026-10-30', usage: { inputTokens: 4 } }]);
  assert.match(report, /EARLIER draft; current draft is unverified/);
  assert.match(report, /STALE: source or suite has changed/);
  assert.match(report, /Authored hints revealed: 2/);
  assert.match(report, /Live coach replies recorded on this page: 1/);
  assert.match(report, /not a verified credential/);
  assert.match(report, /\| 2 \| 0\/1 \| 0 \| 1 \|/);
  assert.ok(report.includes(fenced(progress.notes)));
  assert.ok(fenced(progress.notes).startsWith('````text\n'));
  assert.match(report, /Source of the custom case run/);
  assert.match(report, /nvidia\/test/);
});

test('draft persistence retains custom input but never revives old or forged execution evidence', () => {
  const values = new Map<string, string>();
  const old = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    const session = newSession(); const progress = session.progress.checkout;
    progress.source = 'function decide() { return "confirm"; }';
    progress.customDraft = '[{"input":{},"expected":"reject"}]';
    progress.review = run(progress.source, true);
    progress.history = [{ ...progress.review, attempt: 1 }];
    assert.equal(saveSession(session), true);
    const persisted = JSON.parse(values.get('firststep.practice.v1')!);
    assert.deepEqual(persisted.progress.checkout.history, []);
    assert.equal(persisted.progress.checkout.review, null);
    values.set('firststep.practice.v1', JSON.stringify(session)); // Simulate old or forged results.
    const restored = readSession();
    assert.equal(restored.restored, true);
    assert.equal(restored.session.progress.checkout.customDraft, progress.customDraft);
    assert.equal(restored.session.progress.checkout.review, null);
    assert.equal(restored.session.progress.checkout.customRun, null);
    assert.deepEqual(restored.session.progress.checkout.history, []);
    delete persisted.progress.checkout.customDraft; // Existing v1 drafts remain compatible.
    values.set('firststep.practice.v1', JSON.stringify(persisted));
    assert.equal(readSession().session.progress.checkout.source, progress.source);
  } finally {
    if (old) Object.defineProperty(globalThis, 'sessionStorage', old);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
