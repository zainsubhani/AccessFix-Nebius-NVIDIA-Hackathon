# FirstStep

**Investigate the incident. Verify the fix. Explain the decision.**

FirstStep is a developer practice lab for learners who know basic JavaScript and want to investigate unfamiliar software. Work from a simulated customer ticket, reproduction steps and logs; edit a small decision function; execute regression checks; then try another scenario.

Built for the [Nebius × NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/). Intended track: **Best Apps and Agents**.

## Quick start

```sh
git clone https://github.com/zainsubhani/FirstStep-Nebius-NVIDIA-Hackathon.git
cd FirstStep-Nebius-NVIDIA-Hackathon
npm ci
npm run dev
```

Requires Node.js 22+. Open [localhost:5173](http://127.0.0.1:5173). `/firststep` is an alias. Practice requires no API key and executes learner code in the browser. Chromium installation is needed only for automated browser tests and the companion accessibility workbench.

The existing [Render judge service](https://accessfix-nebius-nvidia-demo.onrender.com/) uses shared credentials supplied privately. See [deployment](docs/deployment.md) for release verification and free-tier limits. Its hosting address retains the earlier AccessFix name.

## Workflow

1. **Investigate:** inspect customer reproduction steps, application events and product requirements.
2. **Reproduce:** execute the original checkout code. Seven of nine checks pass; valid free orders fail.
3. **Repair:** edit `decide(input)` and try the simulated checkout with the current draft.
4. **Verify:** run nine behavioral checks. Overbroad fixes fail regression cases.
5. **Explain:** record the cause, fix, risks and assistance in a reviewer handoff.
6. **Transfer:** try complimentary workshop reservations, where eligibility remains mandatory even when the fee is zero.
7. **Keep evidence:** export drafts, observations, results and recorded assistance as JSON.

Drafts are saved in this browser tab for up to 24 hours. Reload restores work but requires fresh checks; stale results cannot unlock the next mission.

## NVIDIA and Nebius

An optional server adapter calls an NVIDIA Nemotron model through **Nebius Token Factory** for a focused debugging hint. It sends only the learner's question and public scenario facts, not learner source. The coach does not execute code or determine passing grades.

**Real FirstStep inference was verified on 29 October 2026** with `nvidia/nemotron-3-super-120b-a12b`: a debugging question received an HTTP 200 response in 1.58 seconds, using 406 input and 179 output tokens. See the [runtime evidence](docs/evidence/firststep-runtime.json). A second request through the deployed judge app also returned HTTP 200; see the [hosted runtime evidence](docs/evidence/firststep-hosted-runtime.json). Automated tests use fake responses, separate from these two live requests.

The [integration guide](docs/firststep.md#nvidia-and-nebius-coaching) documents explicit opt-in and request limits. Keep keys in local `.env`, never frontend code or GitHub. Hosted coaching requires a durable Postgres budget ledger in addition to explicit opt-in. Key presence alone does not enable it. The companion repair budget remains disabled.

## Scope

The two missions are authored decision-function exercises, not a full repository or dynamically changing incident. Customer evidence and hints are fixed content. The second task is not a validated parallel assessment. Browser-delivered checks can be inspected, handoff length is not a quality score, and exported records do not establish independent work or job readiness. Learning gains have not been demonstrated with users.

Code runs in a disposable worker inside an opaque-origin sandboxed iframe, with outbound connections blocked and a three-second timeout. This is a practice boundary, not a hardened hostile-code execution service. See [limitations](docs/firststep.md).

## Development

```sh
npm run browsers
npm run build
npm test
```

With `npm run dev` running in another terminal:

```sh
npm run test:ui
```

For a production preview, run `npm run build` then `npm start`, and open `http://127.0.0.1:3001`. Tests make no live model requests. CI includes production-build browser tests and a constrained deployment-container smoke test. The [release verification record](docs/evidence/firststep-release-verification.json) includes 19 additional checks against the hosted release.

## Documentation

| Guide | Contents |
|---|---|
| [FirstStep](docs/firststep.md) | Missions, execution boundary, coaching setup and validation plan |
| [Demo walkthrough](docs/demo-script.md) | Reproducible demonstration and narration |
| [Submission brief](docs/submission.md) | Project description, judging fit and remaining requirements |
| [Deployment](docs/deployment.md) | Free judge service and production preview |
| [Contributing](CONTRIBUTING.md) | Review, testing and credential handling |

## Companion workbench

The repository originated as AccessFix. Its accessibility repair workbench remains at `/accessfix`, with [separate documentation](docs/accessfix.md). Recorded AccessFix model output is **not FirstStep coaching evidence**. Internal `ACCESSFIX_*` configuration and `.accessfix/` artifact paths remain for compatibility.

## License

[MIT](LICENSE). Model and hosted-provider usage remain subject to their respective terms.
