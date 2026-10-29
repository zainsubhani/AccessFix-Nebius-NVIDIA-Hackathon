# Standalone signup component contract

AccessFix v0.1 runs a component in its own local React harness. It does not yet launch an arbitrary repository, authenticate into a product, or test its real backend. The CLI supports your own component when it follows this contract, plus the included `signup`, `team`, and `healthy` examples.

1. Export one React component as default from a UTF-8 `.tsx` file, up to 40 KB. Only imports from React are supported. Extract app-specific dependencies before using this version.
2. Accept `onSubmit({ email: string, password: string, terms: boolean })` as a prop. Call it exactly once after successful validation. The protected wrapper owns the confirmation screen.
3. Use `data-testid="email"`, `"password"`, `"terms"`, and `"submit"` on the respective controls. These selectors form the explicit test contract; they are not inferred by the model.
4. Keep accessible names `Email`, `Password`, and `I agree to the terms`. Signup requires a valid email, a password of at least 8 characters, and checked consent.
5. Error text must be associated with its invalid field. On invalid submit, move focus to the first invalid field.

```sh
npm run accessfix -- --component ./path/to/Signup.tsx --mode audit
npm run accessfix -- --component ./path/to/Signup.tsx --mode repair
```

`repair` sends the supplied source and browser observations to the configured NVIDIA model at Nebius. Only use source you are authorized to share. The original file is never modified. The model can return a replacement component or abstain; it has no filesystem or shell tools. Imports are restricted at build time; browser requests are blocked except for the temporary fixture document.

Inspect `.accessfix/runs/<id>/report.html`, `run.json`, the PNG captures and (when accepted) `accepted.patch`. For a custom component, the patch targets its basename; review and apply from that component's directory. The downloadable tool is a local developer tool, not an isolation boundary for hostile multitenant execution.

The identical protected checks run before and after: accessible labels, keyboard task completion, linked live errors, error focus, valid submission payload, invalid email, short password, consent, axe findings in initial/invalid states, and browser runtime errors. A source and check-suite SHA-256 are saved. This verifies this contract, not complete accessibility. It does not exercise real screen reader output or a backend's validation. A changed product contract requires changing the protected tests deliberately, outside the model loop.

The second implementation, `examples/team/Signup.tsx`, uses an object-state pattern and already has working labels/keyboard controls. It exercises the validation/focus repair path. This small fixture set is a functional smoke evaluation, not evidence of general repair accuracy.
