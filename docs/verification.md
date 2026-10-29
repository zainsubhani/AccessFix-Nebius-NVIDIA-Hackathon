# Verification

Evaluation snapshot: **29 October 2026**. These results concern the included standalone signup fixtures and the documented component contract. They are not a general repair-accuracy benchmark.

## Automated validation

| Check | Recorded result |
|---|---|
| `npm run build` | TypeScript checking and production frontend build passed |
| `npm test` | 10 engine tests passed using real Chromium |
| `npm run test:ui` | 2 UI tests passed across multiple workflows |
| Dashboard accessibility | No selected axe WCAG rule violations in tested states; intentionally broken fixture iframe excluded |
| Responsive layout | Tested at 1536, 1280, 390 and 320 CSS pixels |

Engine tests cover baseline failures, known-good acceptance, consent-regression rejection, a second component implementation, bounded retries, unchanged original source, provider failure, cancellation, prohibited imports, tool-call validation and HTML escaping.

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

Three repair runs used `nvidia/nemotron-3-super-120b-a12b` through Nebius Token Factory. Each started from the same broken signup and allowed two candidates.

| Run | Candidate checks passed | Final state | Reported input / output tokens |
|---|---|---|---|
| Initial instructions | 7/10 → 8/10 | Unresolved | 4,318 / 1,921 |
| Clarified React state/ref instructions | 7/10 → 9/10 | Unresolved | 4,815 / 2,016 |
| Updated sampling and native tool selection | 9/10 → 7/10 | Rejected: valid-submission regression | 4,790 / 2,164 |

**None of the six live candidates met the full acceptance gate.** Repeated defects included unattached refs, reading stale React error state for focus, and over-escaping the email-validation expression. Provider access and tool-call parsing worked; reliable autonomous repair remains an open limitation.

The first two runs used temperature `0.2` and required tool selection. The third used the current adapter settings: temperature `1`, top-p `0.95`, and automatic tool selection. All responses still pass through the same strict proposal parser and browser gate.

Total reported usage was 13,923 input tokens and 6,101 output tokens across six requests. Recorded provider wait time totaled 54.836 seconds, excluding browser verification. No monetary cost or population-level success rate is inferred from this small evaluation.

Original-source and protected-check fingerprints remained unchanged. No accepted patch was exported for these live runs. An assistant-edited diagnostic that read newly computed errors for focus passed 10/10 locally; that result establishes the specific defect, not successful autonomous generation.

## Evidence and reproduction

Each local run saves source/check-suite SHA-256 fingerprints, events, candidate diffs, checks, usage and screenshots. The CLI also writes a portable HTML report and, when accepted, a patch. The dashboard generates its downloadable report from the saved run.

Artifacts live in `.accessfix/runs/` and are excluded from version control because they can contain supplied source. Generate new evidence with the commands in the [README](../README.md). Live repair requires a valid provider key, model access and credits; results may vary.

## Limits

This evaluation does not cover arbitrary repositories, real backend validation, authenticated application flows, real screen-reader output, production multitenancy or customer pilots. Human review and assistive-technology testing remain necessary.
