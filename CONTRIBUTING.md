# Contributing

FirstStep is a developer practice lab with authored incidents, executable checks and optional NVIDIA/Nebius coaching. The earlier AccessFix workbench is retained at `/accessfix`. Keep scenario facts, model guidance and executable evidence clearly distinguished.

## Development setup

Follow the [README](README.md) to install Node.js 22+, dependencies and Chromium. Audits, the verification lab and automated tests do not require a Nebius key.

Create a branch for a focused change. Keep source and test fixtures small enough for a reviewer to understand the behavior being exercised.

## Validation

```sh
npm run build
npm test
```

For UI changes, start `npm run dev` in another terminal, then run:

```sh
npm run test:ui
```

To test against the built frontend, run `npm start` after building, and set `ACCESSFIX_TEST_URL=http://127.0.0.1:3001` for the UI suite. GitHub Actions uses that path. Linux environments need `npx playwright install --with-deps chromium`.

## Pull requests

Explain the user-visible change, relevant limitations and checks performed. Update documentation when changing a mission, component contract, provider behavior, acceptance rules or supported deployment model. Add regression coverage for meaningful behavior changes; avoid assertions that merely duplicate implementation.

Do not weaken acceptance checks to make a candidate pass. Changes to the protected contract must be explicit and reviewed independently from proposed component repairs. Distinguish live model output from prepared fixtures and manual corrections in test results and demonstrations.

## Credentials and reports

Never commit `.env`, API keys, local run artifacts, private component source or personal account data. Use `.env.example` for variable names and placeholders. Reports included in an issue or pull request should contain only source and data you are authorized to publish.

If reporting a security issue, avoid posting credentials or an exploit against a running third-party service in a public issue. The current harness is a local development tool, not a sandbox for hostile multitenant execution.
