import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createTwoFilesPatch } from 'diff';
import type { Run, GitHubPreview, GitHubExport } from '../shared/types.js';
import { ROOT } from './config.js';
import { sha256, verificationHash, runDirectory } from './runner.js';
import { evaluateCandidate } from './checks.js';

export class ExportError extends Error { constructor(message: string, public status = 409) { super(message); } }
export type GitHubApi = (method: string, endpoint: string, body?: unknown) => Promise<any>;
export interface ExportConfig { repository: string; enabled: boolean; }
export function githubConfig(env: NodeJS.ProcessEnv = process.env): ExportConfig {
  let local: Record<string, string> = {};
  try { local = dotenv.parse(readFileSync(path.join(ROOT, '.env'))); } catch { /* Optional. */ }
  const repository = (env.ACCESSFIX_GITHUB_REPO ?? local.ACCESSFIX_GITHUB_REPO ?? '').trim();
  const valid = /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository) && !repository.endsWith('/.') && !repository.endsWith('/..');
  return { repository: valid ? repository : '', enabled: valid && (env.ACCESSFIX_MODE || 'local') === 'local' };
}
export async function githubApi(): Promise<GitHubApi> {
  let token = process.env.ACCESSFIX_GITHUB_TOKEN?.trim();
  if (!token) {
    try { token = (await promisify(execFile)('gh', ['auth', 'token'], { timeout: 10000, maxBuffer: 16384 })).stdout.trim(); }
    catch { throw new ExportError('Sign in with gh auth login on the local worker, or set ACCESSFIX_GITHUB_TOKEN in its process environment.', 503); }
  }
  return async (method, endpoint, body) => {
    let response: Response;
    try { response = await fetch(`https://api.github.com${endpoint}`, { method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'AccessFix', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new ExportError('GitHub did not return a response. Retry the same export to recover its branch or draft; do not create another run.', 502); }
    if (response.status === 404) return undefined;
    if (!response.ok) throw new ExportError(`GitHub returned ${response.status}. Check repository permissions and retry the same export.`, 502);
    return response.json();
  };
}
export function acceptedSource(run: Run) {
  const candidate = run.attempts.find(item => item.accepted);
  if (run.state !== 'accepted' || !candidate?.evidence || !run.baseline || candidate.error || !evaluateCandidate(run.baseline, candidate.evidence).accepted) throw new ExportError('Only an accepted, verified candidate can be exported.');
  if (run.contractHash !== verificationHash() || run.sourceHash !== sha256(run.source)) throw new ExportError('These results use an older verification gate. Run fresh verification before exporting.');
  if (candidate.source === run.source) throw new ExportError('This candidate has no source change to export.');
  return candidate;
}
function targetPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 240 || !value.endsWith('.tsx') || !/^[A-Za-z0-9_./-]+$/.test(value) || value.split('/').some(part => !part || part.startsWith('.'))) throw new ExportError('Choose a repository-relative .tsx component path without hidden or parent directories.', 400);
  return value;
}
const encodedPath = (value: string) => value.split('/').map(encodeURIComponent).join('/');
interface RemoteFile { type: string; encoding: string; content: string; sha: string; }
function sourceOf(file: RemoteFile | undefined) {
  if (!file || file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') throw new ExportError('The destination must be an existing regular component file.');
  return Buffer.from(file.content, 'base64').toString('utf8');
}
export interface PreviewRecord extends GitHubPreview { runId: string; sourceHash: string; candidateHash: string; fileSha: string; createdAt: number; }
async function requireRegularFile(root: string, commit: string, file: string, api: GitHubApi) {
  let treeSha = commit;
  const parts = file.split('/');
  for (let index = 0; index < parts.length; index++) {
    const tree = await api('GET', `${root}/git/trees/${treeSha}`);
    const entry = tree?.tree?.find((item: any) => item.path === parts[index]);
    if (tree?.truncated || !entry || (index === parts.length - 1 ? entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode) : entry.type !== 'tree')) throw new ExportError('The destination must be a regular tracked file, not a symlink or submodule.');
    treeSha = entry.sha;
  }
}
export async function previewExport(run: Run, destination: unknown, config: ExportConfig, api: GitHubApi): Promise<PreviewRecord> {
  if (!config.enabled) throw new ExportError('GitHub export is available only in a local workspace with ACCESSFIX_GITHUB_REPO configured.', 403);
  const candidate = acceptedSource(run); const file = targetPath(destination);
  const root = `/repos/${config.repository}`;
  const repository = await api('GET', root);
  if (!repository?.default_branch || repository.archived) throw new ExportError('The configured repository is unavailable or archived.');
  const base = repository.default_branch as string;
  const reference = await api('GET', `${root}/git/ref/heads/${encodedPath(base)}`);
  if (!reference?.object?.sha) throw new ExportError('The default branch is unavailable.');
  const baseSha = reference.object.sha as string;
  await requireRegularFile(root, baseSha, file, api);
  const remote = await api('GET', `${root}/contents/${encodedPath(file)}?ref=${baseSha}`) as RemoteFile | undefined;
  if (sha256(sourceOf(remote)) !== run.sourceHash) throw new ExportError('The GitHub file differs from the audited source. Audit the current file before exporting; nothing was written.');
  return { id: randomUUID(), repository: config.repository, base, baseSha, path: file, branch: `accessfix/${run.id}`, runId: run.id, sourceHash: run.sourceHash, candidateHash: sha256(candidate.source), fileSha: remote!.sha, createdAt: Date.now(), patch: createTwoFilesPatch(`a/${file}`, `b/${file}`, run.source, candidate.source, 'original', 'candidate'), title: `Fix ${run.contract || 'signup'} accessibility in ${path.posix.basename(file)}` };
}
export interface ExportRecord { preview: PreviewRecord; result?: GitHubExport; }
export interface ExportStore { read(): ExportRecord | undefined; write(record: ExportRecord): void; }
export function exportStore(runId: string): ExportStore {
  const file = path.join(runDirectory(runId), 'github-export.json');
  return { read() { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw new ExportError('The saved export record could not be read. Inspect it locally before retrying.'); } }, write(record) { writeFileSync(`${file}.tmp`, JSON.stringify(record, null, 2), { mode: 0o600 }); renameSync(`${file}.tmp`, file); } };
}
export async function createDraft(run: Run, preview: PreviewRecord, config: ExportConfig, api: GitHubApi, store: ExportStore): Promise<GitHubExport> {
  if (!config.enabled || preview.repository !== config.repository || preview.runId !== run.id) throw new ExportError('The export destination is no longer enabled.', 403);
  const candidate = acceptedSource(run);
  if (preview.sourceHash !== run.sourceHash || preview.candidateHash !== sha256(candidate.source)) throw new ExportError('The candidate changed. Preview the export again.');
  const previous = store.read();
  const identity = (p: PreviewRecord) => JSON.stringify([p.repository, p.path, p.base, p.baseSha, p.candidateHash]);
  if (previous && identity(previous.preview) !== identity(preview)) throw new ExportError('This run already has an export for a different destination or base revision. Recover that export before starting a new run.');
  if (previous?.result) return previous.result;
  const record: ExportRecord = previous || { preview };
  // Save ownership before any mutation so an interrupted request can safely recover.
  const root = `/repos/${preview.repository}`; const branchPath = encodedPath(preview.branch);
  const base = await api('GET', `${root}/git/ref/heads/${encodedPath(preview.base)}`);
  if (!previous && base?.object?.sha !== preview.baseSha) throw new ExportError('The default branch changed after preview. Review a fresh preview before exporting.');
  let branch = await api('GET', `${root}/git/ref/heads/${branchPath}`);
  if (branch && !previous) throw new ExportError('The export branch already exists without an AccessFix ownership record. Choose a new run; the existing branch was not changed.');
  store.write(record);
  if (!branch) branch = await api('POST', `${root}/git/refs`, { ref: `refs/heads/${preview.branch}`, sha: preview.baseSha });
  if (!branch?.object?.sha) throw new ExportError('GitHub did not confirm the export branch. Retry the same export.', 502);
  if (branch.object.sha === preview.baseSha) {
    const remote = await api('GET', `${root}/contents/${encodedPath(preview.path)}?ref=${encodeURIComponent(preview.branch)}`) as RemoteFile;
    if (remote?.sha !== preview.fileSha || sha256(sourceOf(remote)) !== run.sourceHash) throw new ExportError('The export branch file changed. No replacement was written.');
    await api('PUT', `${root}/contents/${encodedPath(preview.path)}`, { message: preview.title, content: Buffer.from(candidate.source).toString('base64'), sha: remote.sha, branch: preview.branch });
  } else {
    const comparison = await api('GET', `${root}/compare/${preview.baseSha}...${encodeURIComponent(preview.branch)}`);
    const remote = await api('GET', `${root}/contents/${encodedPath(preview.path)}?ref=${encodeURIComponent(preview.branch)}`) as RemoteFile;
    if (comparison?.total_commits !== 1 || comparison.files?.length !== 1 || comparison.files[0].filename !== preview.path || comparison.files[0].status !== 'modified' || sha256(sourceOf(remote)) !== preview.candidateHash) throw new ExportError('The export branch contains unexpected changes. It was not overwritten.');
  }
  const owner = preview.repository.split('/')[0];
  const existing = await api('GET', `${root}/pulls?state=all&head=${encodeURIComponent(`${owner}:${preview.branch}`)}&base=${encodeURIComponent(preview.base)}`);
  let pr = existing?.find((item: any) => item.head?.ref === preview.branch && item.head?.repo?.full_name?.toLowerCase() === preview.repository.toLowerCase() && item.base?.ref === preview.base);
  if (!pr) {
    const passed = candidate.evidence!.checks.length;
    const provenance = run.mode === 'verify-recorded' ? `Re-verifies the unedited recorded NVIDIA/Nebius candidate from run ${run.replayedFrom}. No new inference request.` : run.mode === 'verify-good' ? 'Prepared candidate used to exercise the verification gate. No model request.' : `Candidate proposed by ${run.model || 'the configured NVIDIA model'} via Nebius Token Factory.`;
    pr = await api('POST', `${root}/pulls`, { title: preview.title, head: preview.branch, base: preview.base, draft: true, body: `Repairs the ${run.contract || 'signup'} component in \`${preview.path}\`. The original file was verified against the base revision before export.\n\n${provenance}\n\nValidation: ${passed}/${passed} protected checks passed; no new axe violations or regressions. Review the diff and test assistive technology in the full application before merging. Automated checks do not establish full WCAG conformance.\n\nAccessFix run: \`${run.id}\`\nProtected checks: \`${run.contractHash}\`\nSource: \`${run.sourceHash}\`` });
  }
  if (!Number.isSafeInteger(pr?.number) || pr.html_url !== `https://github.com/${preview.repository}/pull/${pr.number}`) throw new ExportError('GitHub did not confirm a pull request URL. Retry the same export to recover it.', 502);
  const result = { url: pr.html_url as string, number: pr.number as number, draft: !!pr.draft, state: pr.state as string };
  store.write({ ...record, result }); return result;
}
