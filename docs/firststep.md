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

**Live coaching is disabled by default and is always disabled in hosted/judge-worker mode.** Having `NEBIUS_API_KEY` in `.env` does not enable it. For local development, both process environment settings must be explicitly supplied to the server:

- `FIRSTSTEP_LIVE_COACHING=true`
- `FIRSTSTEP_COACH_REQUEST_LIMIT=<1–20>`

The existing `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` and `NEBIUS_MODEL` configuration is reused. A request is reserved before inference; failed requests consume the configured allowance. Only one coaching request may be active. The cap is per server process and resets on restart; it is not a durable public billing limit. The transfer task rejects coaching requests. No automatic retries occur.

The UI labels authored guidance separately, explains what a live request sends, and does not expose the key. Live inference has not been exercised for this implementation. Adapter tests inject a fake provider; they do not establish real model quality or current account availability. This prototype should not be represented as a live NVIDIA/Nebius demonstration until a real authorized run is recorded.

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

Further work includes a broader validated scenario bank, accessibility testing beyond automated checks, a hardened execution architecture for public use, and authorized live-coaching evaluation. Employer recognition, real skill transfer and willingness to return remain unvalidated.
