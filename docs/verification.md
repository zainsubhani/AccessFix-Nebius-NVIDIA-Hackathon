# Verification

Evaluation snapshot: **29 October 2026**. These results concern the included standalone signup fixtures and the documented component contract. They are not a general repair-accuracy benchmark.

## Automated validation

| Check | Recorded result |
|---|---|
| `npm run build` | TypeScript checking and production frontend build passed |
| `npm test` | 23 engine, repair-context and hosted-deployment tests passed; browser cases use real Chromium |
| `npm run test:ui` | 2 UI tests passed across multiple workflows |
| Dashboard accessibility | No selected axe WCAG rule violations in tested states; intentionally broken fixture iframe excluded |
| Responsive layout | Tested at 1536, 1280, 390 and 320 CSS pixels |
| Free-tier container | Linux CI passed at 512 MB RAM and 0.1 CPU: authenticated evidence, fixture preview, clean audit and browser-confirmed consent-regression rejection |

In the successful constrained-container run, the clean audit took 68.502 seconds and the two-component regression exercise took 130.685 seconds. Reported memory use after completion was 230.9 MiB of 512 MiB; this is not a peak measurement. A fresh signup audit on Render Free completed in 63.304 seconds with the expected 6/10 baseline result and zero model requests. These are individual observations, not latency guarantees.

Engine and repair-context tests cover baseline failures, known-good acceptance, consent-regression rejection, a second component implementation, bounded retries, unchanged original source, provider failure, cancellation, prohibited imports, tool-call validation, HTML escaping, readable provider context and advisory diagnostics. Prepared stale-focus and invalid-TypeScript candidates are rejected and their failures reach the retry; prepared corrected candidates then pass. A one-attempt budget stops without another proposal. These tests verify orchestration, not autonomous generation.

Hosted-deployment tests cover fail-closed configuration, password authentication, exact-origin enforcement, protected reports and images, persisted run/model reservations, recorded-evidence restoration and a real audit after startup. The free configuration rejects nonzero inference budgets.

UI tests cover source inspection, audit results, prepared-candidate verification, diffs, report download, image loading, saved history, reload restoration, keyboard navigation, responsive layout and API failure recovery. Automated tests do not call Nebius. Injected test candidates and the verification lab must not be reported as autonomous AI repairs.

## Fixture outcomes

| Input | Observed result |
|---|---|
| React signup | 6/10 checks pass; labels, keyboard completion, error feedback and focus fail |
| Team invitation | 8/10 checks pass; error feedback and focus fail |
| Working signup | 10/10 pass; inference is skipped |
| Prepared good candidate | 10/10 pass; accepted for human review |
| Prepared consent regression | Rejected despite improved accessibility behavior |

The broken signup's placeholders satisfy axe's accessible-name rules. The explicit labels and keyboard journey still fail, illustrating why scanner results alone do not establish task completion.

## Live NVIDIA/Nebius evaluation

Five repair runs used `nvidia/nemotron-3-super-120b-a12b` through Nebius Token Factory. Each started from the same broken signup. The first three generated two candidates each; the final two generated one each.

| Run | Candidate checks passed | Final state | Reported input / output tokens |
|---|---|---|---|
| Initial instructions | 7/10 → 8/10 | Unresolved | 4,318 / 1,921 |
| Clarified React state/ref instructions | 7/10 → 9/10 | Unresolved | 4,815 / 2,016 |
| Updated sampling and native tool selection | 9/10 → 7/10 | Rejected: valid-submission regression | 4,790 / 2,164 |
| Readable source context and focused repair instructions | 10/10 | Historical browser acceptance; strict TypeScript failed during review | 1,942 / 1,087 |
| Strict TypeScript gate and explicit nullable-state instructions | 10/10 | Accepted: strict TypeScript and browser checks passed | 1,999 / 1,072 |

**The latest candidate meets the current strict-TypeScript and browser acceptance gate.** The initial six failed the browser gate; repeated defects included unattached refs, reading stale React error state for focus, and over-escaping the email-validation expression. The seventh passed the browser checks but failed a follow-up strict type check because `useState(null)` could not accept an error object. This exposed that esbuild transpilation alone did not verify TypeScript semantics. The compiler gate now rejects this defect before browser execution and provides diagnostics for a bounded retry.

The first two runs used temperature `0.2` and required tool selection. Later runs used the current adapter settings: temperature `1`, top-p `0.95`, and automatic tool selection. The ten browser checks remained unchanged; the fifth run added the strict TypeScript prerequisite. Historical verdicts are preserved rather than relabeled as passes under the newer gate.

Total reported usage was 17,864 input tokens and 8,260 output tokens across eight requests. Recorded provider wait time totaled 71.490 seconds, excluding browser verification. No monetary cost or population-level success rate is inferred from this small evaluation.

Original source remained unchanged throughout. No accepted patch was exported for the initial three runs. The fourth exported a patch under the older browser-only gate, but that patch is not valid under the current TypeScript requirement. An earlier assistant-edited focus diagnostic is separate from all model outcomes and is not counted as autonomous generation.

### Retry-feedback revision

After the first six candidates, the adapter was updated to send readable source sections and targeted advisory diagnostics for changed regex literals, unattached refs and focus decisions using render-state errors. Instructions now favor preserving original validation branches and explicitly typing nullable state. Local regression tests verify the request format, diagnostics and rejected candidates reaching the second attempt. The last two live runs succeeded on the browser journey without a retry, so they do not establish the live effectiveness of the new retry diagnostics.

### Latest accepted run

Run `20059716-75ab-457d-a685-28d0d9671158` used a hard one-request limit. Its unedited model candidate passed strict TypeScript compilation and all ten browser checks, with zero selected axe violations, runtime errors or behavior regressions. It improved the original signup from 6/10 to 10/10 in 10.472 seconds end to end, including 6.089 seconds of provider wait. The run used 1,999 input and 1,072 output tokens. Original-source and current verification-suite fingerprints were unchanged during the run. A report and accepted patch were exported for human review.

This is one successful autonomous repair of the included signup fixture. It does not establish repeatability, repair accuracy on unseen components, screen-reader usability or production readiness.

## Evidence and reproduction

Each local run saves source/check-suite SHA-256 fingerprints, events, candidate diffs, checks, usage and screenshots. The CLI also writes a portable HTML report and, when accepted, a patch. The dashboard generates its downloadable report from the saved run.

Local artifacts live in `.accessfix/runs/` and are excluded from version control because they can contain supplied source. One curated copy of the latest accepted run, using only the public signup fixture, is included under `demo/verified-signup/` for hosted playback. It retains the original timestamps, verification fingerprint and usage; the hosted UI and report label it as a recording. New free-hosted runs use longer browser readiness waits to accommodate shared CPU throttling, recorded as the `free-demo` execution profile. The historical AI run used local timings. Generate new evidence with the commands in the [README](../README.md). Live repair requires a valid provider key, model access and credits; results may vary.

## Limits

This evaluation does not cover arbitrary repositories, real backend validation, authenticated application flows, real screen-reader output, production multitenancy or customer pilots. Human review and assistive-technology testing remain necessary.
