# AccessFix demo — under three minutes

Show the working app and actual results. The presentation covers signup, login, confirmation dialog and navigation contracts; the demonstrated AI repair remains the one real recorded signup run. New contract candidates are clearly labeled prepared exercises. Inference is disabled for recording and on both judge deployments.

The recorded run `20059716-75ab-457d-a685-28d0d9671158` is an NVIDIA/Nebius candidate that passed strict TypeScript and all ten browser checks. Its original 10.472-second duration, one model request and 3,071 reported tokens are preserved. The earlier browser-only candidate that failed TypeScript is not valid repair evidence.

## Suggested sequence

| Segment | Show | Explain |
|---|---|---|
| Problem | Signup preview; Tab through controls | A complete-looking form can block a keyboard user. |
| Reproduction | Fresh audit and expanded findings | Six of ten baseline checks pass; the other checks expose barriers. |
| Real AI evidence | History → Recorded live AI repair; events and diff | NVIDIA Nemotron on Nebius Token Factory proposed this bounded patch. Viewing it now makes no model request. |
| Verification | Candidate checks and source diff | Strict TypeScript and the unchanged browser checks accepted the candidate at ten of ten. |
| Keyboard replay | Verification lab → Replay recorded repair → Keyboard replay | Fresh checks re-verify the unedited recorded candidate. Captured frames show observed focus before and after. |
| Regression rejection | Test a regression | The prepared candidate removes required consent and is rejected despite other improvements. |
| Broader contracts | Login, navigation and dialog fixtures; good dialog exercise | Each contract protects its own behavior. Prepared examples are not evidence of AI repair accuracy. |
| Developer review | Report download and local GitHub draft preview | The preview matches the GitHub file to the audited source. Creating a draft requires an explicit action and never merges it. |
| Judge access | Authenticated Mac-worker interface | Fresh browser checks run on the private Mac worker; inference and GitHub writes remain disabled. Render is the fallback. |
| Scope | Human-review notes and project links | One recorded AI success is not a general success rate. Screen-reader testing and real-user feedback remain necessary. |

## Recording and submission

Use English narration or English translations and readable captions. Keep the final video below three minutes. Log in before recording and exclude credentials, API keys and unrelated windows. If a wait is shortened, label it. A GitHub preview must not be presented as an already-created PR.

Open the Render service early to allow its free-instance cold start. For faster fresh browser evidence, use the [private Mac worker](judge-worker.md) while its tunnel and Mac are running. The temporary worker cannot guarantee availability throughout judging.

Keep the full run artifacts for judges. Do not invent customers, time savings, cost, broad accuracy or a deployed pilot. A public video URL and the project submission still need to be supplied through the hackathon's required channels; local video generation does not publish or submit an entry.
