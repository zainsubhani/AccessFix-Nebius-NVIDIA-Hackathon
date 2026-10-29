# Deployment

AccessFix supports a local developer workflow and a password-protected, fixed-fixture judge demo. The included Render Blueprint selects **Free**, creates no persistent disk and disables new model requests. It is a demonstration environment, not a production service for customer repositories.

## Render Free judge demo

Deploy this repository as a Render Blueprint using `render.yaml`. The Blueprint builds `Dockerfile`, starts one Node service with Chromium and checks `/api/health`. It sets a shared username of `judge` and generates a random password in `ACCESSFIX_DEMO_PASSWORD`. Retrieve that value from the service's Environment page and share it privately with judges; never commit it or put it in a public URL. Render supplies the HTTPS origin through `RENDER_EXTERNAL_URL`.

The demo offers:

- Fresh audits of the three included public fixtures.
- A verification lab with explicitly prepared good and regressing candidates.
- A clearly labeled recording of the real NVIDIA/Nebius signup repair, including source diff, screenshots, checks, token usage and downloadable report.
- One active run at a time and a shared limit of 20 runs per UTC hour.

No Nebius API key is needed for this deployment. `ACCESSFIX_EPHEMERAL=true` requires `ACCESSFIX_MODEL_REQUEST_LIMIT=0`; the server refuses to start if paid inference is enabled with ephemeral accounting. Opening the recorded repair does not call the model.

Render Free currently provides 512 MB RAM and 0.1 CPU. Services sleep after 15 minutes without traffic and can take about a minute to wake. Files disappear on restart, redeploy or spin-down; the curated recording is restored at startup, while new runs and the hourly counter can disappear. Free instance hours and bandwidth are shared across the workspace. See [Render's free-service limits](https://render.com/docs/free) and [compute plans](https://render.com/docs/compute-plans). Do not add a paid disk or change the plan to run this Blueprint.

The free mode allows up to three minutes per component inspection, including compilation and browser execution; a two-component verification exercise can take longer. The checks and acceptance conditions remain the same as local mode. Before recording a demo, open the URL early, let the service wake, and run the audit once. The resource-constrained container smoke test exercises real Chromium, but it cannot guarantee Render's latency or availability.

## Container verification

```sh
docker build -t accessfix:judge-demo .
node scripts/container-smoke.mjs
```

The smoke test runs a temporary container with 512 MB RAM, 0.1 CPU and no inference key. It checks authentication, restored evidence, a clean Chromium audit and rejection of a prepared behavior regression. It removes its own container when finished. GitHub Actions runs this check on Linux alongside the engine and UI suites.

The entrypoint initializes the data directory and then drops to the unprivileged `node` user. The build copies only application inputs; `.env`, local run history and internal notes are excluded. Keep development dependencies installed in this image because the strict TypeScript component gate needs React type declarations at runtime.

## Hosted configuration

| Variable | Purpose |
|---|---|
| `ACCESSFIX_MODE=hosted` | Enables authenticated, restricted demo mode |
| `HOST=0.0.0.0`, `PORT` | Container listening address and platform port |
| `ACCESSFIX_DEMO_USER` | Shared judge username; cannot contain `:` |
| `ACCESSFIX_DEMO_PASSWORD` | Secret of at least 24 characters |
| `ACCESSFIX_PUBLIC_ORIGIN` | Exact public HTTPS origin; defaults to `RENDER_EXTERNAL_URL` |
| `ACCESSFIX_DATA_DIR` | Absolute run-data directory; image default `/var/data/accessfix` |
| `ACCESSFIX_EPHEMERAL=true` | Declares disposable storage and forbids paid inference |
| `ACCESSFIX_MODEL_REQUEST_LIMIT=0` | Global model-request reservation cap; zero disables live repair |
| `ACCESSFIX_RUNS_PER_HOUR=20` | Shared hourly limit for all run modes |

Only the health endpoint is unauthenticated. The UI, API, screenshots and reports require the shared credentials. Browser mutations must use the exact configured origin. This is a single shared judge workspace: all judges can see the public-fixture runs, and any judge can cancel the active run. It does not provide individual accounts or private projects.

Hosted mode allows at most one model attempt per repair. On a separately provisioned persistent host, enabling live repair would also require a server-side provider key and a deliberate nonzero budget. Reservations are written before execution and are not refunded; cancellation or provider failure can therefore consume a reservation. Do not run multiple instances or separate CLI processes against the same data directory. The free Blueprint leaves this capability disabled.

Completed runs expire after seven days, and history is capped at approximately 100 recent runs plus the curated recording. Cleanup runs on startup and before new runs; ephemeral storage can remove results sooner.

## Local production preview

```sh
npm ci
npm run browsers
npm run build
npm start
```

Open port 3001. Local mode binds to loopback and stores artifacts under `.accessfix/runs`. Keep `.env` server-side. Artifacts from the local CLI may contain complete supplied source. User cancellation aborts inference and closes the active Chromium instance.

The `start` command uses `tsx`; the frontend must already be built. The API, shared source, examples, Playwright browser binaries and operating-system dependencies must remain available. `npm run build` type-checks the backend but does not emit standalone server JavaScript.

## Execution boundary

The hosted API accepts only fixed public fixture identifiers. General repository or component upload is not enabled. Supporting arbitrary untrusted code requires stronger workload isolation, resource limits and a separate architecture review. The component harness is not a multitenant security boundary, and these checks do not establish full WCAG conformance.
