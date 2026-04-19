"""Amazon Bedrock wrapper for daily narrative summaries."""
from __future__ import annotations

import json
import logging
import os

import boto3

log = logging.getLogger(__name__)
_bedrock = boto3.client("bedrock-runtime")

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")

PROMPT_TEMPLATE = """You are the sustainability officer for a cloud engineering team.
Given the following carbon-aware scheduling data, write a clear report in 2 or 3 short paragraphs covering:

1. What we did (jobs run, hours shifted, scale-up/down count)
2. Environmental impact (gCO2 avoided, real-world equivalents)
3. Cost impact and tomorrow's outlook

Be specific with numbers. Be warm but professional. Use plain language for non-technical judges.
Do not use markdown, bold text, bullet points, emoji, or em dashes. Use commas, periods, or hyphens instead of em dashes.

DATA:
{metrics_json}
"""


def generate_summary(metrics: dict) -> str:
    prompt = PROMPT_TEMPLATE.format(metrics_json=json.dumps(metrics, indent=2, default=str))

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 900,
        "temperature": 0.4,
        "messages": [{"role": "user", "content": prompt}],
    }

    log.info("invoking bedrock model %s", MODEL_ID)
    resp = _bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )
    payload = json.loads(resp["body"].read())
    # Claude messages API returns content as a list of blocks.
    parts = [b.get("text", "") for b in payload.get("content", []) if b.get("type") == "text"]
    return "\n".join(parts).strip()
