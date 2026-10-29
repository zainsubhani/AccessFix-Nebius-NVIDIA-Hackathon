# Nebius and NVIDIA integration feedback

## Observed integration

FirstStep calls `nvidia/nemotron-3-super-120b-a12b` through the OpenAI-compatible Nebius Token Factory chat-completions endpoint. The first live request on 29 October 2026 returned HTTP 200 in 1,581 ms with 406 prompt tokens and 179 completion tokens. The response provided a relevant comparison between zero-total and paid checkout rules. One request is insufficient to assess reliability or teaching effectiveness.

## What worked

The standard HTTP interface fit the existing Node server without a provider SDK. The model catalog exposed an exact model ID, and usage fields let the demo record input/output token counts. This kept the execution tests independent of model-generated advice.

## Friction and suggestions

FirstStep needed durable request reservations outside the free hosting filesystem to avoid resetting its spending allowance on restart. A clearly documented, enforceable project/key spending ceiling would simplify this setup. Better examples distinguishing reasoning-token budgets from visible answer length would also help builders deliver short educational hints predictably.

## NVIDIA model feedback

Nemotron produced a focused debugging hint using public scenario facts. Its output remains advisory: it does not receive learner code, execute tests, award a score or certify competence. We would next evaluate a fixed set of novice questions for correctness, solution leakage and usefulness with consented learners.
