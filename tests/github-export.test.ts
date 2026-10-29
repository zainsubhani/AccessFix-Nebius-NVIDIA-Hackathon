import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Run } from '../shared/types.js';
import { ROOT } from '../server/config.js';
import { verificationHash } from '../server/runner.js';
import { acceptedSource, createDraft, githubConfig, previewExport, type GitHubApi, type ExportRecord, type ExportStore } from '../server/github-export.js';

const config = { repository: 'example/project', enabled: true };
function run() { const value = JSON.parse(readFileSync(path.join(ROOT, 'demo/verified-signup/run.json'), 'utf8')) as Run; value.contractHash = verificationHash(); value.contract = 'signup'; return value; }
function fakeGitHub(value: Run) {
  const candidate = value.attempts.find(item => item.accepted)!;
  const state = { base: 'base-sha', branch: '', content: value.source, writes: [] as string[], prs: [] as any[], losePrResponse: false, unexpected: false, symlink: false };
  let record: ExportRecord | undefined;
  const store: ExportStore = { read: () => record, write: value => { record = structuredClone(value); } };
  const file = () => ({ type: 'file', encoding: 'base64', content: Buffer.from(state.content).toString('base64'), sha: state.content === value.source ? 'original-blob' : 'candidate-blob' });
  const api: GitHubApi = async (method, endpoint, body: any) => {
    if (method !== 'GET') state.writes.push(`${method} ${endpoint}`);
    if (endpoint === '/repos/example/project') return { default_branch: 'main' };
    if (endpoint.endsWith('/git/trees/base-sha')) return { tree: [{ path: 'Component.tsx', type: 'blob', mode: state.symlink ? '120000' : '100644', sha: 'original-blob' }] };
    if (endpoint.endsWith('/git/ref/heads/main')) return { object: { sha: state.base } };
    if (endpoint.includes('/git/ref/heads/accessfix/')) return state.branch ? { object: { sha: state.branch } } : undefined;
    if (endpoint.endsWith('/git/refs')) { state.branch = body.sha; return { object: { sha: state.branch } }; }
    if (endpoint.includes('/contents/')) {
      if (method === 'GET') return file();
      assert.equal(body.sha, 'original-blob'); assert.equal(body.branch, `accessfix/${value.id}`);
      state.content = Buffer.from(body.content, 'base64').toString('utf8'); assert.equal(state.content, candidate.source); state.branch = 'candidate-commit'; return { commit: { sha: state.branch } };
    }
    if (endpoint.includes('/compare/')) return { total_commits: state.unexpected ? 2 : 1, files: [{ filename: 'Component.tsx', status: 'modified' }] };
    if (endpoint.includes('/pulls?')) return state.prs;
    if (endpoint.endsWith('/pulls')) {
      assert.equal(body.draft, true); assert.match(body.body, /human|assistive/); assert.ok(!body.body.includes(value.source));
      const pr = { number: 12, html_url: 'https://github.com/example/project/pull/12', state: 'open', draft: true, head: { ref: `accessfix/${value.id}`, repo: { full_name: config.repository } }, base: { ref: 'main' } };
      state.prs.push(pr);
      if (state.losePrResponse) { state.losePrResponse = false; throw new Error('Simulated response loss'); }
      return pr;
    }
    throw new Error(`Unexpected ${method} ${endpoint}`);
  };
  return { state, api, store };
}
test('draft export previews exact source, changes one file and deduplicates retries', async () => {
  const value = run(); const { api, state, store } = fakeGitHub(value);
  const preview = await previewExport(value, 'Component.tsx', config, api);
  assert.deepEqual(state.writes, []);
  const result = await createDraft(value, preview, config, api, store);
  assert.equal(result.draft, true); assert.equal(result.number, 12); assert.equal(state.writes.length, 3);
  assert.deepEqual(await createDraft(value, preview, config, api, store), result);
  assert.equal(state.writes.length, 3);
});
test('export rejects stale evidence, rejected candidates, unsafe paths, symlinks and different source before writes', async () => {
  const value = run(); const { api, state } = fakeGitHub(value);
  assert.throws(() => acceptedSource({ ...value, contractHash: 'old' }), /older verification/);
  assert.throws(() => acceptedSource({ ...value, state: 'rejected' }), /Only an accepted/);
  for (const file of ['../Component.tsx', '.github/Component.tsx', '/Component.tsx', 'a//Component.tsx', 'file.js']) await assert.rejects(previewExport(value, file, config, api), /repository-relative/);
  state.symlink = true; await assert.rejects(previewExport(value, 'Component.tsx', config, api), /regular tracked/); state.symlink = false;
  state.content = 'different'; await assert.rejects(previewExport(value, 'Component.tsx', config, api), /differs from/);
  assert.deepEqual(state.writes, []);
});
test('export rejects changed base, disabled destinations and an unowned branch', async () => {
  const value = run(); const { api, state, store } = fakeGitHub(value);
  const preview = await previewExport(value, 'Component.tsx', config, api);
  state.base = 'new-base'; await assert.rejects(createDraft(value, preview, config, api, store), /default branch changed/); state.base = 'base-sha';
  await assert.rejects(createDraft(value, preview, { ...config, enabled: false }, api, store), /no longer enabled/);
  state.branch = 'base-sha'; await assert.rejects(createDraft(value, preview, config, api, store), /without an AccessFix/);
  assert.deepEqual(state.writes, []);
  assert.equal(githubConfig({ ACCESSFIX_MODE: 'hosted', ACCESSFIX_GITHUB_REPO: 'example/project' }).enabled, false);
});
test('a lost PR response recovers the same draft without a second commit or pull request', async () => {
  const value = run(); const { api, state, store } = fakeGitHub(value);
  const preview = await previewExport(value, 'Component.tsx', config, api);
  state.losePrResponse = true;
  await assert.rejects(createDraft(value, preview, config, api, store), /response loss/);
  state.base = 'new-base'; // A recovery can preserve the already-approved base revision.
  const result = await createDraft(value, preview, config, api, store);
  assert.equal(result.number, 12); assert.equal(state.prs.length, 1); assert.equal(state.writes.length, 3);
});
test('recovery refuses unexpected changes on the export branch', async () => {
  const value = run(); const { api, state, store } = fakeGitHub(value);
  const preview = await previewExport(value, 'Component.tsx', config, api);
  state.losePrResponse = true; await assert.rejects(createDraft(value, preview, config, api, store));
  state.unexpected = true; await assert.rejects(createDraft(value, preview, config, api, store), /unexpected changes/);
  assert.equal(state.writes.length, 3);
});
