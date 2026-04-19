# nimbus-backend summary

## Files changed
- `lambdas/reporter/bedrock_client.py` - new 3-paragraph, 200-300 word prompt; default model = `anthropic.claude-sonnet-4-5-20250929-v1:0` via `BEDROCK_MODEL_ID`.
- `lambdas/reporter/metrics.py` - added `money_saved` to `DailyMetrics`. Formula: `scale_up_count * (0.5/60) * MAX_VCPUS_GREEN * 0.04048 * 0.30`, rounded to 2dp.
- `lambdas/reporter/handler.py` - `_store_summary` now always writes `pk = "summary#<region>"`, `sk = <iso timestamp>`, defaulting to `REGION` / `AWS_REGION` / `us-west-2`.
- `lambdas/api/handler.py` - new `GET /summaries` endpoint. `get_latest_summary` now scans all per-region pks plus legacy `"summary"` pk (back-compat), so Overview page keeps working.
- `template.yaml` - `BedrockModelId` default changed to `anthropic.claude-sonnet-4-5-20250929-v1:0`. Reporter IAM: dropped `aws-marketplace:*`; Bedrock `Resource` now uses foundation-model ARNs plus an inference-profile line and a `anthropic.claude-*` wildcard. Added `REGION: !Ref AWS::Region` env. Reporter schedule is now `rate(10 minutes)` (`EveryTenMinutes`). New `GetSummaries` HttpApi event wired to `/summaries`.
- `samconfig.toml` - `BedrockModelId` override updated to the same direct model ID.

## Bedrock AccessDeniedException fix
Picked Option A (model switch). Changed from inference-profile ID `global.anthropic.claude-sonnet-4-6` to the direct foundation model `anthropic.claude-sonnet-4-5-20250929-v1:0`, which does not require an AWS Marketplace subscription. IAM simplified (`aws-marketplace:*` removed).

## New / changed API contract
- `GET /summaries?limit=20` -> `{ "summaries": [ { region, date, timestamp, narrative, metrics } ] }` desc by timestamp, default 20, max 100.
- `GET /summary/latest` shape unchanged; also reads per-region pks with legacy fallback.

## DynamoDB key shape
- Summaries: `pk = "summary#<aws-region>"`, `sk = <iso generated_at>`. Fields: `date, report_type, window_start, window_end, metrics, narrative, archive, generated_at, region[, region_name, zone, threshold]`.
- Decisions: unchanged.

## Narrative
Prompt targets exactly three paragraphs totaling ~200-300 words, referencing region/region_name, ticks, scale_up vs scale_down, clean %, avg/min/max intensity, `money_saved` (as USD), and a closing forward-looking impact sentence.

## Env vars / IAM
- Reporter env: `REGION` (set from `AWS::Region`).
- Reporter IAM Bedrock resources: `foundation-model/${BedrockModelId}` (specific and `*` region variants), `inference-profile/${BedrockModelId}` (fallback), and `foundation-model/anthropic.claude-*` (fallback for alternate Claude models).

## Validation
- `python -m py_compile` and `sam validate --lint` / `sam build` / `sam deploy` were blocked in this session (Bash permission denied by the sandbox). Files were re-read after edits and are syntactically consistent. Please run locally:
  - `python -m py_compile lambdas/reporter/handler.py lambdas/reporter/bedrock_client.py lambdas/reporter/metrics.py lambdas/api/handler.py`
  - `sam validate --lint`
  - `"/c/Program Files/Amazon/AWSSAMCLI/bin/sam.cmd" build && sam deploy`
  - Tail `/aws/lambda/ecoshift-reporter` to confirm Bedrock now succeeds and a `summary#us-west-2` item appears in DynamoDB.

## Frontend notes
- New endpoint `/summaries` is available for a reports-history view.
- `/summary/latest` unchanged; still returns the most recent summary.
- Each summary exposes `metrics.money_saved` (USD float) for the SavingsCard.
