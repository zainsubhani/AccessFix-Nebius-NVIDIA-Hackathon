# FirstStep: a developer practice shift

FirstStep is an experimental learning workflow at `/` (with `/firststep` as an alias). A learner investigates an authored support incident, edits a JavaScript decision function, executes behavioural checks, explains the change, and applies the underlying concept to a different scenario. The companion AccessFix workbench remains available at `/accessfix`.

## Product hypothesis and challenge

The target learner knows basic JavaScript but has little experience investigating unfamiliar software. The hypothesis is that working from customer evidence and protecting existing behaviour can improve performance on a related, unfamiliar task.

This is not a demonstrated learning outcome. [Forage](https://www.theforage.com/) already offers employer-designed simulations. [CodeSignal](https://codesignal.com/learning-in-context/) offers contextual practice, AI coaching and post-learning assessment. Adaptive practice alone is not a defensible novelty claim. The proposed focus is a transparent investigation-to-regression-to-transfer loop with inspectable execution evidence.

The current missions are small decision-function exercises. They do not yet simulate a full repository, changing production requirements, teamwork, asynchronous payments or a complete engineering job. A certificate would not establish hiring readiness. External AI assistance cannot be reliably detected, and all browser-delivered scenario material can be inspected.

## Current scope

- **FS-101:** Fully discounted checkout rejects valid orders. Repair zero-total handling while preserving email, amount and payment-token rules.
- **FS-102:** A complimentary workshop seat must still require eligibility. This transfer task is a different context with a separate eligibility condition, not a validated parallel assessment.
- Customer messages, logs, product notes and staged hints are authored fixtures, labelled in the interface.
- A small test checkout/reservation preview executes the current decision function. No real orders, bookings or payments occur.
- Each mission has nine deterministic, authored checks. Results are computed from returned values, not an LLM score.
- Editing source invalidates the current passing status. The transfer task requires passing checkout checks and a handoff of at least 40 characters. The length check records participation, not explanation quality.
- JSON export includes source drafts, observations, baseline/review checks and recorded hint use. It is a self-directed practice record, not a verified credential.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/firststep`. No inference key is required for authored practice. The existing server also serves the built route after `npm run build` and `npm start`.

The interface saves non-sensitive practice drafts in this browser tab's session storage, with a 24-hour restore expiry. It does not create accounts or upload code. Reload restores drafts, observations and hint counts, but discards stored execution results and requires fresh checks before unlocking the transfer task. Download evidence before closing the tab. Storage errors leave the current draft in memory and show a warning.

## Execution boundaries

Learner code runs in a disposable Web Worker created inside a sandboxed iframe with an opaque origin. Candidate code has no DOM access. The frame content security policy denies outbound connections and restricts content sources; the parent retains the expected results. The parent removes the frame after completion, cancellation or a three-second timeout. Source is limited to 6,000 characters. No learner code is evaluated by Node.js or the API server.

This boundary is for local practice. It is not a hardened public execution service, a resource quota, anti-cheating mechanism or trusted certification system. Browser-delivered checks are inspectable; deliberate tampering can undermine self-reported evidence. Browser memory exhaustion and platform-specific worker behaviour need further review before general public release. Do not paste proprietary code or secrets into the prototype.

## NVIDIA and Nebius coaching

The optional server adapter calls an NVIDIA model through Nebius Token Factory. It receives only a learner question and the public, authored checkout facts. It has no tools, filesystem access or grading authority. Its prompt requests a short debugging hint without a full solution, but model compliance is not guaranteed.

**Live coaching is opt-in.** Having `NEBIUS_API_KEY` alone does not enable it. For local development, set `FIRSTSTEP_LIVE_COACHING=true` and `FIRSTSTEP_COACH_REQUEST_LIMIT=<1–20>` in the server process environment. This local-only allowance resets on restart.

For hosted use, additionally configure `FIRSTSTEP_BUDGET_DATABASE_URL` and apply [the budget migration](../db/001-firststep-budget.sql) once. Hosted mode refuses to enable coaching without this durable ledger. The release uses the existing Render Free service and a separate Neon Free Postgres database. No learner source, questions or responses are stored in the ledger.

The ledger authorizes at most $5 in conservative reservations: five cents per attempted request, including failures, up to 100 attempts. The initial five-cent reservation covers the first live verification made before the ledger existed. The database update is atomic; concurrent servers, reloads, restarts and reapplying the migration cannot reset the allowance. The ledger expires after the scheduled judging period, on 16 December 2026 UTC. Missing database access, an absent row or exhausted reservations fail closed before inference. Authored practice remains usable.

The budgeted model is pinned to `nvidia/nemotron-3-super-120b-a12b`, with at most 8 KiB of serialized prompt text and 1,200 output tokens. On 29 October 2026 the Token Factory pricing console listed $0.30 per million input tokens and $0.90 per million output tokens. Five cents per request is a conservative allowance, not a claim about actual charges. Recheck pricing before changing the model or limits. This protects FirstStep's configured coach; unrelated calls made with the same provider account are outside this ledger.

Only one coaching request runs per server process; the transfer task rejects coaching. No automatic retries occur. The UI separates authored hints from live responses and exports model, time and token metadata for live assistance received on the current page.

A real authorized FirstStep request succeeded on 29 October 2026: HTTP 200, 1,581 ms, 406 input tokens and 179 output tokens. See [runtime evidence](evidence/firststep-runtime.json). This single observation establishes a working runtime connection, not model quality, learning gains or a latency guarantee.

## Demonstration

1. Open the guided mission and click **Place test order** with the 100% discount scenario. Observe the rejection.
2. Open the customer reproduction steps, checkout log and product decision.
3. Click **Reproduce incident**. The original code passes seven of nine checks.
4. Edit `decide(input)`. A fix that simply confirms everything fails the regression checks.
5. Preserve invalid-input checks, handle valid zero totals without a charge, and retain the paid-order token requirement. Run all checks.
6. Explain the cause, fix and regression risks in the handoff. Open the transfer task.
7. Repair complimentary reservations while preserving the separate eligibility rule. Download the practice evidence.

The optional mentor is a hint source, not a judge. A staged demo should be labelled as a demonstration; it does not establish learning gains.

## Validation and next decision

Run `npm run build`, `npm test`, and `npm run test:ui` with the development server available. The FirstStep browser tests cover accepted and rejected code, source-change invalidation, transfer gating, export, draft restore, keyboard access, narrow layouts, automated accessibility checks, syntax errors, cancellation, timeout and attempted network access.

Before expanding the curriculum, observe a small voluntary learner pilot. Compare matched unfamiliar tasks before and after practice, record assistance, review explanations manually, and collect task-level confusion and dropout feedback. Use a comparison condition if making causal learning claims. A small pilot is usability evidence, not proof of employment impact.

Further work includes a broader validated scenario bank, accessibility testing beyond automated checks, a hardened execution architecture for public use, and broader live-coaching evaluation. Employer recognition, real skill transfer and willingness to return remain unvalidated.
