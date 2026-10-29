import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ACTIVE_STATES, type RunMode } from '../shared/types.js';
import { ROOT, fixtures, getFixture, fixtureSource, providerConfig } from './config.js';
import { createRun, executeRun, listRuns, readRun, recoverInterruptedRuns, runDirectory } from './runner.js';
import { compileFixture } from './fixture-host.js';
import { reportHtml } from './report.js';
import { deploymentConfig, demoAuthentication, DemoBudget } from './deployment.js';
import { prepareHostedEvidence, pruneHostedRuns } from './hosted-evidence.js';

const deployment = deploymentConfig();
const budget = new DemoBudget(deployment);
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  next();
});
app.use(demoAuthentication(deployment));
app.use(express.json({ limit: '4kb' }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        const allowed = deployment.hosted ? url.origin === deployment.origin : ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
        if (!allowed) { res.status(403).json({ error: 'Cross-origin run requests are not allowed.' }); return; }
      }
      catch { res.status(403).json({ error: 'Invalid origin.' }); return; }
    }
    if (!req.is('application/json')) { res.status(415).json({ error: 'Send application/json.' }); return; }
  }
  next();
});
const active = new Map<string, AbortController>();
// Hosted fixtures are immutable image contents; cache only these three public previews.
const hostedPreviews = new Map<string, Promise<string>>();
recoverInterruptedRuns();
if (deployment.hosted) { prepareHostedEvidence(); pruneHostedRuns(); }
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'accessfix' }));
app.get('/api/config', (_req, res) => {
  try {
    const config = providerConfig();
    const remaining = deployment.hosted ? budget.remaining() : undefined;
    res.json({ providerConfigured: !!config.apiKey, model: config.model, fixtures, maxAttempts: deployment.maxAttempts, activeRunId: [...active.keys()][0], hostedDemo: deployment.hosted, ephemeralStorage: deployment.ephemeral,
      repairAvailable: !!config.apiKey && (!deployment.hosted || remaining! > 0),
      repairUnavailableReason: deployment.hosted ? deployment.ephemeral ? 'This free demo shows recorded AI repairs. New model requests are disabled; browser audits and the verification lab remain available.' : !config.apiKey ? 'Live repair is not configured for this demo. Explore saved evidence, audits and the verification lab.' : remaining === 0 ? 'Live-repair budget is exhausted or disabled. Saved evidence, audits and the verification lab remain available.' : undefined : undefined,
      modelRequestsRemaining: remaining,
    });
  }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Invalid provider configuration.' }); }
});
app.get('/api/fixtures/:id/source', (req, res) => {
  const fixture = getFixture(req.params.id);
  if (!fixture) { res.status(404).json({ error: 'Fixture not found.' }); return; }
  res.json({ source: fixtureSource(fixture.id), file: fixture.file });
});
app.get('/api/fixtures/:id/preview', async (req, res) => {
  const fixture = getFixture(req.params.id);
  if (!fixture) { res.status(404).send('Fixture not found.'); return; }
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts");
  let preview = deployment.hosted ? hostedPreviews.get(fixture.id) : undefined;
  if (!preview) {
    preview = compileFixture(fixtureSource(fixture.id));
    if (deployment.hosted) {
      hostedPreviews.set(fixture.id, preview);
      void preview.catch(() => hostedPreviews.delete(fixture.id));
    }
  }
  res.type('html').send(await preview);
});
app.get('/api/runs', (_req, res) => res.json(listRuns().map(({ source, attempts, ...run }) => ({ ...run, attempts: attempts.map(({ source, patch, ...attempt }) => attempt) }))));
app.get('/api/runs/:id', (req, res) => { const run = readRun(req.params.id); if (!run) res.status(404).json({ error: 'Run not found.' }); else res.json(run); });
app.post('/api/runs', (req, res) => {
  if (active.size) { res.status(409).json({ error: 'A run is already active. Wait for it to finish or cancel it.' }); return; }
  const { fixture, mode } = req.body || {};
  if (typeof fixture !== 'string' || !getFixture(fixture) || !['audit', 'repair', 'verify-good', 'verify-regression'].includes(mode)) { res.status(400).json({ error: 'Choose a supported fixture and run mode.' }); return; }
  if (mode === 'repair' && !providerConfig().apiKey) { res.status(409).json({ error: 'Add NEBIUS_API_KEY to .env before starting live repair. Audits and verification exercises work without a key.' }); return; }
  if (mode.startsWith('verify-') && fixture !== 'signup') { res.status(400).json({ error: 'The known-patch verification lab uses the React signup fixture.' }); return; }
  if (deployment.hosted) {
    const denied = budget.reserve(mode === 'repair');
    if (denied) { res.status(429).json({ error: denied }); return; }
    pruneHostedRuns();
  }
  const run = createRun(fixture, mode as RunMode);
  const controller = new AbortController(); active.set(run.id, controller);
  res.status(202).json(run);
  // Flush the accepted response before TypeScript compilation can occupy the shared CPU.
  setImmediate(() => {
    void executeRun(run, controller.signal, undefined, { maxAttempts: deployment.maxAttempts, executionProfile: deployment.executionProfile }).finally(() => active.delete(run.id));
  });
});
app.post('/api/runs/:id/cancel', (req, res) => {
  const controller = active.get(req.params.id);
  if (!controller) { res.status(409).json({ error: 'This run is no longer active.' }); return; }
  controller.abort(); res.json({ cancelled: true });
});
app.get('/api/runs/:id/artifacts/:name', (req, res) => {
  const run = readRun(req.params.id); const name = req.params.name;
  if (!run || !/^(before|after-[12])\.png$/.test(name)) { res.status(404).end(); return; }
  res.sendFile(path.join(runDirectory(run.id), name), { dotfiles: 'allow' });
});
app.get('/api/runs/:id/report', (req, res) => {
  const run = readRun(req.params.id);
  if (!run) { res.status(404).end(); return; }
  if (ACTIVE_STATES.includes(run.state)) { res.status(409).json({ error: 'Wait for the run to finish before exporting.' }); return; }
  res.attachment(`accessfix-${run.id.slice(0, 8)}.html`).type('html').send(reportHtml(run));
});
app.get('/api/runs/:id/patch', (req, res) => {
  const run = readRun(req.params.id); const attempt = run?.attempts.find(item => item.accepted);
  if (run?.state !== 'accepted' || !attempt) { res.status(409).json({ error: 'No accepted patch is available for this run.' }); return; }
  res.attachment(`accessfix-${run.id.slice(0, 8)}.patch`).type('text/plain').send(attempt.patch);
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
const dist = path.join(ROOT, 'dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const invalidJson = error instanceof SyntaxError;
  const tooLarge = 'type' in error && error.type === 'entity.too.large';
  res.status(tooLarge ? 413 : invalidJson ? 400 : 500).json({ error: tooLarge ? 'Request exceeds the 4 KB limit.' : invalidJson ? 'Invalid JSON request.' : 'The runner could not complete this request. Check the server configuration and retry.' });
});
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, deployment.host, () => {
  const address = server.address();
  console.log(`AccessFix runner: http://${deployment.host}:${typeof address === 'object' && address ? address.port : port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  for (const controller of active.values()) controller.abort();
  server.close(); setTimeout(() => process.exit(0), 1000).unref();
});
