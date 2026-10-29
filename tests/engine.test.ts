import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectComponent, evaluateCandidate } from '../server/checks.js';
import { fixtureSource, ROOT } from '../server/config.js';
import { knownCandidate, createRun, executeRun, runDirectory } from '../server/runner.js';
import { parseProposal } from '../server/provider.js';
import { compileFixture } from '../server/fixture-host.js';
import { reportHtml } from '../server/report.js';
import type { Evidence } from '../shared/types.js';

let temporary: string;
let broken: Evidence;
let healthy: Evidence;
before(async () => { temporary = await mkdtemp(path.join(os.tmpdir(), 'accessfix-test-')); });
after(async () => { await rm(temporary, { recursive: true, force: true }); });

test('reproduces actual label and keyboard barriers while preserving the functional baseline', { timeout: 60000 }, async () => {
  broken = await inspectComponent(fixtureSource('signup'), temporary, 'broken');
  const results = Object.fromEntries(broken.checks.map(check => [check.id, check.passed]));
  assert.equal(results.labels, false);
  assert.equal(results.keyboard, false);
  assert.equal(results['validation-feedback'], false);
  assert.equal(results['focus-management'], false);
  assert.equal(results['valid-submit'], true);
  assert.equal(results.consent, true);
  assert.equal(results['invalid-email'], true);
  assert.equal(results['short-password'], true);
  // Placeholders satisfy axe's name check here, but not the explicit label/keyboard journey contract.
  assert.equal(broken.violations.length, 0);
});
test('known good component passes all independent browser checks', { timeout: 60000 }, async () => {
  healthy = await inspectComponent(fixtureSource('healthy'), temporary, 'healthy');
  assert.deepEqual(healthy.checks.filter(check => !check.passed), []);
  assert.deepEqual(evaluateCandidate(broken, healthy), { accepted: true, regressions: [] });
});
test('rejects an otherwise improved patch that removes consent validation', { timeout: 60000 }, async () => {
  const bad = await inspectComponent(knownCandidate('regression'), temporary, 'regression');
  assert.equal(bad.checks.find(check => check.id === 'labels')?.passed, true);
  assert.equal(bad.checks.find(check => check.id === 'keyboard')?.passed, true);
  const verdict = evaluateCandidate(broken, bad);
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.regressions.includes('Consent is required before signup'));
});
test('a second React implementation exposes distinct validation failures', { timeout: 60000 }, async () => {
  const team = await inspectComponent(fixtureSource('team'), temporary, 'team');
  assert.equal(team.checks.find(check => check.id === 'labels')?.passed, true);
  assert.equal(team.checks.find(check => check.id === 'keyboard')?.passed, true);
  assert.equal(team.checks.find(check => check.id === 'validation-feedback')?.passed, false);
  assert.equal(team.checks.find(check => check.id === 'focus-management')?.passed, false);
});
test('bounded retry uses real verification and leaves the source file unchanged', { timeout: 120000 }, async () => {
  const original = await readFile(path.join(ROOT, 'examples/signup/Signup.tsx'), 'utf8');
  const run = createRun('signup', 'repair');
  let calls = 0;
  try {
    const finished = await executeRun(run, new AbortController().signal, async (_source, _evidence, feedback) => {
      calls++;
      if (calls === 2) {
        assert.ok(feedback);
        assert.ok(feedback.regressions.includes('Consent is required before signup'));
        assert.equal(feedback.candidate, knownCandidate('regression'));
      }
      return { source: knownCandidate(calls === 1 ? 'regression' : 'good'), rationale: 'Injected candidate for automated runner testing, not a live AI response.', usage: { inputTokens: 0, outputTokens: 0, requests: 0, latencyMs: 0 } };
    });
    assert.equal(calls, 2); assert.equal(finished.state, 'accepted');
    assert.equal(finished.attempts[0].accepted, false); assert.equal(finished.attempts[1].accepted, true);
    assert.equal(await readFile(path.join(ROOT, 'examples/signup/Signup.tsx'), 'utf8'), original);
    assert.equal(finished.sourceHash, run.sourceHash);
    const report = reportHtml(finished);
    assert.match(report, /data:image\/png;base64/);
    assert.match(report, /Protected checks SHA-256/);
  } finally { await rm(runDirectory(run.id), { recursive: true, force: true }); }
});
test('provider failure becomes an explicit error, with no fabricated patch', { timeout: 60000 }, async () => {
  const run = createRun('team', 'repair');
  try {
    const finished = await executeRun(run, new AbortController().signal, async () => { throw new Error('Nebius returned HTTP 429. Test quota failure.'); });
    assert.equal(finished.state, 'error'); assert.equal(finished.attempts.length, 0); assert.match(finished.summary, /429/);
  } finally { await rm(runDirectory(run.id), { recursive: true, force: true }); }
});
test('cancelling an active browser run produces a terminal cancelled state', { timeout: 60000 }, async () => {
  const run = createRun('signup', 'audit'); const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 200);
  try { const result = await executeRun(run, controller.signal); assert.equal(result.state, 'cancelled'); assert.ok(result.finishedAt); }
  finally { clearTimeout(timer); await rm(runDirectory(run.id), { recursive: true, force: true }); }
});
test('model tools cannot target files, run commands or return arbitrary prose as a patch', () => {
  assert.throws(() => parseProposal({ choices: [{ message: { content: 'It is fixed!' } }] }), /supported tool/);
  assert.throws(() => parseProposal({ choices: [{ message: { tool_calls: [{ function: { name: 'exec', arguments: '{"command":"rm"}' } }] } }] }), /unsupported tool/);
  assert.throws(() => parseProposal({ choices: [{ message: { tool_calls: [{ function: { name: 'propose_patch', arguments: 'not json' } }] } }] }), /invalid tool arguments/);
  const abstained = parseProposal({ choices: [{ message: { tool_calls: [{ function: { name: 'abstain', arguments: JSON.stringify({ rationale: 'Needs changes outside this component.' }) } }] } }] });
  assert.equal(abstained.source, undefined);
});
test('the component bundler rejects filesystem imports and oversized code', async () => {
  await assert.rejects(compileFixture("import fs from 'node:fs'; export default function Signup(){return null}"), /Only React imports/);
  await assert.rejects(compileFixture('x'.repeat(40001)), /40 KB/);
});
test('portable reports escape untrusted model explanations and source', async () => {
  const run = createRun('signup', 'audit');
  try {
    run.summary = '<script>steal()</script>';
    const report = reportHtml(run);
    assert.ok(report.includes('&lt;script&gt;steal()&lt;/script&gt;'));
    assert.ok(!report.includes('<script>steal()'));
  } finally { await rm(runDirectory(run.id), { recursive: true, force: true }); }
});
