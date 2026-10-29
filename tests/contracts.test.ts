import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fixtureSource } from '../server/config.js';
import { inspectComponent, evaluateCandidate } from '../server/checks.js';
import { knownCandidate, createRun, executeRun, runDirectory } from '../server/runner.js';

for (const contract of ['login', 'dialog', 'navigation'] as const) test(`${contract}: reproduce barriers, verify an accessible candidate and reject changed behavior`, { timeout: 120000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), `accessfix-${contract}-`));
  try {
    const before = await inspectComponent(fixtureSource(contract), directory, 'before', undefined, 'local', contract);
    assert.ok(before.checks.some(item => !item.passed && item.category === 'accessibility'));
    assert.ok(before.checks.filter(item => item.category === 'regression').every(item => item.passed), JSON.stringify(before.checks));
    const after = await inspectComponent(knownCandidate('good', contract), directory, 'after-1', undefined, 'local', contract);
    assert.deepEqual(after.checks.filter(item => !item.passed), []);
    assert.equal(evaluateCandidate(before, after).accepted, true);
    assert.equal(after.focusTrace?.complete, true);
    assert.ok(after.focusTrace!.steps.some(item => item.action === 'Enter'));
    for (const step of after.focusTrace!.steps) assert.ok((await readFile(path.join(directory, step.screenshot))).byteLength > 100);
    const bad = await inspectComponent(knownCandidate('regression', contract), directory, 'after-2', undefined, 'local', contract);
    const verdict = evaluateCandidate(before, bad);
    assert.equal(verdict.accepted, false);
    assert.ok(verdict.regressions.length > 0, 'A previously passing behavior must fail.');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('recorded AI candidate can be freshly verified with traces and no model request', { timeout: 120000 }, async () => {
  const run = createRun('signup', 'verify-recorded');
  try {
    const result = await executeRun(run, new AbortController().signal, async () => { throw new Error('Replay must not call the provider.'); });
    assert.equal(result.state, 'accepted', result.summary);
    assert.equal(result.usage.requests, 0);
    assert.equal(result.replayedFrom, '20059716-75ab-457d-a685-28d0d9671158');
    assert.equal(result.baseline?.focusTrace?.complete, false);
    assert.equal(result.attempts[0].evidence?.focusTrace?.complete, true);
    assert.ok(result.baseline!.focusTrace!.steps.length > result.attempts[0].evidence!.focusTrace!.steps.length);
  } finally { await rm(runDirectory(run.id), { recursive: true, force: true }); }
});
