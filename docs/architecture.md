# Architecture

AccessFix separates model proposals from acceptance. The model supplies one component; a protected browser harness decides whether that component meets the supported contract.

## Components

| Layer | Implementation | Responsibility |
|---|---|---|
| Workbench | React, TypeScript, Vite | Fixture selection, source inspection, progress, evidence, history and downloads |
| API | Express | Configuration status, one active dashboard run, cancellation, artifacts and hosted demo authentication |
| Runner | `server/runner.ts` | Baseline audit, bounded proposal/verification loop, terminal states and persistence |
| Provider adapter | `server/provider.ts` | Server-side Nebius authentication, NVIDIA model request and strict tool-call parsing |
| Repair context | `server/repair-context.ts` | Readable source context and advisory diagnostics for rejected candidates |
| Browser checks | Playwright and axe-core | User interactions, validation behavior, accessibility scans and screenshots |
| Component harness | TypeScript, esbuild and React | Strict source type checking, React-only bundling and wrapper-owned submit, confirmation and navigation callbacks |

## Repair lifecycle

1. Read the component and fingerprint both its source and the protected checks.
2. Run the baseline in Chromium. A fully passing baseline ends as `clean` without inference; audit-only mode reports findings.
3. Send the component, observed failures and any previous candidate feedback to NVIDIA Nemotron through Nebius Token Factory.
4. Accept exactly one supported tool response: `propose_patch` with complete component source, or `abstain` with a reason.
5. Require strict TypeScript checking before bundling the proposed component, then replay the same browser checks. Accept only when compilation succeeds, all checks pass, no axe violations remain, and no previously passing check regresses. Type errors are returned as execution feedback for a bounded retry.
6. If necessary, request one further proposal using actual failed-check feedback. Persist the final accepted, rejected, unresolved, error or cancelled state.

There are at most two model requests per repair run, a 120-second provider-request timeout and a 60-second limit for each local component inspection (180 seconds in the resource-constrained free hosted demo). The CLI can lower the request cap to one with `--max-attempts 1`. The original file is never overwritten. An accepted diff is an output for human review.

The provider receives original and previous-candidate source as separate plain-text sections, with structured browser observations alongside them. Source is not nested inside a second JSON string. Retry feedback preserves failed checks, regressions and execution errors. Advisory TypeScript syntax analysis also highlights changed regular-expression literals and, after a focus-check failure, unattached refs or focus decisions that read React error state. These observations are heuristics, not proof of a defect; they neither edit source nor alter acceptance. Candidate diagnostics are saved in the run JSON.

## Protected behavior

The selected contract protects signup, login, confirmation dialog or navigation behavior. The harness owns callbacks and outcome screens. Signup and login checks exercise labels, keyboard completion, validation, focus and exact payloads; dialog checks protect focus containment, Escape, Cancel and explicit confirmation; navigation checks protect semantic links, destinations and current-page state. All contracts run axe and browser-runtime checks. See the [component contract](component-contract.md) for selectors and semantics.

Protected source files are outside the model's replacement scope. Generated code still executes inside a browser and can access page globals; this design is not a security boundary against deliberately hostile components. Import restrictions, browser request blocking and CSP reduce the available surface but do not establish a multitenant sandbox.

New run fingerprints cover `server/checks.ts`, `server/contract-checks.ts`, `server/focus-trace.ts` and `server/fixture-host.ts`, so browser checks, trace collection and the TypeScript/build gate are included. Historical runs made before this gate was added fingerprinted only the browser-check source and retain their original verdicts; a historical browser pass does not establish strict TypeScript validity.

## Data flow and storage

The API key is read only by the backend from the process environment or local `.env`. The browser receives configuration status, never the key. Live repair sends source, findings and retry context to the configured HTTPS Nebius endpoint. The adapter permits only Nebius hostnames and NVIDIA model identifiers.

Local JSON records, PNG captures and CLI exports are stored under `.accessfix/runs/<id>/`. Records may contain complete component source. Keyboard traces capture actual browser screenshots and the focused element after each bounded keyboard action. The replay compares before/candidate frames; it does not simulate assistive technology. Dashboard reports embed captures and trace frames for offline review. Replaying the curated AI candidate creates a fresh verification record with provenance and makes no model request; the historical record stays unchanged. There is no database or remote artifact store. Hosted mode uses a configurable data directory and shared judge credentials for all UI, API and artifact access. It restores one curated public-fixture recording from `demo/verified-signup`; other local run history is never included in the image.

Dashboard concurrency is limited to one active run per API process. Separate CLI processes are not coordinated by a shared queue. Startup recovery marks interrupted records as errors; avoid restarting the API while a separate CLI run is active in the same data directory.

## Deployment scope

The application runs on a CPU host; Token Factory provides hosted model inference. Local mode and internal fixture servers bind to loopback. Hosted mode requires strong shared credentials, an exact HTTPS origin and an explicit data directory before exposing the API. It limits run starts, retains recent artifacts and reserves any configured model budget before execution. One hosted repair can use at most one model request.

The Render Free Blueprint declares ephemeral storage, caps model requests at zero and restores the labeled recorded AI repair after restarts. Fresh audits and prepared-candidate checks still execute Chromium. Enabling inference with ephemeral accounting is rejected at startup. See [deployment](deployment.md) for configuration and [verification](verification.md) for measured behavior and limitations.
