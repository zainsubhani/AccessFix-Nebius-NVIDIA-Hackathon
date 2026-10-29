import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allPassed, missions } from '../shared/firststep.js';
import { CoachingError, createFirstStepCoach } from '../server/firststep-coach.js';

const config = () => ({ apiKey: 'fake-test-key', baseUrl: 'https://example.test/v1', model: 'nvidia/test' });
test('coaching is fail-closed even with an existing provider key', async () => {
  let calls = 0;
  const request: typeof fetch = async () => { calls++; throw new Error('must not call'); };
  for (const options of [{ enabled: false, limit: 2 }, { enabled: true, limit: 0 }, { enabled: true, limit: Number.NaN }]) {
    const coach = createFirstStepCoach({ ...options, config, request });
    assert.equal(coach.status().enabled, false);
    await assert.rejects(coach.ask({ mission: 'checkout', question: 'What should I inspect?' }), (error: unknown) => error instanceof CoachingError && error.status === 403);
  }
  assert.equal(calls, 0);
});
test('live adapter sends authored context, rejects transfer coaching, and enforces a bounded budget', async () => {
  let calls = 0;
  const request: typeof fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.match(body.messages[0].content, /FULL100/);
    assert.match(body.messages[0].content, /Do not write the complete solution/);
    assert.equal(body.messages[1].content, 'Where should I start?');
    return Response.json({ choices: [{ message: { content: 'Compare the checkout events with the control order.' } }] });
  };
  const coach = createFirstStepCoach({ enabled: true, limit: 1, config, request });
  await assert.rejects(coach.ask({ mission: 'reservation', question: 'Give me the answer' }), (e: unknown) => e instanceof CoachingError && e.status === 400);
  assert.equal(calls, 0);
  const reply = await coach.ask({ mission: 'checkout', question: 'Where should I start?' });
  assert.match(reply.reply, /control order/);
  assert.equal(reply.remaining, 0);
  await assert.rejects(coach.ask({ mission: 'checkout', question: 'Again?' }), (e: unknown) => e instanceof CoachingError && e.status === 429);
  assert.equal(calls, 1);
});
test('provider failures consume their reserved request and do not expose provider bodies', async () => {
  const coach = createFirstStepCoach({ enabled: true, limit: 1, config, request: async () => new Response('sensitive-provider-debug', { status: 500 }) });
  await assert.rejects(coach.ask({ mission: 'checkout', question: 'Help' }), (e: unknown) => e instanceof CoachingError && !e.message.includes('sensitive-provider-debug'));
  assert.equal(coach.status().remaining, 0);
});
test('changed or incomplete execution evidence cannot unlock the transfer task', () => {
  const results = missions.checkout.checks.map(c => ({ ...c, actual: c.expected, passed: true }));
  const run = { source: 'verified-code', at: new Date().toISOString(), results };
  assert.equal(allPassed(run, 'verified-code', results.length), true);
  assert.equal(allPassed(run, 'changed-code', results.length), false);
  assert.equal(allPassed({ ...run, results: [] }, 'verified-code', results.length), false);
  assert.equal(allPassed({ ...run, results: results.map((r, i) => ({ ...r, passed: i !== 0 })) }, 'verified-code', results.length), false);
});
