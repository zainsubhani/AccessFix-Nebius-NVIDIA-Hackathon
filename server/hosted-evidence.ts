import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACTIVE_STATES, type Run } from '../shared/types.js';
import { ROOT, fixtureSource } from './config.js';
import { listRuns, runDirectory, sha256 } from './runner.js';

export const RECORDED_DEMO_ID = '20059716-75ab-457d-a685-28d0d9671158';
export function prepareHostedEvidence() {
  const source = path.join(ROOT, 'demo', 'verified-signup');
  const target = runDirectory(RECORDED_DEMO_ID);
  if (existsSync(path.join(target, 'run.json'))) return;
  const run = JSON.parse(readFileSync(path.join(source, 'run.json'), 'utf8')) as Run;
  if (run.id !== RECORDED_DEMO_ID || run.state !== 'accepted' || run.sourceHash !== sha256(fixtureSource('signup'))) throw new Error('Recorded demo evidence does not match the public signup fixture.');
  mkdirSync(target, { recursive: true });
  for (const image of ['before.png', 'after-1.png']) copyFileSync(path.join(source, image), path.join(target, image));
  writeFileSync(path.join(target, 'run.json.tmp'), JSON.stringify({ ...run, recordedDemo: true }));
  renameSync(path.join(target, 'run.json.tmp'), path.join(target, 'run.json'));
}

/** Retain the recorded demonstration plus at most 99 recent completed runs before creating a new one. */
export function pruneHostedRuns(now = Date.now()) {
  const completed = listRuns().filter(run => run.id !== RECORDED_DEMO_ID && !ACTIVE_STATES.includes(run.state));
  completed.forEach((run, index) => {
    if ((index >= 99 || Date.parse(run.finishedAt || run.createdAt) < now - 7 * 86400_000) && /^[a-f0-9-]{36}$/.test(run.id)) {
      rmSync(runDirectory(run.id), { recursive: true, force: true });
    }
  });
}
