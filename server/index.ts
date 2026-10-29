import express from 'express';
import { randomUUID } from 'node:crypto';
import { acceptedSource, createDraft, exportStore, ExportError, githubApi, githubConfig, previewExport, type PreviewRecord } from './github-export.js';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ACTIVE_STATES, type RunMode } from '../shared/types.js';
import { ROOT, fixtures, getFixture, fixtureSource, providerConfig } from './config.js';
import { createRun, executeRun, listRuns, readRun, recoverInterruptedRuns, runDirectory } from './runner.js';
import { compileFixture } from './fixture-host.js';
import { reportHtml } from './report.js';
import { deploymentConfig, demoAuthentication, DemoBudget } from './deployment.js';
import { prepareHostedEvidence, pruneHostedRuns } from './hosted-evidence.js';
import { CoachingError, createFirstStepCoach } from './firststep-coach.js';
import { neonCoachBudget } from './firststep-budget.js';

const deployment = deploymentConfig();
const budget = new DemoBudget(deployment);
// Both switches must be set explicitly in the server environment. Existing keys do not opt in.
const coachBudget = process.env.FIRSTSTEP_BUDGET_DATABASE_URL ? neonCoachBudget(process.env.FIRSTSTEP_BUDGET_DATABASE_URL) : undefined;
const firstStepCoach = createFirstStepCoach({ enabled: process.env.FIRSTSTEP_LIVE_COACHING === 'true' && (!deployment.hosted || Boolean(coachBudget)), limit: Number(process.env.FIRSTSTEP_COACH_REQUEST_LIMIT || 0), budget: coachBudget });
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
// Hosted fixtures are immutable image contents; cache only the included public previews.
const hostedPreviews = new Map<string, Promise<string>>();
recoverInterruptedRuns();
if (deployment.hosted) { prepareHostedEvidence(); pruneHostedRuns(); }
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'accessfix' }));
app.get('/api/firststep/config', async (_req, res) => res.json(await firstStepCoach.status()));
app.post('/api/firststep/coach', async (req, res) => {
  try { res.json(await firstStepCoach.ask(req.body)); }
  catch (error) { res.status(error instanceof CoachingError ? error.status : 500).json({ error: error instanceof CoachingError ? error.message : 'Coaching is unavailable. Your draft is unchanged.' }); }
});
app.get('/api/config', (_req, res) => {
  try {
    const config = providerConfig();
    const remaining = deployment.hosted ? budget.remaining() : undefined;
    res.json({ providerConfigured: !!config.apiKey, model: config.model, fixtures, maxAttempts: deployment.maxAttempts, activeRunId: [...active.keys()][0], hostedDemo: deployment.hosted, ephemeralStorage: deployment.ephemeral,
      repairAvailable: !!config.apiKey && (!deployment.hosted || remaining! > 0),
      repairUnavailableReason: deployment.hosted ? deployment.ephemeral ? 'This free demo shows recorded AI repairs. New model requests are disabled; browser audits and the verification lab remain available.' : !config.apiKey ? 'Live repair is not configured for this demo. Explore saved evidence, audits and the verification lab.' : remaining === 0 ? 'Live-repair budget is exhausted or disabled. Saved evidence, audits and the verification lab remain available.' : undefined : undefined,
      modelRequestsRemaining: remaining, judgeWorker: process.env.ACCESSFIX_JUDGE_WORKER === 'true',
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
    preview = compileFixture(fixtureSource(fixture.id), fixture.contract);
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
  if (typeof fixture !== 'string' || !getFixture(fixture) || !['audit', 'repair', 'verify-good', 'verify-regression', 'verify-recorded'].includes(mode)) { res.status(400).json({ error: 'Choose a supported fixture and run mode.' }); return; }
  if (mode === 'repair' && !providerConfig().apiKey) { res.status(409).json({ error: 'Add NEBIUS_API_KEY to .env before starting live repair. Audits and verification exercises work without a key.' }); return; }
  if ((mode === 'verify-recorded' && fixture !== 'signup') || (mode.startsWith('verify-') && ['team', 'healthy'].includes(fixture))) { res.status(400).json({ error: 'Choose React signup for signup exercises and recorded repair replay, or a matching login, dialog or navigation exercise.' }); return; }
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
  const images = [run?.baseline, ...(run?.attempts.map(item => item.evidence) || [])].flatMap(item => item ? [item.screenshot, ...(item.focusTrace?.steps.map(step => step.screenshot) || [])] : []);
  if (!run || !/^(before|after-[12])(-focus-\d{1,2})?\.png$/.test(name) || !images.includes(name)) { res.status(404).end(); return; }
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
const exportPreviews = new Map<string, PreviewRecord>();
const activeExports = new Set<string>();
app.get('/api/github', (_req, res) => {
  const config = githubConfig();
  res.json({ enabled: config.enabled, repository: deployment.hosted ? '' : config.repository });
});
app.post('/api/runs/:id/github/preview', async (req, res, next) => {
  try {
    const config = githubConfig();
    if (!config.enabled) throw new ExportError('GitHub export is disabled in this workspace. Configure it on your local developer machine.', 403);
    const run = readRun(req.params.id);
    if (!run) throw new ExportError('Run not found.', 404);
    acceptedSource(run);
    const saved = exportStore(run.id).read();
    if (saved && (saved.preview.repository !== config.repository || saved.preview.path !== req.body?.path)) throw new ExportError('This run already has an export for a different destination.');
    const preview = saved ? { ...saved.preview, id: randomUUID(), createdAt: Date.now() } : await previewExport(run, req.body?.path, config, await githubApi());
    for (const [id, item] of exportPreviews) if (Date.now() - item.createdAt > 15 * 60_000) exportPreviews.delete(id);
    if (exportPreviews.size >= 100) exportPreviews.delete(exportPreviews.keys().next().value!);
    exportPreviews.set(preview.id, preview);
    const { runId, sourceHash, candidateHash, fileSha, createdAt, ...publicPreview } = preview;
    res.json(publicPreview);
  } catch (error) { if (error instanceof ExportError) res.status(error.status).json({ error: error.message }); else next(error); }
});
app.post('/api/runs/:id/github', async (req, res, next) => {
  const id = req.params.id;
  if (activeExports.has(id)) { res.status(409).json({ error: 'An export is already in progress for this run.' }); return; }
  activeExports.add(id);
  try {
    const run = readRun(id); const preview = exportPreviews.get(req.body?.previewId);
    if (!run) throw new ExportError('Run not found.', 404);
    if (!preview || preview.runId !== id || Date.now() - preview.createdAt > 15 * 60_000) throw new ExportError('The export preview expired. Review a fresh preview.');
    const config = githubConfig();
    if (!config.enabled) throw new ExportError('GitHub export is disabled in this workspace.', 403);
    res.json(await createDraft(run, preview, config, await githubApi(), exportStore(id)));
  } catch (error) { if (error instanceof ExportError) res.status(error.status).json({ error: error.message }); else next(error); }
  finally { activeExports.delete(id); }
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
