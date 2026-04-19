# nimbus-backend summary

## Files changed
- `lambdas/chat/handler.py` (new) — Bedrock-grounded Q&A Lambda
- `lambdas/chat/requirements.txt` (new) — `boto3>=1.34.0`
- `lambdas/api/handler.py` — added `/forecast` and `/region-compare` branches + `_em_get` helper + `REGION_PRESET`
- `template.yaml` — added `ChatFunction` resource, `POST /chat` route, `GetForecast` + `GetRegionCompare` events on `ApiFunction`; extended `DashboardApi` CORS to allow `POST`

## New API routes

- `POST /chat` (ChatFunction)
  - Request: `{ "question": string, "hours": int }` (hours defaults to 24, clamped 1–168)
  - Response: `{ "answer": string, "grounding": { "decisions_used": int, "zone": string } }`
  - Decline / error responses still use the same envelope with `answer` holding an apology string; HTTP 400 on missing question, 500 on Bedrock failure.

- `GET /forecast` (ApiFunction)
  - Response: `{ "zone": string, "threshold": number, "forecast": [ { "datetime": iso-str, "carbonIntensity": number } ] }` (max 24 entries)

- `GET /region-compare` (ApiFunction)
  - Response: `{ "current_zone": string, "regions": [ { "zone": string, "carbonIntensity": number, "label": string } ] }`
  - Individual upstream failures are skipped; partial results are returned.

## New env vars / IAM in `template.yaml`

ChatFunction env vars: `DYNAMO_TABLE`, `GRID_ZONE`, `GREEN_THRESHOLD_GCO2`, `BEDROCK_MODEL_ID`.
ChatFunction IAM: `DynamoDBReadPolicy` on `DecisionsTable` + explicit `bedrock:InvokeModel` on `arn:aws:bedrock:${Region}::foundation-model/${BedrockModelId}` (mirrors ReporterFunction).
ApiFunction: no new IAM — existing `secretsmanager:GetSecretValue` on the ElectricityMaps secret already covers forecast/region-compare.
CORS: `DashboardApi.AllowMethods` now `[GET, POST, OPTIONS]`.

## Validation

- `python -m py_compile` — not runnable in this session (bash denied by sandbox). Files were re-read after edits and reviewed manually; syntax is clean Python 3.12, consistent with the existing api/reporter handlers.
- `sam validate --lint` — could not be executed (bash denied). Template change is additive and mirrors the existing ReporterFunction / ApiFunction patterns.

## Frontend notes

- New `POST /chat` is live on the same `DashboardApi` base URL; include `Content-Type: application/json`. Expect `grounding.decisions_used == 0` before the seeder has populated DynamoDB — the assistant will say so.
- `/forecast` and `/region-compare` are plain GETs with the shapes above; safe to call from the existing axios client.
- ChatFunction uses the same Bedrock model id as the reporter (`BedrockModelId` SAM param, default `anthropic.claude-sonnet-4-6`).
