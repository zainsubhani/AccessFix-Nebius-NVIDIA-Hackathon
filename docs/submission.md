# FirstStep — submission brief

Prepared for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/), **Best Apps and Agents** track.

## Elevator pitch

Practice the engineering work around a code fix: investigate customer evidence, reproduce a failure, protect existing behavior with executable checks and explain the decision before trying a new scenario.

## Problem and audience

FirstStep targets learners who know basic JavaScript but have limited experience investigating unfamiliar software. The hypothesis is that evidence-driven practice and regression checking can improve how they approach another incident. It has not yet been validated with learners.

## What it does

A guided mission concerns checkout rejecting valid fully discounted orders. Learners inspect authored customer steps, logs and requirements, edit a JavaScript function and run nine deterministic checks. The simulated checkout executes the current draft. Passing checks and a written handoff unlock complimentary workshop reservations with a separate eligibility rule. Drafts restore per browser tab, and practice evidence exports as JSON.

## How it is built

React, TypeScript and Vite provide the interface; Node.js and Express serve the app and optional coaching API. Code executes in a disposable browser worker inside a sandboxed iframe. The optional adapter calls NVIDIA Nemotron through Nebius Token Factory for focused hints. Executable checks, rather than model scores, determine whether a draft meets the authored cases.

**Live FirstStep coaching is disabled and has not been tested with the real provider.** Hosted mode forces it off. Automated provider tests inject fake responses. The current prototype must not be represented as having demonstrated the required NVIDIA/Nebius runtime usage.

## Judging fit

| Criterion | Demonstrable evidence | Remaining gap |
|---|---|---|
| Technological implementation | Executed checks, regression rejection, invalidation of stale results, cancellation and timeout | Real NVIDIA/Nebius runtime validation |
| Design | Complete investigation-to-review flow; responsive and keyboard-accessible interface | Observed learner usability feedback |
| Potential impact | Specific learner audience and practical incident workflow | Usefulness, repeat use and learning evidence |
| Quality of idea | Transparent investigation, verification and follow-up practice | Differentiation from existing simulations and AI learning platforms |

These criteria have equal weight in the [official rules](https://nebiusglobalaihackathon.devpost.com/rules). This is a project assessment, not an official score.

## Prior work and changes

The repository began as AccessFix, an accessibility repair workbench. FirstStep adds a separate learner workflow, authored missions, browser execution, practice records and optional coaching. AccessFix remains at `/accessfix`; its recorded model output does not establish FirstStep coaching usage. Disclose this history when describing work completed during the event.

## Submission assets and release gates

| Item | State |
|---|---|
| Public repository | [FirstStep-Nebius-NVIDIA-Hackathon](https://github.com/zainsubhani/FirstStep-Nebius-NVIDIA-Hackathon) |
| License and setup | MIT; README and FirstStep guide |
| Judge hosting | Existing authenticated Render Free service; verify the merged FirstStep release before sharing |
| Demonstration | [FirstStep script](demo-script.md); local recording does not constitute submission |
| NVIDIA/Nebius runtime | Pending an explicitly authorized live FirstStep run |
| Public video | Pending final recording with runtime evidence and public YouTube upload |
| Devpost entry | Description prepared here; final submission not performed |

Deadline: **30 October 2026, 10:00 PDT / 18:00 Europe/Paris**. The [rules](https://nebiusglobalaihackathon.devpost.com/rules) require a working demo or test build, public open-source code and setup instructions, a public YouTube video under three minutes, required runtime model usage, and access throughout judging. Verify the event page before submitting.

## What we have not established

Two small functions do not simulate a complete job. The follow-up task is not a validated equivalent assessment. Browser tests are inspectable; exported evidence is self-reported practice material. No pilot, causal learning gain, employment benefit or employer endorsement is claimed.
