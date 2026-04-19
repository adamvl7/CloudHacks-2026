# Nimbus demo walkthrough

A practiced 3-minute run that shows the carbon-aware loop flipping between green and dirty, AWS Batch scaling in response, and Bedrock narrating the impact.

## Pre-demo setup (once)

```bash
# 1. Deploy infrastructure
./scripts/deploy.sh --guided

# 2. Seed 24h of history so the dashboard looks alive
python scripts/seed_demo_data.py --history

# 3. Submit a queued test job (waits for green grid to run)
./scripts/submit_test_batch_job.sh

# 4. Generate a first Bedrock report for yesterday
aws lambda invoke --function-name ecoshift-reporter \
  --payload '{"manual":true}' response.json
```

Then open the dashboard URL printed by the deploy script. Leave it on-screen.

## Live demo (≈ 3 minutes)

**0:00 — Framing (15s).** "Data centres are 1–2% of global electricity, and growing. But grids aren't uniformly dirty — California at noon is 60% solar; at 2am it's mostly gas. Nimbus is a carbon-aware scheduler that shifts non-urgent compute to clean-energy windows automatically."

**0:15 — Show the dashboard (30s).** Gesture to the meter: "We're at 165 gCO₂/kWh. Green. Batch is running at 16 vCPUs. This timeline is the last 24 hours — you can see the midday solar dip and the evening peak when California fires up gas plants."

**0:45 — Flip to dirty (30s).**

```bash
python scripts/seed_demo_data.py --scenario=dirty
```

"I'm forcing the grid to look dirty." Wait ≤15 min for the next scheduler tick, or for the demo force a scheduler run:

```bash
aws lambda invoke --function-name ecoshift-scheduler \
  --payload '{}' /tmp/out.json && cat /tmp/out.json
```

Refresh the dashboard. Meter flips red, badge says "Dirty · paused". In AWS Batch console, compute env maxVcpus goes to 0. The queued job sits in RUNNABLE.

**1:15 — Flip back to green (30s).**

```bash
python scripts/seed_demo_data.py --scenario=green
aws lambda invoke --function-name ecoshift-scheduler --payload '{}' /tmp/out.json
```

Meter swings green. Compute env scales to 16. The queued job flips to RUNNING. "Same work, same deadline, but executed while the grid is clean."

**1:45 — Show the Bedrock report (45s).** Scroll to the summary card. "Bedrock turns raw metrics into an executive summary. This isn't dashboard-ware — a CFO or sustainability officer can read this and act on it." Read one sentence aloud, especially the real-world equivalent ("X miles not driven").

**2:30 — Close (30s).** "The pitch: ML training, ETL, video transcoding — any time-flexible workload on AWS Batch can carbon-shift with zero code changes from the teams submitting jobs. Extrapolated across an enterprise ML workload, tonnes of CO₂ per year, no productivity loss."

```bash
# After demo — restore normal operation
python scripts/seed_demo_data.py --clear
```

## Troubleshooting

- **Batch job won't start even when green:** `aws batch describe-compute-environments --compute-environments ecoshift-jobs-ce` — confirm `maxvCpus > 0` and `status: VALID`.
- **Dashboard API errors:** check `VITE_API_BASE_URL` in `frontend/dist/assets/*.js` (set by `deploy.sh`). If wrong, rerun `./scripts/deploy.sh`.
- **Bedrock returns AccessDeniedException:** request model access for Claude Sonnet 4.6 in the Bedrock console for the deployed region.
- **No SES email:** SES sandbox requires the recipient to be verified. Check the SES console for `ReportEmail`.
