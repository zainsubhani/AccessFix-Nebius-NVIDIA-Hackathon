import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { fixtureSource } from '../server/config.js';
import { requestProposal } from '../server/provider.js';
import { createRun, executeRun, runDirectory } from '../server/runner.js';
import { diagnoseCandidate, repairUserMessage, type RepairFeedback } from '../server/repair-context.js';
import type { Check, Evidence } from '../shared/types.js';

const healthy = fixtureSource('healthy');
const original = fixtureSource('signup');
const focusFailure: Check = {
  id: 'focus-management', name: 'Focus moves to the first invalid field',
  category: 'accessibility', passed: false, detail: 'Focus did not move to the invalid email field after submit.',
};
const evidence: Evidence = { checks: [focusFailure], violations: [], screenshot: 'before.png', durationMs: 0, consoleErrors: [] };
const staleFocus = healthy.replace('emailRef.current?.focus(); return;', "if (error?.field === 'email') emailRef.current?.focus(); return;");

test('identifies the stale error-state focus pattern without flagging direct validation-branch focus', () => {
  assert.notEqual(staleFocus, healthy);
  const diagnostics = diagnoseCandidate(original, staleFocus, [focusFailure]);
  assert.ok(diagnostics.some(item => item.code === 'render-state-focus' && item.message.includes('error') && item.line));
  assert.deepEqual(diagnoseCandidate(original, healthy, [focusFailure]), []);
});

test('does not mistake error object properties for input state variables', () => {
  const source = `import {useState, useRef} from 'react';
    export default function Signup() {
      const [email, setEmail] = useState('');
      const [errors, setErrors] = useState({email: ''});
      const emailRef = useRef<HTMLInputElement>(null);
      function submit() {
        setErrors({email: 'Invalid email'});
        if (errors.email) emailRef.current?.focus();
      }
      return <input ref={emailRef} value={email} aria-invalid={!!errors.email} />;
    }`;
  const diagnostics = diagnoseCandidate(source, source, [focusFailure]);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, 'render-state-focus');
  assert.ok(diagnostics[0].message.includes('render-state errors.'));
});

test('finds unattached refs only when focus actually failed', () => {
  const missingRef = healthy.replace('ref={emailRef} ', '');
  assert.ok(diagnoseCandidate(original, missingRef, [focusFailure]).some(item => item.code === 'unattached-ref' && item.message.includes('emailRef')));
  assert.deepEqual(diagnoseCandidate(original, missingRef, []), []);
});

test('detects changed regular-expression escaping without changing the candidate', () => {
  const changed = healthy.replace('\\.', '\\\\.');
  assert.notEqual(changed, healthy);
  assert.ok(diagnoseCandidate(original, changed, []).some(item => item.code === 'changed-validation-regex'));
  assert.deepEqual(diagnoseCandidate(original, healthy, []), []);
  assert.ok(changed.includes('\\\\.'));
});

test('does not diagnose an effect-based state-to-focus implementation as stale handler state', () => {
  const effect = `import {useState, useRef, useEffect} from 'react';
    export default function Signup() {
      const [error, setError] = useState(false);
      const input = useRef<HTMLInputElement>(null);
      useEffect(() => { if (error) input.current?.focus(); }, [error]);
      return <input ref={input} aria-invalid={error} />;
    }`;
  assert.deepEqual(diagnoseCandidate(effect, effect, [focusFailure]), []);
});

test('retry context preserves raw source and separates it from structured verification data', () => {
  const feedback: RepairFeedback = {
    candidate: staleFocus, failed: [focusFailure], regressions: [],
    diagnostics: diagnoseCandidate(original, staleFocus, [focusFailure]),
  };
  const message = repairUserMessage(original, evidence, feedback);
  assert.ok(message.includes(`\n\n${original}\n\n`));
  assert.ok(message.includes(`\n\n${staleFocus}\n\n`));
  assert.ok(!message.includes(JSON.stringify(staleFocus)));
  assert.ok(message.includes('render-state-focus'));
  assert.ok(message.includes(focusFailure.detail));
  assert.ok(!repairUserMessage(original, evidence).includes('PREVIOUS CANDIDATE'));
});

test('the provider sends readable retry context and parses the response without a real network call', async () => {
  const previousKey = process.env.NEBIUS_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.NEBIUS_API_KEY = 'test-placeholder-key';
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[1].content, repairUserMessage(original, evidence, feedback));
    assert.ok(body.messages[1].content.includes(staleFocus));
    return Response.json({
      choices: [{ message: { tool_calls: [{ function: { name: 'propose_patch', arguments: JSON.stringify({ source: healthy, rationale: 'Injected provider response for request-contract testing.' }) } }] } }],
      usage: { prompt_tokens: 17, completion_tokens: 23 },
    });
  };
  const feedback: RepairFeedback = { candidate: staleFocus, failed: [focusFailure], regressions: [], diagnostics: [] };
  try {
    const proposal = await requestProposal(original, evidence, feedback, new AbortController().signal);
    assert.equal(calls, 1);
    assert.equal(proposal.source, healthy);
    assert.equal(proposal.usage.inputTokens, 17);
    assert.equal(proposal.usage.outputTokens, 23);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NEBIUS_API_KEY;
    else process.env.NEBIUS_API_KEY = previousKey;
  }
});

test('browser-confirmed stale focus reaches the retry with diagnostics and never receives automatic acceptance', { timeout: 120000 }, async () => {
  const run = createRun('signup', 'repair');
  let calls = 0;
  try {
    const finished = await executeRun(run, new AbortController().signal, async (_source, _baseline, feedback) => {
      calls++;
      if (calls === 2) {
        assert.ok(feedback);
        assert.equal(feedback.candidate, staleFocus);
        assert.deepEqual(feedback.failed.map(check => check.id), ['focus-management']);
        assert.ok(feedback.diagnostics.some(item => item.code === 'render-state-focus'));
      }
      return {
        source: calls === 1 ? staleFocus : healthy,
        rationale: 'Prepared candidate for a local retry regression test, not live inference.',
        usage: { inputTokens: 0, outputTokens: 0, requests: 0, latencyMs: 0 },
      };
    });
    assert.equal(calls, 2);
    assert.equal(finished.attempts[0].source, staleFocus);
    assert.equal(finished.attempts[0].accepted, false);
    assert.ok(finished.attempts[0].diagnostics?.some(item => item.code === 'render-state-focus'));
    assert.equal(finished.attempts[1].accepted, true);
    assert.equal(finished.state, 'accepted');
    assert.equal(fixtureSource('signup'), original);
  } finally {
    await rm(runDirectory(run.id), { recursive: true, force: true });
  }
});
