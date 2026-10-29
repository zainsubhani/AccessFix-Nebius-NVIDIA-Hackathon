import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync, chmodSync, createWriteStream } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { ROOT } from './config.js';
import { judgeEnvironment, type JudgeCredentials } from './judge-config.js';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run judge -- --tunnel [--port 3015] [--cloudflared /path/to/cloudflared] [--keep-awake]\n       npm run judge -- --origin https://your-existing-tunnel.example [--port 3015]\n\nStarts a password-protected, fixed-fixture worker. Inference and GitHub writes are always disabled.\n--tunnel creates a temporary Cloudflare Quick Tunnel; its URL changes on restart.\n--keep-awake prevents idle sleep while this process runs on macOS.\nCredentials and the current URL are written only to .accessfix/judge/access.json.');
  process.exit(0);
}
const allowed = new Set(['--tunnel', '--origin', '--port', '--cloudflared', '--keep-awake']);
const options = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!allowed.has(flag) || options.has(flag)) throw new Error(`Unknown or repeated worker option: ${flag}`);
  const boolean = flag === '--tunnel' || flag === '--keep-awake';
  const value = boolean ? 'true' : args[++i];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
  options.set(flag, value);
}
if (options.has('--tunnel') === options.has('--origin')) throw new Error('Choose exactly one of --tunnel or --origin. Run npm run judge -- --help for details.');
const port = Number(options.get('--port') || 3015);
const directory = path.join(ROOT, '.accessfix/judge');
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const lockFile = path.join(directory, 'worker.lock');
try { const fd = openSync(lockFile, 'wx', 0o600); writeFileSync(fd, String(process.pid)); closeSync(fd); }
catch { throw new Error('A judge worker lock already exists. Stop the running worker first. For a stale lock, verify its PID is no longer running before removing .accessfix/judge/worker.lock.'); }
const children: ChildProcess[] = []; let stopping = false; let gate: net.Server | undefined;
function stop(code = 0) {
  if (stopping) return; stopping = true; process.exitCode = code;
  gate?.close();
  for (const child of children) child.kill('SIGTERM');
  try { if (readFileSync(lockFile, 'utf8') === String(process.pid)) unlinkSync(lockFile); } catch { /* Already closed. */ }
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); process.exit(code); }, 1500).unref();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop());
process.once('exit', () => { try { if (readFileSync(lockFile, 'utf8') === String(process.pid)) unlinkSync(lockFile); } catch { /* No owned lock. */ } });
try {
  if (!existsSync(path.join(ROOT, 'dist/index.html'))) throw new Error('Build the app first with npm run build.');
  const credentialsFile = path.join(directory, 'credentials.json');
  const credentials: JudgeCredentials = existsSync(credentialsFile) ? JSON.parse(readFileSync(credentialsFile, 'utf8')) : { username: 'judge', password: randomBytes(32).toString('base64url') };
  if (typeof credentials.username !== 'string' || typeof credentials.password !== 'string') throw new Error('Invalid judge credentials file.');
  const provisional = options.get('--origin') || 'https://pending.invalid';
  judgeEnvironment(provisional, port, credentials, path.join(directory, 'data'));
  writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2), { mode: 0o600 }); chmodSync(credentialsFile, 0o600);
  // Reserve the port before exposing a tunnel, so an unrelated local service is never forwarded.
  gate = net.createServer(socket => socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'));
  await new Promise<void>((resolve, reject) => { gate!.once('error', reject); gate!.listen(port, '127.0.0.1', resolve); });
  let origin = options.get('--origin') || '';
  if (options.has('--tunnel')) {
    const bundled = path.join(ROOT, '.accessfix/tools/cloudflared');
    const binary = options.get('--cloudflared') || (existsSync(bundled) ? bundled : 'cloudflared');
    const log = createWriteStream(path.join(directory, 'tunnel.log'), { flags: 'a', mode: 0o600 });
    const tunnelConfig = path.join(directory, 'tunnel.yml');
    writeFileSync(tunnelConfig, '{}\n', { mode: 0o600 });
    const tunnelEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(TUNNEL_|CLOUDFLARE_|CF_|NEBIUS_|GH_|GITHUB_|ACCESSFIX_)/.test(key)));
    const tunnel = spawn(binary, ['tunnel', '--config', tunnelConfig, '--no-autoupdate', '--protocol', 'http2', '--metrics', '127.0.0.1:0', '--url', `http://127.0.0.1:${port}`], { cwd: ROOT, env: tunnelEnv, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(tunnel);
    origin = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Cloudflare did not provide a temporary URL within 60 seconds. Check .accessfix/judge/tunnel.log.')), 60000);
      let tail = '';
      const data = (chunk: Buffer) => {
        log.write(chunk); tail = (tail + chunk.toString()).slice(-8192);
        const match = tail.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com\b/);
        if (match) { clearTimeout(timeout); resolve(match[0]); }
      };
      tunnel.stdout!.on('data', data); tunnel.stderr!.on('data', data);
      tunnel.once('error', () => { clearTimeout(timeout); reject(new Error('Could not start cloudflared. Install the official binary or pass --cloudflared.')); });
      tunnel.once('exit', () => { clearTimeout(timeout); if (!stopping) { reject(new Error('The tunnel exited. Check its private log.')); stop(1); } });
    });
  }
  await new Promise<void>(resolve => gate!.close(() => resolve())); gate = undefined;
  const env = judgeEnvironment(origin, port, credentials, path.join(directory, 'data'));
  const worker = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(worker);
  const workerLog = createWriteStream(path.join(directory, 'worker.log'), { flags: 'a', mode: 0o600 });
  worker.stdout!.pipe(workerLog, { end: false }); worker.stderr!.pipe(workerLog, { end: false });
  worker.once('error', () => { console.error('The worker could not start. Check its private log.'); stop(1); });
  worker.once('exit', code => { if (!stopping) { console.error(`The worker exited (${code}). Check .accessfix/judge/worker.log.`); stop(1); } });
  let ready = false;
  for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/api/config`, { headers: { Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}` }, signal: AbortSignal.timeout(1000) }); const config = await response.json(); if (response.ok && config.hostedDemo && config.modelRequestsRemaining === 0 && !config.providerConfigured) { ready = true; break; } } catch { /* Waiting for the child to bind. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('The worker failed its inference-disabled startup check.');
  if (options.has('--keep-awake')) {
    if (process.platform !== 'darwin') throw new Error('--keep-awake is supported only on macOS.');
    const awake = spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }); children.push(awake); awake.once('error', () => { console.error('Keep-awake could not start; leave the Mac awake manually.'); });
  }
  const accessFile = path.join(directory, 'access.json');
  writeFileSync(accessFile, JSON.stringify({ url: origin, ...credentials, localPort: port, pid: process.pid, inferenceEnabled: false, modelRequestLimit: 0, githubExportEnabled: false, temporary: options.has('--tunnel'), startedAt: new Date().toISOString() }, null, 2), { mode: 0o600 }); chmodSync(accessFile, 0o600);
  console.log(`Judge worker ready: ${origin}\nInference disabled · model budget 0 · GitHub writes disabled\nPrivate credentials: ${accessFile}\nKeep this process running. Ctrl+C stops the worker and its tunnel.`);
} catch (error) { console.error(error instanceof Error ? error.message : 'Judge worker could not start.'); stop(1); }
