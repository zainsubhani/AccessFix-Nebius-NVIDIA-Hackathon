import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createRun, executeRun, runDirectory } from './runner.js';
import { reportHtml } from './report.js';
import { getFixture, providerConfig } from './config.js';
import type { RunMode } from '../shared/types.js';

const { values } = parseArgs({ options: { fixture: { type: 'string', default: 'signup' }, component: { type: 'string' }, mode: { type: 'string', default: 'audit' }, 'max-attempts': { type: 'string', default: '2' }, help: { type: 'boolean' } } });
if (values.help) {
  console.log('AccessFix — local React signup verification\n\nnpm run accessfix -- --fixture signup --mode audit\nnpm run accessfix -- --fixture team --mode repair --max-attempts 1\nnpm run accessfix -- --component ./Signup.tsx --mode audit\n\nModes: audit, repair, verify-good, verify-regression\n--max-attempts: 1 or 2 (default 2); caps live model requests per run.\nCustom components must follow docs/component-contract.md. Live repair sends component source and findings to Nebius.');
} else {
  try {
    if (!['audit', 'repair', 'verify-good', 'verify-regression'].includes(values.mode!)) throw new Error('Unsupported run mode. Use --help.');
    if (!['1', '2'].includes(values['max-attempts']!)) throw new Error('--max-attempts must be 1 or 2.');
    if (values.mode === 'repair' && !providerConfig().apiKey) throw new Error('Set NEBIUS_API_KEY in .env before using live repair.');
    if (!values.component && !getFixture(values.fixture!)) throw new Error('Unknown fixture. Use signup, team or healthy.');
    if (values.mode!.startsWith('verify-') && (values.component || values.fixture !== 'signup')) throw new Error('Known-patch exercises only support --fixture signup.');
    let custom;
    if (values.component) {
      const file = path.resolve(values.component);
      const source = await readFile(file, 'utf8');
      if (Buffer.byteLength(source) > 40_000) throw new Error('Custom component exceeds 40 KB.');
      custom = { source, name: path.basename(file), file: path.basename(file) };
    }
    const run = createRun(custom ? 'local' : values.fixture!, values.mode as RunMode, custom);
    const controller = new AbortController(); process.once('SIGINT', () => controller.abort());
    console.log(`Running ${run.mode} on ${run.fixtureName}. Original source stays unchanged.`);
    const finished = await executeRun(run, controller.signal, undefined, { maxAttempts: Number(values['max-attempts']) as 1 | 2 });
    const directory = runDirectory(run.id);
    await writeFile(path.join(directory, 'report.html'), reportHtml(finished));
    const accepted = finished.attempts.find(attempt => attempt.accepted);
    if (accepted) await writeFile(path.join(directory, 'accepted.patch'), accepted.patch);
    console.log(`${finished.state.toUpperCase()}: ${finished.summary}\nEvidence: ${directory}/report.html`);
    if (!['accepted', 'clean'].includes(finished.state)) process.exitCode = 1;
  } catch (error) { console.error(error instanceof Error ? error.message : 'AccessFix could not start.'); process.exitCode = 2; }
}
