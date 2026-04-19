# EcoShift Workload Scheduler

Carbon-aware serverless auto-scaler for AWS Batch. Cloud Hacks 2026 — AI Environmental Impact track.

## Module map

| Path | Owner | Purpose |
|---|---|---|
| `lambdas/scheduler/` | ecoshift-backend | Decision engine (every 15 min). ElectricityMaps → Batch scale up/down. |
| `lambdas/reporter/`  | ecoshift-backend | Daily Bedrock narrative + SES email. |
| `lambdas/api/`       | ecoshift-backend | Read-only HTTP API behind API Gateway. |
| `frontend/src/`      | ecoshift-frontend | React + Vite dashboard. |
| `frontend/src/components/` | ecoshift-frontend | GridMeter, SavingsCard, DecisionTimeline, PowerBreakdown, DailySummary. |
| `frontend/src/api/ecoshiftClient.js` | ecoshift-frontend | Axios client for `/current`, `/decisions`, `/summary/latest`, `/power-breakdown`. |
| `template.yaml`      | ecoshift-backend | AWS SAM infrastructure (Lambda, DynamoDB, API GW, IAM). |
| `scripts/`           | shared | Demo seed + deploy helpers. |

## DynamoDB schema

Single table (`DYNAMO_TABLE`), composite key:

- `pk = "decision#YYYY-MM-DD"`, `sk = <iso timestamp>` → per-tick decision record.
  Fields: `action` (`scale_up`/`scale_down`), `carbon_intensity`, `batch_target_vcpus`, `zone`, `source`, `threshold`.
- `pk = "summary"`, `sk = <iso date>` → daily Bedrock summary + aggregated metrics.

## Verification commands

| Check | Command | Cwd |
|---|---|---|
| Frontend build | `npm run build` | `frontend/` |
| Frontend dev   | `npm run dev`   | `frontend/` |
| Lambda syntax  | `python -m py_compile <file>` | `lambdas/<svc>/` |
| SAM validate   | `sam validate --lint` | repo root |

No test suite yet — verify by building the frontend and py_compiling touched Lambdas.

## Coordination rules

- Every specialist writes a short completion summary to `docs/agent-outputs/<agent-name>.md` (overwrite each run).
- Never edit files outside your owned path without posting the intent to your summary first.
- Don't touch `template.yaml` without the backend agent — IAM and env-var wiring must stay coherent.
- Don't invent API endpoints on the frontend — coordinate with backend so the Lambda route + SAM route exist.
- Keep hackathon pace: prefer the smallest working change, no speculative abstractions.
- Dollar math must be derived (not hard-coded). Use grid intensity + vCPU-hours as inputs; present as percentages, not absolute dollars, unless asked.

## Boundaries

- **ecoshift-frontend**: `frontend/**` only.
- **ecoshift-backend**: `lambdas/**`, `template.yaml`, `samconfig.toml`, `scripts/**`.
- **ecoshift-reviewer**: read-only across the repo; runs the verification commands; posts findings to `docs/agent-outputs/ecoshift-reviewer.md`.

## Demo-first mindset

This is a hackathon. Every feature must survive a 3-minute demo on a projector. Favor visible, legible UI changes and narrative-worthy metrics over correctness-in-the-tails.
