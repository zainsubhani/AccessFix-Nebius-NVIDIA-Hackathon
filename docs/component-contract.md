# Standalone React component contracts

AccessFix runs a standalone component in a local React harness. It supports four explicit contracts; it does not launch arbitrary repositories, authenticate into a product, or test a real backend.

Every component must be a UTF-8 `.tsx` file of at most 40 KB, with one default React export and React-only imports. Strict TypeScript checking precedes browser execution. Test IDs and callbacks are the declared interface, not values inferred by the model. The original file stays unchanged.

| Contract | Props | Required test IDs | Protected behavior |
|---|---|---|---|
| `signup` | `onSubmit({ email, password, terms })` | `email`, `password`, `terms`, `submit` | Valid email, password of at least 8 characters, required consent, one unchanged payload |
| `login` | `onSubmit({ email, password })` | `email`, `password`, `submit` | Valid email, nonempty masked password, one unchanged credential payload |
| `dialog` | `onConfirm()` | `open-dialog`, `dialog`, `cancel`, `confirm` | Opening never confirms; Cancel/Escape close without confirmation; Publish confirms once |
| `navigation` | `onNavigate(destination)` | `nav-overview`, `nav-projects`, `nav-settings` | Each activation preserves its destination and fires once; no callback on rendering |

## Accessibility checks

Signup and login require associated `Email` and `Password` labels, keyboard submission, linked live error messages and focus on the first invalid field. Signup also requires the accessible consent name `I agree to the terms`.

The dialog is named `Publish changes?`. It has modal semantics, initially focuses Cancel, contains Tab/Shift+Tab while open, and returns focus to the trigger after Escape. Native `dialog` is supported. Navigation exposes the `Workspace` landmark, named links to `#overview`, `#projects` and `#settings`, and exactly one `aria-current="page"` entry, initially overview.

All contracts run axe scans in initial and active/error states and reject browser runtime errors. Signup, login and dialog currently have ten checks; navigation has eight. Check counts describe these contracts, not percentages of WCAG conformance.

## Run a component

```sh
npm run accessfix -- --component ./Signup.tsx --mode audit
npm run accessfix -- --component ./Login.tsx --contract login --mode audit
npm run accessfix -- --component ./Confirmation.tsx --contract dialog --mode repair --max-attempts 1
npm run accessfix -- --component ./Navigation.tsx --contract navigation --mode audit
```

`repair` sends source and findings to NVIDIA Nemotron through Nebius Token Factory and can consume inference credits. The model can propose the supplied component or abstain; it has no shell or filesystem tools. Only authorized source should be shared. Browser requests are blocked except for the temporary fixture document.

## Fixtures and verification exercises

The browser offers `signup`, `team`, `healthy`, `login`, `dialog` and `navigation`. Team invitation is a second signup implementation. The healthy signup is a clean baseline and skips inference.

```sh
npm run accessfix -- --fixture login --mode verify-good
npm run accessfix -- --fixture dialog --mode verify-regression
npm run accessfix -- --fixture navigation --mode verify-good
npm run accessfix -- --fixture signup --mode verify-recorded
```

Prepared good and regressing candidates test the independent gate without a model request. Regressions remove required consent/password validation, confirm on Cancel, or change a navigation destination. These prepared results are not AI repair evaluations.

`verify-recorded` freshly checks the unchanged candidate from the genuine saved NVIDIA/Nebius signup repair. It records a new run and current verification fingerprint, preserves the historical evidence, and makes no new inference request. It is available only for React signup.

## Keyboard evidence and artifacts

Fresh runs record actual Chromium screenshots after keyboard actions, along with observed focus target and bounds. The Keyboard replay view can play, pause and step through baseline/candidate traces. The visual outline is a viewer overlay; it never modifies the tested component. Shorter traces hold their last frame. Historical runs without traces remain readable and explain how to capture fresh evidence.

The CLI writes `.accessfix/runs/<id>/report.html`, `run.json`, captures and an accepted patch when every check passes. Reports embed the keyboard captures for offline review. Custom-component patches target the supplied basename; review the destination before applying.

The source and protected suite each have a SHA-256 fingerprint. The suite fingerprint covers the compiler, browser checks and focus recorder. All baseline checks are replayed unchanged against the candidate. These fixtures are a functional evaluation, not evidence of general repair accuracy. Real screen readers, application integration and user testing remain manual. The local harness is not an isolation boundary for hostile multitenant workloads.
