"""EcoShift reporter Lambda.

Scheduled reports run at 00:00 UTC and summarize the previous full UTC day.
Manual dashboard reports summarize the rolling previous 24 hours.
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
ROLLING_REPORT_HOURS = 24

_ddb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_ses = boto3.client("ses")


def _fallback_narrative(metrics: dict, error: Exception | None = None) -> str:
    suffix = ""
    if error:
        suffix = (
            "\n\nClaude narrative generation was unavailable for this run, so EcoShift "
            "published this deterministic report from the same DynamoDB metrics. "
            f"Reporter detail: {type(error).__name__}."
        )
    return (
        f"EcoShift processed {metrics['ticks']} scheduler ticks for {metrics['date']}. "
        f"The scheduler ran work during {metrics['green_ticks']} green ticks and paused "
        f"during {metrics['dirty_ticks']} dirty ticks, with {metrics['scale_up_events']} "
        f"scale-up events and {metrics['scale_down_events']} scale-down events.\n\n"
        f"The observed grid intensity averaged {metrics['avg_intensity_gco2_per_kwh']} "
        f"gCO2/kWh, ranging from {metrics['min_intensity_gco2_per_kwh']} to "
        f"{metrics['max_intensity_gco2_per_kwh']} gCO2/kWh. EcoShift ran "
        f"{metrics['vcpu_hours_run']} vCPU-hours and deferred {metrics['vcpu_hours_paused']} "
        f"vCPU-hours, avoiding an estimated {metrics['gco2_avoided']} gCO2. "
        f"That is {metrics['real_world_equivalent']}.\n\n"
        f"Estimated avoided compute-window cost exposure was ${metrics['est_usd_saved']:.2f}. "
        "The practical takeaway: time-flexible Batch work stayed aligned with cleaner grid "
        "windows while preserving the queue for the next green period."
        f"{suffix}"
    )


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=str),
    }


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


def _dates_between(start: datetime, end: datetime) -> list[str]:
    current = start.date()
    last = end.date()
    dates = []
    while current <= last:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def _fetch_decisions_window(window_start: datetime, window_end: datetime) -> list[dict]:
    start_iso = window_start.isoformat()
    end_iso = window_end.isoformat()
    items: list[dict] = []
    for date_str in _dates_between(window_start, window_end):
        items.extend(_fetch_decisions(date_str))
    filtered = [
        {k: (float(v) if isinstance(v, Decimal) else v) for k, v in d.items()}
        for d in items
        if start_iso <= d.get("sk", "") < end_iso
    ]
    filtered.sort(key=lambda d: d.get("sk", ""))
    return filtered


def _report_window(event: dict) -> tuple[str, str, datetime, datetime]:
    now = datetime.now(timezone.utc)
    path = event.get("rawPath") or event.get("requestContext", {}).get("http", {}).get("path", "")
    manual = bool(event.get("manual")) or path == "/summary/generate"

    if manual:
        window_end = now
        window_start = now - timedelta(hours=ROLLING_REPORT_HOURS)
        return "manual_rolling_24h", window_end.strftime("%Y-%m-%d"), window_start, window_end

    today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = today_midnight
    window_start = window_end - timedelta(days=1)
    return "daily_utc", window_start.strftime("%Y-%m-%d"), window_start, window_end


def _store_summary(report: dict) -> None:
    table = _ddb.Table(DYNAMO_TABLE)
    table.put_item(Item={
        "pk": "summary",
        "sk": report["generated_at"],
        "date": report["date"],
        "report_type": report["report_type"],
        "window_start": report["window_start"],
        "window_end": report["window_end"],
        "metrics": json.loads(json.dumps(report["metrics"]), parse_float=Decimal),
        "narrative": report["narrative"],
        "archive": report["archive"],
        "generated_at": report["generated_at"],
    })


def _archive_to_s3(report: dict) -> str:
    safe_generated_at = report["generated_at"].replace(":", "-")
    key = f"reports/{report['report_type']}/{safe_generated_at}.json"
    body = json.dumps(report, indent=2, default=str)
    _s3.put_object(Bucket=REPORTS_BUCKET, Key=key, Body=body, ContentType="application/json")
    return f"s3://{REPORTS_BUCKET}/{key}"


def _send_email(date_str: str, metrics: dict, narrative: str) -> None:
    if not REPORT_EMAIL:
        log.warning("REPORT_EMAIL not set; skipping email")
        return

    subject = f"EcoShift daily report - {date_str}"
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
    event = event if isinstance(event, dict) else {}
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    if method == "OPTIONS":
        return _response(204, {})

    report_type, target_date, window_start, window_end = _report_window(event)
    decisions = _fetch_decisions_window(window_start, window_end)
    log.info(
        "found %d decisions for %s report window %s to %s",
        len(decisions),
        report_type,
        window_start.isoformat(),
        window_end.isoformat(),
    )

    metrics = to_dict(compute_daily(decisions, target_date))
    if decisions:
        try:
            narrative = generate_summary(metrics)
        except Exception as e:
            log.exception("Bedrock narrative generation failed; using deterministic fallback")
            narrative = _fallback_narrative(metrics, e)
    else:
        narrative = "No EcoShift scheduling activity was recorded for this date."

    generated_at = datetime.now(timezone.utc).isoformat()
    report = {
        "date": target_date,
        "report_type": report_type,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "generated_at": generated_at,
        "decisions_processed": len(decisions),
        "metrics": metrics,
        "narrative": narrative,
    }
    report["archive"] = _archive_to_s3(report)
    _store_summary(report)
    _send_email(target_date, metrics, narrative)

    return _response(200, report)
