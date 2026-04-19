"""Nimbus reporter Lambda.

Scheduled reports run at 00:00 UTC and summarize the previous full UTC day.
Manual dashboard reports summarize the rolling previous 24 hours.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Key

from bedrock_client import generate_summary
from metrics import compute_daily, to_dict

log = logging.getLogger()
log.setLevel(logging.INFO)

DYNAMO_TABLE = os.environ["DYNAMO_TABLE"]
REPORTS_BUCKET = os.environ["REPORTS_BUCKET"]
REPORT_EMAIL = os.environ.get("REPORT_EMAIL", "")
ELECTRICITYMAPS_SECRET_NAME = os.environ.get("ELECTRICITYMAPS_SECRET_NAME", "ecoshift/electricitymaps-api-key")
VCPUS_GREEN = int(os.environ.get("MAX_VCPUS_GREEN", "16"))
VCPUS_DIRTY = int(os.environ.get("MAX_VCPUS_DIRTY", "0"))
ROLLING_REPORT_HOURS = 24
DEFAULT_REGION = "us-west-2"

REGION_OPTIONS = {
    "us-east-1": {
        "region": "us-east-1",
        "name": "N. Virginia",
        "label": "us-east-1 - N. Virginia",
        "zone": "US-MIDA-PJM",
        "threshold": 350,
    },
    "us-east-2": {
        "region": "us-east-2",
        "name": "Ohio",
        "label": "us-east-2 - Ohio",
        "zone": "US-MIDW-MISO",
        "threshold": 380,
    },
    "us-west-2": {
        "region": "us-west-2",
        "name": "Oregon",
        "label": "us-west-2 - Oregon",
        "zone": "US-NW-BPAT",
        "threshold": 120,
    },
    "us-west-1": {
        "region": "us-west-1",
        "name": "N. California",
        "label": "us-west-1 - N. California",
        "zone": "US-CAL-CISO",
        "threshold": 200,
    },
}

_ddb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_ses = boto3.client("ses")


@lru_cache(maxsize=1)
def _get_api_key() -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=ELECTRICITYMAPS_SECRET_NAME)
    return resp["SecretString"].strip()


def _em_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.electricitymap.org/v3{path}",
        headers={"auth-token": _get_api_key()},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def _selected_region(qs: dict | None) -> dict | None:
    requested = (qs or {}).get("region")
    if requested is None or str(requested).strip() == "":
        return None
    requested = str(requested).strip()
    if requested not in REGION_OPTIONS:
        raise ValueError(
            f"unsupported region '{requested}'. Valid regions: {', '.join(REGION_OPTIONS)}"
        )
    return REGION_OPTIONS[requested]


def _fetch_region_decisions(region: dict) -> list[dict]:
    data = _em_get(
        f"/carbon-intensity/history?zone={region['zone']}&temporalGranularity=15_minutes"
    )
    raw = data.get("history") or data.get("data") or []
    decisions = []
    previous_action = None
    for entry in raw:
        dt = entry.get("datetime") or entry.get("time")
        ci = entry.get("carbonIntensity")
        if dt is None or ci is None:
            continue
        intensity = float(ci)
        action = "scale_up" if intensity <= float(region["threshold"]) else "scale_down"
        target_vcpus = VCPUS_GREEN if action == "scale_up" else VCPUS_DIRTY
        previous_vcpus = VCPUS_DIRTY if previous_action == "scale_down" else VCPUS_GREEN
        decisions.append({
            "pk": f"regional_decision#{region['region']}",
            "sk": dt,
            "carbon_intensity": intensity,
            "action": action,
            "batch_target_vcpus": target_vcpus,
            "batch_previous_vcpus": previous_vcpus,
            "batch_changed": previous_action is not None and previous_action != action,
        })
        previous_action = action
    decisions.sort(key=lambda d: d.get("sk", ""))
    return decisions[-96:]


def _fallback_narrative(metrics: dict, error: Exception | None = None) -> str:
    product_name = "Nimbus"
    clean_pct = 0
    saved_pct = 0
    if metrics.get("ticks"):
        clean_pct = round((float(metrics.get("green_ticks", 0)) / float(metrics["ticks"])) * 100)
        saved_pct = round((float(metrics.get("dirty_ticks", 0)) / float(metrics["ticks"])) * 100)
    region_text = ""
    if metrics.get("region") and metrics.get("zone"):
        region_text = (
            f" for {metrics.get('region')} ({metrics.get('region_name')}, "
            f"{metrics.get('zone')})"
        )
    suffix = ""
    if error:
        suffix = (
            f"\n\nClaude narrative generation was unavailable for this run, so {product_name} "
            "published this deterministic report from the same metrics. "
            f"Reporter detail: {type(error).__name__}."
        )
    return (
        f"{product_name} processed {metrics['ticks']} carbon samples{region_text} for {metrics['date']}. "
        f"The scheduler ran work during {metrics['green_ticks']} green ticks and paused "
        f"during {metrics['dirty_ticks']} dirty ticks, with {metrics['scale_up_events']} "
        f"scale-up events and {metrics['scale_down_events']} scale-down events.\n\n"
        f"The observed grid intensity averaged {metrics['avg_intensity_gco2_per_kwh']} "
        f"gCO2/kWh, ranging from {metrics['min_intensity_gco2_per_kwh']} to "
        f"{metrics['max_intensity_gco2_per_kwh']} gCO2/kWh. {product_name} ran "
        f"{metrics['vcpu_hours_run']} vCPU-hours and deferred {metrics['vcpu_hours_paused']} "
        f"vCPU-hours, avoiding an estimated {metrics['gco2_avoided']} gCO2. "
        f"That is {metrics['real_world_equivalent']}.\n\n"
        f"{product_name} saved {saved_pct}% by pausing time-flexible work during dirty "
        "grid windows. The queue stays ready for the next green period, showing how schedulers "
        "can meaningfully reduce emissions at scale."
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
    # Always key per-region so every run produces a new record per region.
    region = report.get("region") or os.environ.get("REGION") or os.environ.get("AWS_REGION") or DEFAULT_REGION
    pk = f"summary#{region}"
    item = {
        "pk": pk,
        "sk": report["date"],          # one record per region per UTC day (overwrites on re-generate)
        "date": report["date"],
        "report_type": report["report_type"],
        "window_start": report["window_start"],
        "window_end": report["window_end"],
        "metrics": json.loads(json.dumps(report["metrics"]), parse_float=Decimal),
        "narrative": report["narrative"],
        "archive": report["archive"],
        "generated_at": report["generated_at"],
        "region": region,
    }
    if report.get("region_name"):
        item["region_name"] = report["region_name"]
    if report.get("zone"):
        item["zone"] = report["zone"]
    if report.get("threshold") is not None:
        item["threshold"] = report["threshold"]
    table.put_item(Item=item)


def _archive_to_s3(report: dict) -> str:
    safe_generated_at = report["generated_at"].replace(":", "-")
    region_prefix = f"{report['region']}/" if report.get("region") else ""
    key = f"reports/{report['report_type']}/{region_prefix}{safe_generated_at}.json"
    body = json.dumps(report, indent=2, default=str)
    _s3.put_object(Bucket=REPORTS_BUCKET, Key=key, Body=body, ContentType="application/json")
    return f"s3://{REPORTS_BUCKET}/{key}"


def _send_email(date_str: str, metrics: dict, narrative: str) -> None:
    if not REPORT_EMAIL:
        log.warning("REPORT_EMAIL not set; skipping email")
        return

    subject = f"Nimbus daily report - {date_str}"
    text_body = (
        f"Nimbus sustainability report for {date_str}\n"
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
    qs = event.get("queryStringParameters") or {}

    if method == "OPTIONS":
        return _response(204, {})

    try:
        region = _selected_region(qs)
    except ValueError as e:
        return _response(400, {"error": str(e)})

    report_type, target_date, window_start, window_end = _report_window(event)
    if region:
        report_type = "regional_rolling_24h"
        target_date = window_end.strftime("%Y-%m-%d")
        decisions = _fetch_region_decisions(region)
    else:
        decisions = _fetch_decisions_window(window_start, window_end)

    log.info(
        "found %d decisions for %s report window %s to %s region=%s",
        len(decisions),
        report_type,
        window_start.isoformat(),
        window_end.isoformat(),
        region["region"] if region else "scheduler",
    )

    metrics = to_dict(compute_daily(decisions, target_date))
    metrics.pop("money_saved", None)
    metrics.pop("est_usd_saved", None)
    if metrics.get("ticks"):
        metrics["clean_pct"] = round(
            (float(metrics.get("green_ticks", 0)) / float(metrics["ticks"])) * 100
        )
        metrics["saved_pct"] = round(
            (float(metrics.get("dirty_ticks", 0)) / float(metrics["ticks"])) * 100
        )
    else:
        metrics["clean_pct"] = 0
        metrics["saved_pct"] = 0
    if region:
        metrics.update({
            "region": region["region"],
            "region_name": region["name"],
            "zone": region["zone"],
            "threshold": region["threshold"],
            "report_scope": "selected dashboard region preview",
        })
    if decisions:
        try:
            narrative = generate_summary(metrics)
        except Exception as e:
            log.exception("Bedrock narrative generation failed; using deterministic fallback")
            narrative = _fallback_narrative(metrics, e)
    else:
        narrative = "No Nimbus scheduling activity was recorded for this report window."

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
    if region:
        report.update({
            "region": region["region"],
            "region_name": region["name"],
            "zone": region["zone"],
            "threshold": region["threshold"],
        })
    report["archive"] = _archive_to_s3(report)
    _store_summary(report)
    if not region:
        _send_email(target_date, metrics, narrative)

    return _response(200, report)
