import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { DATA_DIR } from './config.js';

export function deploymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.ACCESSFIX_MODE || 'local';
  if (!['local', 'hosted'].includes(mode)) throw new Error('ACCESSFIX_MODE must be local or hosted.');
  const hosted = mode === 'hosted';
  if (env.ACCESSFIX_EPHEMERAL && !['true', 'false'].includes(env.ACCESSFIX_EPHEMERAL)) throw new Error('ACCESSFIX_EPHEMERAL must be true or false.');
  const ephemeral = env.ACCESSFIX_EPHEMERAL === 'true';
  const host = env.HOST || (hosted ? '0.0.0.0' : '127.0.0.1');
  if (!hosted && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Public binding requires ACCESSFIX_MODE=hosted and demo credentials.');
  const username = env.ACCESSFIX_DEMO_USER || '';
  const password = env.ACCESSFIX_DEMO_PASSWORD || '';
  let origin = env.ACCESSFIX_PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || '';
  if (hosted) {
    if (!username || username.includes(':') || password.length < 24) throw new Error('Hosted mode requires a demo username and a password of at least 24 characters.');
    if (!env.ACCESSFIX_DATA_DIR || !path.isAbsolute(env.ACCESSFIX_DATA_DIR)) throw new Error('Hosted mode requires an absolute ACCESSFIX_DATA_DIR; live inference requires persistent storage.');
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Hosted mode requires an HTTPS public origin without a path or credentials.');
    origin = url.origin;
  }
  const integer = (key: string, fallback: number, maximum: number) => {
    const value = env[key] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) > maximum) throw new Error(`${key} must be an integer from 0 to ${maximum}.`);
    return Number(value);
  };
  const modelRequestLimit = integer('ACCESSFIX_MODEL_REQUEST_LIMIT', 0, 1000);
  if (hosted && ephemeral && modelRequestLimit !== 0) throw new Error('Ephemeral hosting cannot enable paid inference: persistent request accounting is required.');
  return { hosted, ephemeral, host, origin, username, password,
    modelRequestLimit,
    runsPerHour: integer('ACCESSFIX_RUNS_PER_HOUR', 20, 100),
    maxAttempts: hosted ? 1 as const : 2 as const,
    inspectionTimeoutMs: hosted && ephemeral ? 180_000 : 60_000,
  };
}
export type DeploymentConfig = ReturnType<typeof deploymentConfig>;

export function demoAuthentication(config: DeploymentConfig): RequestHandler {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = digest(`${config.username}:${config.password}`);
  return (req, res, next) => {
    if (!config.hosted || (['GET', 'HEAD'].includes(req.method) && req.path === '/api/health')) { next(); return; }
    const header = req.headers.authorization || '';
    let credentials = '';
    if (header.startsWith('Basic ') && header.length < 2048) credentials = Buffer.from(header.slice(6), 'base64').toString('utf8');
    if (!timingSafeEqual(digest(credentials), expected)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="AccessFix judge demo", charset="UTF-8"');
      res.status(401).json({ error: 'Enter the judge demo credentials supplied by the project owner.' }); return;
    }
    next();
  };
}

interface BudgetRecord { hour: string; runs: number; modelRequestsReserved: number; }
/** One process per persistent data directory. Reservations are conservative and never refunded. */
export class DemoBudget {
  private readonly file: string;
  constructor(private readonly config: DeploymentConfig, directory = DATA_DIR, private readonly now = () => new Date()) {
    this.file = path.join(directory, 'demo-budget.json');
  }
  private read(): BudgetRecord {
    const hour = this.now().toISOString().slice(0, 13);
    if (!existsSync(this.file)) return { hour, runs: 0, modelRequestsReserved: 0 };
    const record: unknown = JSON.parse(readFileSync(this.file, 'utf8'));
    const value = record as BudgetRecord;
    if (!value || typeof value.hour !== 'string' || !Number.isSafeInteger(value.runs) || value.runs < 0 || !Number.isSafeInteger(value.modelRequestsReserved) || value.modelRequestsReserved < 0) throw new Error('Invalid persistent demo budget. Repair it before enabling new runs.');
    return { ...value, hour, runs: value.hour === hour ? value.runs : 0 };
  }
  remaining() { return Math.max(0, this.config.modelRequestLimit - this.read().modelRequestsReserved); }
  reserve(repair: boolean) {
    const current = this.read();
    if (current.runs >= this.config.runsPerHour) return 'The shared demo run limit has been reached. Try again next hour.';
    if (repair && current.modelRequestsReserved >= this.config.modelRequestLimit) return 'The demo live-repair budget is exhausted or disabled. Audits, saved evidence and the verification lab remain available.';
    current.runs++;
    if (repair) current.modelRequestsReserved++;
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(current), { mode: 0o600 });
    renameSync(`${this.file}.tmp`, this.file);
  }
}
