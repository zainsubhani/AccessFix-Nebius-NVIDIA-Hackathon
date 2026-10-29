# Deployment boundary

The current deliverable is a working **local** tool and controlled-fixture dashboard. It runs on loopback by design. It does not run arbitrary customer repositories on a shared host.

## Local production preview

```sh
npm ci
npm run browsers
npm run build
npm start
```

Open port 3001. Keep `.env` server-side. Run data persists in `.accessfix/runs`; these artifacts can contain the full source submitted through the local CLI. Stop the server with Ctrl+C. User-requested cancellation aborts inference and closes the active Chromium instance.

## Before a public demo

Host the Node service and Chromium worker on a VM/container; a static frontend host alone cannot execute these browser checks. Nebius AI Cloud is an option for hosting; Nebius Token Factory already supplies model inference. Public deployment should use a fixed fixture allowlist, signed or authenticated demo sessions, a small per-user/global request budget, concurrency limits, a timeout-bound worker, artifact expiry and TLS. Restrict accepted origins to the deployed app origin. Never publish the API key or run artifacts containing private source.

Do not enable general repository upload in this MVP. Supporting arbitrary untrusted code requires stronger workload isolation, resource limits and a separate architecture review. The local component harness is not a multitenant security boundary.

The current API binds only to `127.0.0.1` and accepts loopback browser origins. Public hosting requires deliberate configuration changes; changing the bind address alone is insufficient. This release includes no cloud provisioning or public deployment.

The `start` command uses `tsx`, included as a runtime dependency. A production installation must also contain the built `dist/` frontend, server and shared source, examples, Playwright browser binaries, and their operating-system dependencies. `npm run build` type-checks the backend but does not compile it into standalone JavaScript.
