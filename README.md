# 🌱 Nimbus Workload Scheduler

> **A carbon-aware serverless auto-scaler that slashes the Scope 2 emissions of cloud workloads by shifting compute to when the grid is green.**

**Hackathon:** AWS Cloud Hacks
**Track:** AI Environmental Impact
**Status:** 🚧 Hackathon build

---

## 📖 Table of Contents

1. [The Problem](#-the-problem)
2. [The Solution](#-the-solution)
3. [How It Works](#-how-it-works)
4. [Architecture](#-architecture)
5. [Tech Stack](#-tech-stack)
6. [Why These Choices?](#-why-these-choices)
7. [Repository Structure](#-repository-structure)
8. [Setup & Installation](#-setup--installation)
9. [Configuration](#-configuration)
10. [Running the Project](#-running-the-project)
11. [The GenAI Layer (Bedrock)](#-the-genai-layer-bedrock)
12. [Demo Script](#-demo-script)
13. [Measuring Impact](#-measuring-impact)
14. [Future Work](#-future-work)
15. [Team](#-team)

---

## 🌍 The Problem

Data centers are responsible for **~1–2% of global electricity consumption**, and that number is climbing fast thanks to the AI boom. Training a single large language model can emit as much CO₂ as **five cars over their entire lifetime**.

But here's the kicker: **not all electricity is equally dirty.** The carbon intensity of any electrical grid changes minute-by-minute depending on what power plants are online. At 2 PM on a sunny day in California, solar might provide 60% of the grid's power. At 2 AM, it might be 80% natural gas.

**Most cloud workloads don't care when they run.** Batch jobs, ML training runs, nightly ETL pipelines, video transcoding, data analytics — these are all "time-flexible." Yet they run continuously, blindly consuming dirty energy when they could just as easily wait a few hours for clean energy.

This is a massive, invisible source of avoidable carbon emissions.

---

## 💡 The Solution

**Nimbus** is a drop-in scheduler that makes any AWS Batch workload **carbon-aware**. It:

1. 🔍 **Monitors** the real-time carbon intensity of the AWS region's local power grid (via ElectricityMaps API).
2. ⚖️ **Decides** whether now is a "green" moment (low gCO₂/kWh) or a "dirty" moment (high gCO₂/kWh) using a configurable threshold.
3. 🔄 **Scales** AWS Batch compute environments up when green, down to zero when dirty — effectively pausing non-urgent workloads during fossil-fuel-heavy periods.
4. 📊 **Logs** every decision, energy consumed, and carbon emitted to DynamoDB.
5. 🤖 **Summarizes** the day's carbon and cost savings using Amazon Bedrock (Claude), generating a plain-English daily report emailed to stakeholders.

The result: the **same work gets done**, but with a dramatically smaller carbon footprint — no code changes required from the teams submitting jobs.

---

## ⚙️ How It Works

```
Every 15 minutes:
  ├── Fetch current carbon intensity for the AWS region's grid zone
  ├── Compare against the green/dirty threshold
  ├── If GREEN:
  │     └── Scale AWS Batch compute environment UP → jobs resume
  ├── If DIRTY:
  │     └── Scale AWS Batch compute environment DOWN to 0 → jobs pause
  └── Log decision + grid data to DynamoDB

End of day (cron at 23:55 UTC):
  ├── Aggregate the day's decisions from DynamoDB
  ├── Calculate: kWh consumed, gCO₂ emitted, gCO₂ avoided, $ saved
  ├── Send stats + context to Amazon Bedrock (Claude)
  ├── Bedrock generates a human-readable narrative report
  └── Report delivered to React dashboard + emailed via SES
```

---

## 🏗 Architecture

```
                         ┌─────────────────────────┐
                         │   ElectricityMaps API   │
                         │  (carbon intensity data) │
                         └───────────┬─────────────┘
                                     │
                                     ▼
┌──────────────────┐    ┌──────────────────────────┐    ┌──────────────────┐
│   EventBridge    │───▶│  Lambda: ecoshift-sched  │───▶│   AWS Batch      │
│ (cron: every 15m)│    │  (decision engine)       │    │ (compute env)    │
└──────────────────┘    └──────────┬───────────────┘    └──────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │     DynamoDB         │
                         │  (decision log +     │
                         │   daily metrics)     │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌──────────────────┐    ┌──────────────────────────┐    ┌──────────────────┐
│   EventBridge    │───▶│ Lambda: ecoshift-report  │───▶│ Amazon Bedrock   │
│ (cron: 23:55 UTC)│    │ (daily summary generator)│    │ (Claude Sonnet)  │
└──────────────────┘    └──────────┬───────────────┘    └────────┬─────────┘
                                   │                             │
                                   ▼                             ▼
                         ┌──────────────────┐          ┌──────────────────┐
                         │      SES         │          │        S3        │
                         │  (email report)  │          │ (report archive) │
                         └──────────────────┘          └────────┬─────────┘
                                                                │
                                                                ▼
                                                    ┌──────────────────────┐
                                                    │  React Dashboard     │
                                                    │ (CloudFront + S3)    │
                                                    │ - Live grid meter    │
                                                    │ - Decision timeline  │
                                                    │ - Bedrock summaries  │
                                                    └──────────────────────┘

                        All monitored by ─▶ CloudWatch Logs + Metrics
```

---

## 🧰 Tech Stack

| Layer | Service | Purpose |
|---|---|---|
| **Compute (target)** | **AWS Batch** | The workload being scaled |
| **Scheduling** | **EventBridge Scheduler** | Triggers the decision Lambda every 15 min |
| **Logic** | **Lambda** (Python 3.12) | Decision engine + report generator |
| **Storage** | **DynamoDB** | Time-series log of decisions + daily aggregates |
| **GenAI** | **Amazon Bedrock** (Claude Sonnet 4) | Daily narrative summaries |
| **Email** | **Amazon SES** | Sends daily reports to stakeholders |
| **Archival** | **S3** | Stores historical reports |
| **Observability** | **CloudWatch** | Logs, metrics, alarms |
| **Security** | **IAM + Secrets Manager** | Least-privilege roles; ElectricityMaps API key |
| **IaC** | **AWS SAM** (or Terraform) | Infrastructure-as-code |
| **Frontend** | **React + Vite + Recharts** | Dashboard, hosted on S3 + CloudFront |
| **External API** | **ElectricityMaps** | Real-time grid carbon intensity |

---

## 🤔 Why These Choices?

### Why AWS Batch as the compute target?

I considered four options: **EC2 Auto Scaling Groups, ECS/Fargate, AWS Batch, and Lambda throttling.** AWS Batch wins decisively for this project, here's why:

1. **Purpose-built for time-flexible workloads.** Batch is explicitly designed for jobs that *don't need to run instantly* — exactly the workloads where carbon-shifting makes sense. Interactive services (web apps, APIs) can't be paused mid-request. Batch jobs can.
2. **Native job queuing.** When Nimbus scales the compute environment to zero, Batch doesn't lose work — it *queues* jobs and dispatches them the moment capacity returns. This means "pausing dirty-hour work" is a natural primitive, not a hack.
3. **Real hackathon-sellable narrative.** Batch is how ML training, scientific simulations, genomics, and financial risk modelling actually run on AWS. Judges will immediately recognize this as a real industry use case.
4. **Clean scaling API.** `update-compute-environment` with a new `desiredvCpus` is a single idempotent API call. Much simpler than wrangling ASG cooldowns or ECS service deployments.
5. **ECS/Fargate would be overkill.** Those are for long-running services, not time-flexible jobs.
6. **Lambda throttling doesn't fit.** Lambdas are already millisecond-scoped; there's nothing meaningful to "shift."

### Why ElectricityMaps over WattTime?

Better free-tier coverage, cleaner JSON responses, and their `/carbon-intensity/latest` endpoint returns gCO₂eq/kWh directly — no conversions needed. For a 24-hour hackathon build, speed to first working call matters.

### Why Bedrock (Claude Sonnet 4)?

The daily report isn't just numbers — it needs to *explain* the impact in a way a non-technical stakeholder (a CFO, a sustainability officer) can act on. Claude is genuinely good at turning a JSON blob of metrics into a 3-paragraph narrative with context ("this is equivalent to taking 4 cars off the road for a day"). Staying in Bedrock keeps everything in one AWS trust boundary.

### Why DynamoDB over RDS?

Our data is append-only time-series with a single access pattern (query by date range). DynamoDB is free-tier generous, has zero cold-start, and pairs perfectly with Lambda. An RDS instance would be overkill and cost money to keep running.

### Why EventBridge Scheduler over CloudWatch Events?

Newer, supports timezones natively (critical for "end of day" logic), and has a cleaner API. No reason to pick the legacy option.

---

## 📁 Repository Structure

```
nimbus/
├── README.md
├── template.yaml                      ← AWS SAM infrastructure definition
├── samconfig.toml                     ← SAM deploy config
│
├── lambdas/
│   ├── scheduler/
│   │   ├── handler.py                 ← decision engine (runs every 15 min)
│   │   ├── carbon_client.py           ← ElectricityMaps API wrapper
│   │   ├── batch_controller.py        ← AWS Batch scaling logic
│   │   └── requirements.txt
│   │
│   └── reporter/
│       ├── handler.py                 ← daily summary generator
│       ├── bedrock_client.py          ← Bedrock invocation + prompt
│       ├── metrics.py                 ← aggregation + carbon math
│       └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── GridMeter.jsx          ← live carbon intensity gauge
│   │   │   ├── DecisionTimeline.jsx   ← scale-up/down history chart
│   │   │   ├── SavingsCard.jsx        ← headline numbers
│   │   │   └── DailySummary.jsx       ← Bedrock narrative display
│   │   └── api/nimbusClient.js        ← calls API Gateway endpoints
│   ├── package.json
│   └── vite.config.js
│
├── scripts/
│   ├── deploy.sh                      ← one-shot deploy
│   ├── seed_demo_data.py              ← populates DynamoDB for demo
│   └── submit_test_batch_job.sh
│
└── docs/
    ├── architecture.png
    └── demo-walkthrough.md
```

---

## 🚀 Setup & Installation

### Prerequisites

- AWS account with Bedrock access enabled (request access to Claude Sonnet 4 in the Bedrock console)
- AWS CLI v2 configured
- AWS SAM CLI
- Node.js 20+ and Python 3.12+
- An ElectricityMaps API key (free tier at [electricitymaps.com/api](https://www.electricitymaps.com/api))

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/nimbus.git
cd nimbus

# Install Lambda dependencies
pip install -r lambdas/scheduler/requirements.txt -t lambdas/scheduler/
pip install -r lambdas/reporter/requirements.txt -t lambdas/reporter/

# Install frontend
cd frontend && npm install && cd ..
```

### 2. Store the ElectricityMaps API key

```bash
aws secretsmanager create-secret \
  --name ecoshift/electricitymaps-api-key \
  --secret-string "your-api-key-here"
```

### 3. Deploy infrastructure

```bash
sam build
sam deploy --guided
```

You'll be prompted for:
- Stack name (`ecoshift`)
- AWS region (pick one that matches a grid zone you care about)
- Notification email (for SES daily reports)
- Grid zone (e.g. `US-CAL-CISO` for California)
- Green threshold in gCO₂/kWh (default: `250`)

### 4. Deploy the frontend

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<your-dashboard-bucket>/
```

---

## ⚙️ Configuration

Configuration is managed via SAM parameters (set at deploy time) and Lambda environment variables:

| Variable | Example | Description |
|---|---|---|
| `GRID_ZONE` | `US-CAL-CISO` | ElectricityMaps zone code for the region |
| `GREEN_THRESHOLD_GCO2` | `250` | Below this = green, above = dirty |
| `BATCH_COMPUTE_ENV` | `ecoshift-jobs-ce` | Name of the Batch compute env to control |
| `MAX_VCPUS_GREEN` | `256` | vCPUs to provision when grid is green |
| `MAX_VCPUS_DIRTY` | `0` | vCPUs when grid is dirty (0 = full pause) |
| `DYNAMO_TABLE` | `ecoshift-decisions` | DynamoDB table name |
| `BEDROCK_MODEL_ID` | `anthropic.claude-sonnet-4` | Model for daily summaries |
| `REPORT_EMAIL` | `sustainability@example.com` | Daily report recipient |

---

## ▶️ Running the Project

Once deployed, Nimbus runs autonomously. To exercise it:

### Submit a test batch job

```bash
./scripts/submit_test_batch_job.sh
```

This queues a job that will execute *only when Nimbus has scaled the compute env up* — i.e., only during green grid periods.

### View the dashboard

Open the CloudFront URL printed by SAM. You'll see:
- **Live grid meter** — current gCO₂/kWh for your zone
- **Region dropdown** — preview live grid conditions for `us-east-1`, `us-east-2`, `us-west-2`, or `us-west-1` without changing the deployed scheduler
- **Current state** — GREEN (scaled up) or DIRTY (scaled down)
- **Decision timeline** — last 24h of scaling events overlaid on carbon intensity
- **Savings card** — cumulative gCO₂ avoided, $ saved
- **Latest Bedrock summary** — yesterday's narrative report

The dashboard region selector is read-only. It changes the live ElectricityMaps widgets and recommended threshold shown on the dashboard, but it does not move workloads, redeploy AWS resources, or rewrite historical scheduler decisions.

| AWS region | ElectricityMaps zone | Recommended threshold |
|---|---|---|
| `us-east-1` (N. Virginia) | `US-MIDA-PJM` | `350 gCO2/kWh` |
| `us-east-2` (Ohio) | `US-MIDW-MISO` | `380 gCO2/kWh` |
| `us-west-2` (Oregon) | `US-NW-BPAT` | `120 gCO2/kWh` |
| `us-west-1` (N. California) | `US-CAL-CISO` | `200 gCO2/kWh` |

### Trigger a manual daily report (for demo)

```bash
aws lambda invoke \
  --function-name ecoshift-reporter \
  --payload '{"manual": true}' \
  response.json
```

---

## 🤖 The GenAI Layer (Bedrock)

The reporter Lambda assembles the day's metrics and sends them to Claude Sonnet 4 via Bedrock with a prompt like:

```
You are the sustainability officer for a cloud engineering team.
Given the following carbon-aware scheduling data for today, write a
3-paragraph executive summary covering:

1. What we did (jobs run, hours shifted, scale-up/down count)
2. Environmental impact (gCO₂ avoided, real-world equivalents)
3. Cost impact and tomorrow's outlook

Be specific with numbers. Be warm but professional. No emoji.

DATA:
{metrics_json}
```

**Why this is valuable and not just a gimmick:** the raw metrics (e.g. `{avoided_gco2: 18400, paused_hours: 9.25}`) are meaningless to a non-technical audience. The Bedrock layer turns "18,400 grams CO₂ avoided" into "*equivalent to not driving 47 miles in an average gasoline car*" — which is what makes the sustainability impact *land* with decision-makers. That translation is where the real product value lives.

---

## 🎬 Demo Script

For the 3-minute pitch:

1. **Open the dashboard** — show the live grid meter pulsing at, say, 180 gCO₂/kWh. State: "We're GREEN. Jobs are running."
2. **Simulate a grid shift** — run `scripts/seed_demo_data.py --scenario=dirty` which injects a high-intensity data point. The dashboard flips to DIRTY within one refresh cycle; the decision log shows a scale-down event.
3. **Show AWS Batch console** — compute env desired vCPUs has dropped to 0. Queued jobs are waiting.
4. **Flip it back** — run `--scenario=green`. Watch the compute env scale back up and queued jobs start executing.
5. **Show the Bedrock report** — trigger the reporter Lambda live. Read the generated summary aloud.
6. **Close on the savings card** — "In 24 hours of demo traffic, we avoided X grams of CO₂. Extrapolated across a typical enterprise ML workload, that's Y tonnes per year."

---

## 📏 Measuring Impact

The carbon math used throughout:

```
energy_kwh = vcpu_hours × avg_watts_per_vcpu / 1000
gco2_actual = energy_kwh × current_grid_intensity_gco2_per_kwh
gco2_counterfactual = energy_kwh × 24h_avg_grid_intensity
gco2_avoided = gco2_counterfactual - gco2_actual
```

`avg_watts_per_vcpu` is set to **8W** by default, based on published AWS sustainability disclosures for general-purpose compute. Configurable per instance type.

The key insight: **Nimbus doesn't reduce total energy use — it shifts *when* that energy is consumed to moments when the grid is already greener.** The counterfactual is "what would have happened if we ran the same jobs on a flat 24h schedule."

---

## 🔮 Future Work

- **Multi-region shifting.** Instead of only shifting in *time*, also shift in *space* — route jobs to whichever AWS region currently has the cleanest grid.
- **Per-job SLA awareness.** Let users tag jobs with deadlines; Nimbus respects the deadline while still optimizing for clean energy windows.
- **Forecast-based scheduling.** ElectricityMaps offers 24h forecasts — use them to pre-position work rather than react reactively.
- **Cost–carbon Pareto optimization.** Sometimes spot pricing and clean energy windows don't align; let users weight the tradeoff.
- **Integration with Amazon SageMaker training jobs.** Native hook for ML training workloads specifically.

---

## 👥 Team

| Name | GitHub |
|------|--------|
| Adam Le | [@adamvl7](https://github.com/adamvl7) |
| Kevin Chhim | [@kevinlycc](https://github.com/kevinlycc) |
| Ryan Ong | [@riannongg](https://github.com/riannongg) |
| Samanyu Warhade | [@samanyuw](https://github.com/samanyuw) |

---

## 📄 License

MIT — see `LICENSE` for details.

---

**Built with ☁️ and 🌱 for AWS Cloud Hacks 2026.**
