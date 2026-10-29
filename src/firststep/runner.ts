import type { CheckCase, CheckResult } from '../../shared/firststep';

// Candidate code only executes in an opaque-origin iframe's disposable worker.
// Expectations stay in the parent. This is practice isolation, not proctoring.
const workerProgram = `self.onmessage = function(event) {
  const { code, inputs } = event.data;
  try {
    const decide = new Function('"use strict";\\n' + code + '\\n;return typeof decide === "function" ? decide : null;')();
    if (!decide) throw new Error('Define a function named decide(input).');
    const outcomes = inputs.map(input => {
      try {
        const value = decide(input);
        return typeof value === 'string' ? value.slice(0, 120) : 'Invalid return type: use a decision string';
      } catch (error) { return 'Error: ' + String(error.message || error).slice(0, 120); }
    });
    self.postMessage({ outcomes });
  } catch (error) { self.postMessage({ error: String(error.message || error).slice(0, 200) }); }
};`;
const sandboxDocument = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'"></head><body><script>
let worker;
window.addEventListener('message', event => {
  if (event.source !== parent || !event.data || event.data.type !== 'firststep-run') return;
  worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerProgram)}], { type: 'text/javascript' })));
  worker.onmessage = message => { parent.postMessage({ type: 'firststep-result', payload: message.data }, '*'); worker.terminate(); };
  worker.onerror = () => { parent.postMessage({ type: 'firststep-result', payload: { error: 'The code could not execute. Check its syntax and try again.' } }, '*'); worker.terminate(); };
  worker.postMessage({ code: event.data.code, inputs: event.data.inputs });
});
parent.postMessage({ type: 'firststep-ready' }, '*');
</script></body></html>`;

export function runPractice(code: string, checks: CheckCase[], signal?: AbortSignal): Promise<CheckResult[]> {
  if (!code.trim() || code.length > 6000) return Promise.reject(new Error('Enter between 1 and 6,000 characters of JavaScript.'));
  if (signal?.aborted) return Promise.reject(new Error('Checks cancelled. Your draft is unchanged.'));
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('title', 'Isolated practice runner');
    iframe.hidden = true;
    iframe.srcdoc = sandboxDocument;
    let settled = false;
    const finish = (error?: string, results?: CheckResult[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      iframe.remove();
      if (error) reject(new Error(error)); else resolve(results!);
    };
    const abort = () => finish('Checks cancelled. Your draft is unchanged.');
    const timer = window.setTimeout(() => finish('Execution stopped after 3 seconds. Check for an infinite loop, then run again.'), 3000);
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'firststep-ready') {
        iframe.contentWindow?.postMessage({ type: 'firststep-run', code, inputs: checks.map(check => check.input) }, '*');
      } else if (event.data?.type === 'firststep-result') {
        const payload = event.data.payload;
        if (typeof payload?.error === 'string') { finish(payload.error.slice(0, 200)); return; }
        if (!Array.isArray(payload?.outcomes) || payload.outcomes.length !== checks.length || !payload.outcomes.every((value: unknown) => typeof value === 'string' && value.length <= 200)) {
          finish('The runner returned an invalid result. Return a decision string from decide(input).'); return;
        }
        finish(undefined, checks.map((check, index) => ({ id: check.id, label: check.label, expected: check.expected, reason: check.reason, actual: payload.outcomes[index], passed: payload.outcomes[index] === check.expected })));
      }
    };
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    document.body.append(iframe);
  });
}
