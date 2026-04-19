"""Amazon Bedrock wrapper for narrative summaries — uses Converse API (works with Nova + Claude)."""
from __future__ import annotations

import json
import logging
import os

import boto3

log = logging.getLogger(__name__)
_bedrock = boto3.client("bedrock-runtime")

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")

PROMPT_TEMPLATE = """You are the sustainability officer for a cloud engineering team writing a demo-ready briefing on our carbon-aware batch scheduler, Nimbus.

Write a narrative summary in EXACTLY three short paragraphs, totaling roughly 200 to 300 words. Do not use markdown, bold, bullets, headings, emoji, or em dashes. Use commas, periods, or hyphens instead of em dashes.

Paragraph 1 - What this report covers. Explain that Nimbus watches grid carbon intensity for the selected AWS region and scales AWS Batch compute up when the grid is clean and down when it is dirty. State the region (use the region and region_name fields), the reporting window, and the total number of scheduling decisions evaluated.

Paragraph 2 - What happened. Use concrete numbers from the data: total decisions (ticks), scale_up vs scale_down counts, percentage of ticks that were clean (green_ticks / ticks), percentage saved from paused dirty windows (saved_pct), and the average, minimum, and maximum carbon intensity in gCO2 per kWh. Mention estimated gCO2 avoided and the real world equivalent phrase verbatim if present.

Paragraph 3 - Savings percentage and impact outlook. Do not mention money, dollars, USD, pricing, or cost savings. State saved_pct as the percentage saved. saved_pct means the share of dirty high-carbon windows where Nimbus paused flexible work, not the clean share. Close with one forward-looking sentence tying the metrics to environmental impact and why time-flexible compute at scale meaningfully reduces emissions.

DATA:
{metrics_json}
"""


def generate_summary(metrics: dict) -> str:
    prompt = PROMPT_TEMPLATE.format(metrics_json=json.dumps(metrics, indent=2, default=str))

    log.info("invoking bedrock model %s via Converse API", MODEL_ID)
    resp = _bedrock.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 1200, "temperature": 0.4},
    )
    return resp["output"]["message"]["content"][0]["text"].strip()
