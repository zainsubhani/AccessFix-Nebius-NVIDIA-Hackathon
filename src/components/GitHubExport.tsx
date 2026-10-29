import { useEffect, useState } from 'react';
import { GitPullRequest, ExternalLink } from 'lucide-react';
import type { GitHubPreview, GitHubExport as ExportResult, Run } from '../../shared/types';
import { api } from '../hooks/useWorkbench';
import { Button } from './ui';

export function GitHubExport({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<{ enabled: boolean; repository: string }>();
  const [file, setFile] = useState(run.file);
  const [preview, setPreview] = useState<GitHubPreview>();
  const [result, setResult] = useState<ExportResult>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api<{ enabled: boolean; repository: string }>('/api/github', { signal: controller.signal }).then(setConfig).catch(() => { if (!controller.signal.aborted) setError('Could not load export settings. Close and reopen to retry.'); });
    return () => controller.abort();
  }, [open]);
  async function review() {
    setBusy(true); setError(''); setPreview(undefined); setResult(undefined);
    try { setPreview(await api<GitHubPreview>(`/api/runs/${run.id}/github/preview`, { method: 'POST', body: JSON.stringify({ path: file }) })); }
    catch (error) { setError(error instanceof Error ? error.message : 'The export preview could not be loaded.'); }
    finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setError('');
    try { setResult(await api<ExportResult>(`/api/runs/${run.id}/github`, { method: 'POST', body: JSON.stringify({ previewId: preview!.id }) })); }
    catch (error) { setError(error instanceof Error ? error.message : 'The draft could not be created. Retry this export.'); }
    finally { setBusy(false); }
  }
  return <details className="github-export" onToggle={event => setOpen(event.currentTarget.open)}><summary><GitPullRequest size={17} />GitHub draft PR<span>Review the destination before sharing a patch</span></summary>
    {open && <div className="export-content">{!config && !error && <p role="status">Loading local export settings…</p>}
      {config && !config.enabled && <p>Draft PR export is available in the local developer workspace. Set <code>ACCESSFIX_GITHUB_REPO=owner/repository</code> in your local .env and sign in with <code>gh auth login</code>. Shared judge demos keep repository writes disabled.</p>}
      {config?.enabled && !result && <><p>Create a draft containing one verified component change in <strong>{config.repository}</strong>. The destination must exactly match the audited source. Review the diff and complete human accessibility testing before merging.</p><div className="export-fields"><label htmlFor="github-file">Repository component path<input id="github-file" value={file} disabled={busy} onChange={event => { setFile(event.target.value); setPreview(undefined); setError(''); }} spellCheck={false} autoComplete="off" /></label><Button busy={busy && !preview} disabled={busy || !file} onClick={() => void review()}>Preview draft PR</Button></div>
        {preview && <section className="export-preview" aria-label="GitHub draft preview"><h3>{preview.title}</h3><dl><div><dt>Repository</dt><dd>{preview.repository}</dd></div><div><dt>Base branch</dt><dd>{preview.base} · <code>{preview.baseSha.slice(0, 12)}</code></dd></div><div><dt>File to replace</dt><dd>{preview.path}</dd></div><div><dt>New branch</dt><dd>{preview.branch}</dd></div></dl><p>Only this file and a concise verification summary will be sent to GitHub. Screenshots, credentials and other local files are excluded. A repeated request recovers the same draft.</p><pre tabIndex={0} aria-label="GitHub export diff"><code>{preview.patch}</code></pre><Button variant="primary" busy={busy} disabled={busy} onClick={() => void publish()}><GitPullRequest size={16} />Create draft PR on GitHub</Button></section>}
      </>}
      {error && <p className="error-panel" role="alert">{error}</p>}
      {result && <div className="export-success" role="status"><p>GitHub pull request #{result.number} · {result.state}{result.draft ? ' · draft' : ''}. Review it on GitHub before taking further action.</p><a className="button button-secondary" href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open pull request</a></div>}
    </div>}
  </details>;
}
