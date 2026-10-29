import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const name = `accessfix-smoke-${randomBytes(5).toString('hex')}`;
const password = randomBytes(24).toString('base64');
const origin = 'https://accessfix-smoke.example';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let created = false;
try {
  docker('run', '-d', '--name', name, '--memory=512m', '--memory-swap=512m', '--cpus=0.1', '--pids-limit=256',
    '-p', '127.0.0.1::3001', '-e', `ACCESSFIX_DEMO_PASSWORD=${password}`, '-e', 'ACCESSFIX_DEMO_USER=judge',
    '-e', `ACCESSFIX_PUBLIC_ORIGIN=${origin}`, '-e', 'ACCESSFIX_EPHEMERAL=true', '-e', 'ACCESSFIX_MODEL_REQUEST_LIMIT=0',
    '-e', 'NEBIUS_API_KEY=', process.env.ACCESSFIX_SMOKE_IMAGE || 'accessfix:judge-demo');
  created = true;
  const port = docker('port', name, '3001/tcp').split(':').at(-1);
  const base = `http://127.0.0.1:${port}`;
  const request = (route, body) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Authorization: `Basic ${Buffer.from(`judge:${password}`).toString('base64')}`, 'Content-Type': 'application/json', Origin: origin }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    if (attempt === 119) throw new Error('Container did not become healthy.');
    await wait(500);
  }
  assert.equal((await fetch(base + '/api/runs')).status, 401);
  const config = await (await request('/api/config')).json();
  assert.equal(config.ephemeralStorage, true);
  assert.equal(config.repairAvailable, false);
  const processInfo = docker('top', name, '-eo', 'pid,uid,args');
  assert.match(processInfo, /1000\s+node --import tsx server\/index.ts/);
  assert.equal(docker('exec', name, 'sh', '-c', 'test ! -f /app/.env && test ! -d /app/.accessfix && echo clean'), 'clean');
  const history = await (await request('/api/runs')).json();
  assert.equal(history[0].recordedDemo, true);
  for (const [fixture, mode, expected] of [['healthy', 'audit', 'clean'], ['signup', 'verify-regression', 'rejected']]) {
    const response = await request('/api/runs', { fixture, mode });
    assert.equal(response.status, 202);
    const started = await response.json();
    let finished;
    for (let attempt = 0; attempt < 180; attempt++) {
      finished = await (await request(`/api/runs/${started.id}`)).json();
      if (finished.finishedAt) break;
      await wait(500);
    }
    assert.equal(finished.state, expected, finished.error || finished.summary);
    assert.equal(finished.usage.requests, 0);
    console.log(`${mode}: ${expected}; zero model requests`);
  }
  console.log(`Container resource usage: ${docker('stats', '--no-stream', '--format', '{{.MemUsage}}', name)}`);
  console.log('Hosted demo passed with 512 MB RAM and 0.1 CPU: authentication, saved evidence, real Chromium audit and regression rejection.');
} catch (error) {
  if (created) console.error(docker('logs', '--tail', '30', name));
  throw error;
} finally {
  if (created) docker('rm', '-f', name);
}
