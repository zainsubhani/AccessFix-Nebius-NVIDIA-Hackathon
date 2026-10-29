# AccessFix demo — target 2 minutes 45 seconds

Use the working app and actual saved results. Configure Nebius and verify the chosen model before recording. Do not present a prepared verification-lab patch as an AI-generated repair.

The recorded run `20059716-75ab-457d-a685-28d0d9671158` is a real NVIDIA/Nebius candidate that passed strict TypeScript and all ten browser checks. It can be shown from local history without another inference request; clearly label playback as a saved run. Its 10.472-second duration and one-request token usage are recorded in the verification guide. The preceding browser-only accepted run failed TypeScript during review and should not be presented as a valid repair.

| Time | Show | Explain |
|---|---|---|
| 0:00–0:20 | React signup preview; Tab through controls | A form can look finished while blocking someone using a keyboard. |
| 0:20–0:45 | Run audit; expand keyboard and label results | The runner reproduces a task and records the original validation behavior. |
| 0:45–1:20 | Repair with Nemotron; live run events | NVIDIA Nemotron on Nebius receives this component and observed failures. It can propose a bounded patch or abstain. |
| 1:20–1:50 | Before/candidate checks and source diff | The unchanged tests judge the candidate. Show real outcome, tokens and latency. If unresolved, explain why. |
| 1:50–2:15 | Saved regression-lab run | This explicitly prepared bad candidate improves accessibility but removes consent. The gate rejects it. |
| 2:15–2:35 | Export report, patch, second fixture, CLI command | Developers get reviewable artifacts and a narrowly documented local tool. |
| 2:35–2:45 | Human-review notes | Automated evidence covers this journey; screen reader testing and real user feedback remain necessary. |

If inference is slow, cut the recording between initiation and the actual recorded result; disclose elapsed time. Do not invent time saved, accuracy, customers, cost or a deployed pilot. Keep the full run artifacts for judges. Use the hackathon's required submission format and a video under three minutes.
