"""EcoShift reporter Lambda — runs daily at 23:55 UTC.

Aggregates the day's decisions, computes carbon metrics, asks Bedrock to narrate,
archives to S3, writes back to DynamoDB, and emails via SES.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from bedrock_client import generate_summary
from metrics import compute_daily, to_dict

log = logging.getLogger()
log.setLevel(logging.INFO)

DYNAMO_TABLE = os.environ["DYNAMO_TABLE"]
REPORTS_BUCKET = os.environ["REPORTS_BUCKET"]
REPORT_EMAIL = os.environ.get("REPORT_EMAIL", "")

_ddb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_ses = boto3.client("ses")


def _fetch_decisions(date_str: str) -> list[dict]:
    table = _ddb.Table(DYNAMO_TABLE)
    resp = table.query(KeyConditionExpression=Key("pk").eq(f"decision#{date_str}"))
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.query(
            KeyConditionExpression=Key("pk").eq(f"decision#{date_str}"),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        items.extend(resp.get("Items", []))
    return items


def _store_summary(date_str: str, metrics: dict, narrative: str) -> None:
    table = _ddb.Table(DYNAMO_TABLE)
    table.put_item(Item={
        "pk": "summary",
        "sk": date_str,
        "date": date_str,
        "metrics": json.loads(json.dumps(metrics), parse_float=Decimal),
        "narrative": narrative,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


def _archive_to_s3(date_str: str, metrics: dict, narrative: str) -> str:
    key = f"reports/{date_str}.json"
    body = json.dumps({"date": date_str, "metrics": metrics, "narrative": narrative}, indent=2, default=str)
    _s3.put_object(Bucket=REPORTS_BUCKET, Key=key, Body=body, ContentType="application/json")
    return f"s3://{REPORTS_BUCKET}/{key}"


def _send_email(date_str: str, metrics: dict, narrative: str) -> None:
    if not REPORT_EMAIL:
        log.warning("REPORT_EMAIL not set; skipping email")
        return

    subject = f"EcoShift daily report — {date_str}"
    text_body = (
        f"EcoShift sustainability report for {date_str}\n"
        f"{'=' * 60}\n\n"
        f"{narrative}\n\n"
        f"Headline numbers:\n"
        f"  - gCO2 avoided:        {metrics['gco2_avoided']:,.0f}\n"
        f"  - Equivalent:          {metrics['real_world_equivalent']}\n"
        f"  - Average intensity:   {metrics['avg_intensity_gco2_per_kwh']} gCO2/kWh\n"
        f"  - Green / dirty ticks: {metrics['green_ticks']} / {metrics['dirty_ticks']}\n"
        f"  - Scale events:        up={metrics['scale_up_events']}  down={metrics['scale_down_events']}\n"
    )
    try:
        _ses.send_email(
            Source=REPORT_EMAIL,
            Destination={"ToAddresses": [REPORT_EMAIL]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": text_body}},
            },
        )
        log.info("sent SES report to %s", REPORT_EMAIL)
    except Exception as e:
        log.error("SES send failed: %s", e)


def lambda_handler(event, context):
    manual = bool(event.get("manual")) if isinstance(event, dict) else False
    now = datetime.now(timezone.utc)
    # Scheduled at 23:55 UTC -> summarize today. Manual invoke -> yesterday is more useful.
    target_date = (now - timedelta(days=1 if manual else 0)).strftime("%Y-%m-%d")

    decisions = [
        {k: (float(v) if isinstance(v, Decimal) else v) for k, v in d.items()}
        for d in _fetch_decisions(target_date)
    ]
    log.info("found %d decisions for %s", len(decisions), target_date)

    metrics = to_dict(compute_daily(decisions, target_date))
    narrative = generate_summary(metrics) if decisions else (
        "No EcoShift scheduling activity was recorded for this date."
    )

    s3_uri = _archive_to_s3(target_date, metrics, narrative)
    _store_summary(target_date, metrics, narrative)
    _send_email(target_date, metrics, narrative)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "date": target_date,
            "decisions_processed": len(decisions),
            "metrics": metrics,
            "narrative": narrative,
            "archive": s3_uri,
        }, default=str),
    }
