# Architecture

AccessFix separates model proposals from acceptance. The model supplies one component; a protected browser harness decides whether that component meets the supported contract.

## Components

| Layer | Implementation | Responsibility |
|---|---|---|
| Workbench | React, TypeScript, Vite | Fixture selection, source inspection, progress, evidence, history and downloads |
| Local API | Express | Configuration status, one active dashboard run, cancellation and artifacts |
| Runner | `server/runner.ts` | Baseline audit, bounded proposal/verification loop, terminal states and persistence |
| Provider adapter | `server/provider.ts` | Server-side Nebius authentication, NVIDIA model request and strict tool-call parsing |
| Browser checks | Playwright and axe-core | User interactions, validation behavior, accessibility scans and screenshots |
| Component harness | esbuild and React | React-only source bundling and a wrapper-owned submit callback |

## Repair lifecycle

1. Read the component and fingerprint both its source and the protected checks.
2. Run the baseline in Chromium. A fully passing baseline ends as `clean` without inference; audit-only mode reports findings.
3. Send the component, observed failures and any previous candidate feedback to NVIDIA Nemotron through Nebius Token Factory.
4. Accept exactly one supported tool response: `propose_patch` with complete component source, or `abstain` with a reason.
5. Build the proposed component and replay the same checks. Accept only when all checks pass, no axe violations remain, and no previously passing check regresses.
6. If necessary, request one further proposal using actual failed-check feedback. Persist the final accepted, rejected, unresolved, error or cancelled state.

There are at most two model requests per repair run, a 120-second provider-request timeout and a 60-second limit for each component inspection. The original file is never overwritten. An accepted diff is an output for human review.

## Protected behavior

The harness owns the confirmation screen and records the component's `onSubmit` payload. Checks exercise labels, keyboard completion, linked validation messages, focus, valid submission, malformed email, short passwords, required consent, axe rules and browser runtime errors. See the [component contract](component-contract.md) for selectors and semantics.

Protected source files are outside the model's replacement scope. Generated code still executes inside a browser and can access page globals; this design is not a security boundary against deliberately hostile components. Import restrictions, browser request blocking and CSP reduce the available surface but do not establish a multitenant sandbox.

## Data flow and storage

The API key is read only by the backend from the process environment or local `.env`. The browser receives configuration status, never the key. Live repair sends source, findings and retry context to the configured HTTPS Nebius endpoint. The adapter permits only Nebius hostnames and NVIDIA model identifiers.

Local JSON records, PNG captures and CLI exports are stored under `.accessfix/runs/<id>/`. Records may contain complete component source. Dashboard reports embed images for offline review. No database, remote artifact store or shared-account authorization is included.

Dashboard concurrency is limited to one active run per API process. Separate CLI processes are not coordinated by a shared queue. Startup recovery marks interrupted records as errors; avoid restarting the API while a separate CLI run is active in the same data directory.

## Deployment scope

The application runs on a local CPU host; Token Factory provides hosted model inference. The API and fixture servers bind to loopback. See [deployment](deployment.md) for the changes required before serving a public demo and [verification](verification.md) for measured behavior and limitations.
