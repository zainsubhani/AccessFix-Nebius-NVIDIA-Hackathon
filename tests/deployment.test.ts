import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { DemoBudget, deploymentConfig } from '../server/deployment.js';

const env = { ACCESSFIX_MODE: 'hosted', HOST: '127.0.0.1', ACCESSFIX_DATA_DIR: '/tmp/accessfix-deployment-test', ACCESSFIX_PUBLIC_ORIGIN: 'https://demo.example', ACCESSFIX_DEMO_USER: 'judge', ACCESSFIX_DEMO_PASSWORD: 'test-only-password-not-for-deployment' };

test('public binding fails closed without strong demo credentials, persistent data and HTTPS origin', () => {
  assert.throws(() => deploymentConfig({ HOST: '0.0.0.0' }), /Public binding/);
  assert.throws(() => deploymentConfig({ ...env, ACCESSFIX_DEMO_PASSWORD: 'short' }), /24 characters/);
  assert.throws(() => deploymentConfig({ ...env, ACCESSFIX_PUBLIC_ORIGIN: 'http://demo.example' }), /HTTPS/);
  assert.throws(() => deploymentConfig({ ...env, ACCESSFIX_DATA_DIR: '' }), /persistent storage/);
  assert.throws(() => deploymentConfig({ ...env, ACCESSFIX_MODEL_REQUEST_LIMIT: '-1' }), /integer/);
  assert.throws(() => deploymentConfig({ ...env, ACCESSFIX_EPHEMERAL: 'true', ACCESSFIX_MODEL_REQUEST_LIMIT: '1' }), /Ephemeral hosting cannot/);
  assert.equal(deploymentConfig({ ...env, ACCESSFIX_EPHEMERAL: 'true' }).modelRequestLimit, 0);
  assert.equal(deploymentConfig({ ...env, ACCESSFIX_EPHEMERAL: 'true' }).executionProfile, 'free-demo');
  const configured = deploymentConfig(env);
  assert.equal(configured.maxAttempts, 1);
  assert.equal(configured.modelRequestLimit, 0);
  assert.equal(deploymentConfig({}).host, '127.0.0.1');
});

test('persistent model reservations survive restarts and hourly resets without exceeding the total cap', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'accessfix-budget-'));
  let now = new Date('2026-10-29T12:00:00Z');
  const config = deploymentConfig({ ...env, ACCESSFIX_MODEL_REQUEST_LIMIT: '2', ACCESSFIX_RUNS_PER_HOUR: '2' });
  try {
    const budget = new DemoBudget(config, directory, () => now);
    assert.equal(budget.reserve(true), undefined);
    assert.equal(budget.reserve(false), undefined);
    assert.match(budget.reserve(true) || '', /next hour/);
    assert.equal(new DemoBudget(config, directory, () => now).remaining(), 1);
    now = new Date('2026-10-29T13:00:00Z');
    const restarted = new DemoBudget(config, directory, () => now);
    assert.equal(restarted.reserve(true), undefined);
    assert.equal(restarted.remaining(), 0);
    assert.match(restarted.reserve(true) || '', /budget/);
    await writeFile(path.join(directory, 'demo-budget.json'), '{"hour":"broken","runs":0}');
    assert.throws(() => restarted.reserve(true), /Invalid persistent/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function startServer(directory: string): Promise<{ child: ChildProcess; url: string }> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, ...env, ACCESSFIX_DATA_DIR: directory, PORT: '0', NEBIUS_API_KEY: 'placeholder-never-used', ACCESSFIX_MODEL_REQUEST_LIMIT: '0', ACCESSFIX_RUNS_PER_HOUR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Hosted test server did not become ready.')); }, 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Hosted server exited ${code}: ${output}`)); });
    child.stderr?.on('data', chunk => { output += String(chunk); });
    child.stdout?.on('data', chunk => {
      output += String(chunk);
      const url = output.match(/AccessFix runner: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (url) { clearTimeout(timer); resolve({ child, url }); }
    });
  });
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
}

test('hosted HTTP protects evidence, enforces exact origins, runs a real audit and persists its budget', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'accessfix-hosted-'));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const auth = `Basic ${Buffer.from(`${env.ACCESSFIX_DEMO_USER}:${env.ACCESSFIX_DEMO_PASSWORD}`).toString('base64')}`;
  const request = (url: string, method = 'GET', body?: unknown, origin = env.ACCESSFIX_PUBLIC_ORIGIN) => fetch(server!.url + url, { method, headers: { Authorization: auth, 'Content-Type': 'application/json', Origin: origin }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    server = await startServer(directory);
    assert.equal((await fetch(server.url + '/api/health')).status, 200);
    for (const route of ['/', '/api/config', '/api/runs', '/api/runs/20059716-75ab-457d-a685-28d0d9671158/report', '/api/runs/20059716-75ab-457d-a685-28d0d9671158/artifacts/before.png']) {
      assert.equal((await fetch(server.url + route)).status, 401, route);
    }
    assert.equal((await fetch(server.url + '/api/config', { headers: { Authorization: 'Basic invalid' } })).status, 401);
    const config = await (await request('/api/config')).json();
    assert.equal(config.hostedDemo, true);
    assert.equal(config.repairAvailable, false);
    assert.equal(config.maxAttempts, 1);
    assert.equal(config.modelRequestsRemaining, 0);
    assert.ok(!JSON.stringify(config).includes('placeholder-never-used'));
    const history = await (await request('/api/runs')).json();
    assert.equal(history.length, 1);
    assert.equal(history[0].recordedDemo, true);
    assert.equal((await request('/api/runs/20059716-75ab-457d-a685-28d0d9671158/report')).status, 200);
    for (const origin of ['https://evil.example', 'https://demo.example.evil.example', 'https://demo.example:444', 'null']) {
      assert.equal((await request('/api/runs', 'POST', { fixture: 'signup', mode: 'audit' }, origin)).status, 403);
    }
    assert.equal((await request('/api/runs', 'POST', { fixture: 'unknown', mode: 'audit' })).status, 400);
    assert.equal((await request('/api/runs', 'POST', { fixture: 'x'.repeat(5000), mode: 'audit' })).status, 413);
    assert.equal((await request('/api/runs', 'POST', { fixture: 'signup', mode: 'repair' })).status, 429);
    const started = await request('/api/runs', 'POST', { fixture: 'healthy', mode: 'audit' });
    assert.equal(started.status, 202);
    const run = await started.json();
    assert.equal((await request('/api/runs', 'POST', { fixture: 'healthy', mode: 'audit' })).status, 409);
    let finished;
    for (let attempt = 0; attempt < 60; attempt++) {
      finished = await (await request(`/api/runs/${run.id}`)).json();
      if (finished.finishedAt) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(finished.state, 'clean', finished.error);
    assert.equal(finished.usage.requests, 0);
    await stop(server.child);
    server = await startServer(directory);
    assert.equal((await request(`/api/runs/${run.id}`)).status, 200);
    assert.equal((await request('/api/runs', 'POST', { fixture: 'healthy', mode: 'audit' })).status, 429);
    const persisted = JSON.parse(await readFile(path.join(directory, 'demo-budget.json'), 'utf8'));
    assert.equal(persisted.modelRequestsReserved, 0);
    assert.equal(persisted.runs, 1);
  } finally { if (server) await stop(server.child); await rm(directory, { recursive: true, force: true }); }
});
