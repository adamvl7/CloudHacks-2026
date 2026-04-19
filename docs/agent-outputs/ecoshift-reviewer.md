# ecoshift-reviewer — verdict

## Contract match

- [x] `POST /chat` — frontend `postChat` sends `{ question, hours }` (ecoshiftClient.js:37) and reads `{ answer, grounding:{ decisions_used, zone } }`. Backend handler returns exactly that envelope (chat/handler.py:202-208), validates question (400) and clamps hours 1–168. MATCH.
- [x] `GET /forecast` — backend returns `{ zone, threshold, forecast:[{ datetime, carbonIntensity }] }` (api/handler.py:67-77). Consumer `ForecastStrip` reads `data.threshold`, `data.forecast[].datetime`, `.carbonIntensity` (ForecastStrip.jsx:25-27, 52-57). MATCH.
- [x] `GET /region-compare` — backend returns `{ current_zone, regions:[{ zone, carbonIntensity, label }] }` (api/handler.py:80-96). `RegionCompareBanner` keys off `data.current_zone`, `regions[].zone`, `.carbonIntensity`, `.label` (RegionCompareBanner.jsx:5-25). MATCH.

## Routes in template.yaml

- [x] `POST /chat` on ChatFunction via DashboardApi (template.yaml:389-395).
- [x] `GET /forecast` (template.yaml:355-360), `GET /region-compare` (template.yaml:361-366) on ApiFunction.
- [x] `DashboardApi.AllowMethods: [GET, POST, OPTIONS]` (template.yaml:402).

## Frontend build

- [x] `npm run build` in `frontend/` exited 0 (vite 5.4.21, 1050 modules, `dist/` written). Only stock "chunk > 500 kB" warning; non-blocking.

## Lambda compile

- [x] `python -m py_compile lambdas/chat/handler.py` → OK.
- [x] `python -m py_compile lambdas/api/handler.py` → OK.

## IAM sanity

- [x] ChatFunction: `DynamoDBReadPolicy` scoped to `DecisionsTable`; `bedrock:InvokeModel` pinned to `arn:aws:bedrock:${Region}::foundation-model/${BedrockModelId}` (template.yaml:383-388). No wildcard actions, no secrets inlined — env vars only reference SAM params / table ref.
- Note (pre-existing, not this run): SchedulerFunction still uses `Resource: '*'` for batch:UpdateComputeEnvironment (template.yaml:266) and ReporterFunction uses `Resource: '*'` for `ses:SendEmail` (template.yaml:302). Out of scope for this diff.

## Percentage math derived

- [x] SavingsCard.jsx:35 `pctCheaper = (usdSaved / counterfactualUsd) * 100`, line 36 `pctCleaner = gco2Avoided / gco2Counterfactual * 100`. Both computed from `decisions[]` via vCPU·hours × 8 W × $0.14/kWh and intensity; no hard-coded percentage literals. Renders `—` on missing inputs (SavingsCard.jsx:8-10).

## Verdict

SHIP IT
