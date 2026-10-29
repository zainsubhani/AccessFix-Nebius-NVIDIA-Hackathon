import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Run } from '../shared/types.js';
import { runDirectory } from './runner.js';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function reportHtml(run: Run) {
  const e = escapeHtml;
  const last = run.attempts.at(-1);
  const shot = (name: string | undefined) => {
    if (!name || !/^(before|after-[12])\.png$/.test(name)) return '';
    try { return `<img alt="Captured signup form" src="data:image/png;base64,${readFileSync(path.join(runDirectory(run.id), name)).toString('base64')}">`; } catch { return ''; }
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AccessFix evidence — ${e(run.fixtureName)}</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#182536;max-width:1000px;margin:40px auto;padding:0 24px}h1{letter-spacing:-1px}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #dde4e9;padding:12px;vertical-align:top}th{background:#f7f8fa}.pass{color:#126b61}.fail{color:#ad3442}small{color:#566779}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fa;padding:20px;border-radius:8px;font-size:12px}img{width:100%;max-width:480px;border:1px solid #dde4e9;border-radius:8px}.shots{display:flex;gap:16px;flex-wrap:wrap}code{overflow-wrap:anywhere}</style></head><body>
  <p>ACCESSFIX / REPRODUCIBLE EVIDENCE</p><h1>${e(run.fixtureName)}</h1><p><strong>${e(run.state.toUpperCase())}</strong> · ${e(run.summary)}</p>
  <p>Mode: <strong>${e(run.mode)}</strong> · ${e(new Date(run.createdAt).toISOString())}</p>
  ${run.mode.startsWith('verify-') ? '<p>This is a known-patch verification exercise. No AI repair or provider call is claimed.</p>' : ''}
  <table><thead><tr><th>Check</th><th>Before</th><th>Candidate</th><th>Latest evidence</th></tr></thead><tbody>${(run.baseline?.checks || []).map(check => { const after = last?.evidence?.checks.find(item => item.id === check.id); return `<tr><td>${e(check.name)}</td><td class="${check.passed ? 'pass' : 'fail'}">${check.passed ? 'PASS' : 'FAIL'}</td><td class="${after?.passed ? 'pass' : 'fail'}">${after ? after.passed ? 'PASS' : 'FAIL' : '—'}</td><td>${e(after?.detail || check.detail)}</td></tr>`; }).join('')}</tbody></table>
  <h2>Browser captures</h2><div class="shots">${shot(run.baseline?.screenshot)}${shot(last?.evidence?.screenshot)}</div>
  <h2>Repair attempts</h2>${run.attempts.map(attempt => `<h3>Attempt ${attempt.number}: ${attempt.accepted ? 'Accepted for review' : 'Not accepted'}</h3><p>${e(attempt.rationale)}</p>${attempt.error ? `<p>${e(attempt.error)}</p>` : ''}<pre>${e(attempt.patch)}</pre>`).join('') || '<p>No patch was proposed.</p>'}
  <h2>Human review still needed</h2><ul>${run.humanChecks.map(check => `<li>${e(check)}</li>`).join('')}</ul>
  <h2>Reproducibility</h2><p>Run: <code>${e(run.id)}</code><br>Source SHA-256: <code>${e(run.sourceHash)}</code><br>Protected checks SHA-256: <code>${e(run.contractHash)}</code></p>
  <p>Model: ${e(run.model || 'Not used')} · Model requests: ${run.usage.requests} · Reported input tokens: ${run.usage.inputTokens} · Reported output tokens: ${run.usage.outputTokens} · Inference time: ${(run.usage.latencyMs / 1000).toFixed(1)}s</p>
  <h2>Run events</h2><ol>${run.events.map(event => `<li>${e(event.at)} — ${e(event.message)}</li>`).join('')}</ol></body></html>`;
}
