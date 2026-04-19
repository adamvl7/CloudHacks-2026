"""Read-only HTTP API backing the EcoShift dashboard.

Routes:
  GET /decisions?hours=24      -> list of decision records
  GET /summary/latest          -> most recent daily summary (metrics + narrative)
  GET /current                 -> latest single decision (current grid state)
  GET /regions                 -> dashboard region viewer options
  GET /grid/current?region=... -> live carbon intensity for selected region
  GET /grid/history?region=... -> recent carbon intensity history for selected region
  GET /power-breakdown         -> live energy mix from ElectricityMaps
  GET /forecast                -> 24h carbon-intensity forecast for selected region
  GET /region-compare          -> current intensity across configured regions
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from functools import lru_cache

import boto3
import urllib.request
from boto3.dynamodb.conditions import Key

log = logging.getLogger()
log.setLevel(logging.INFO)

DYNAMO_TABLE = os.environ["DYNAMO_TABLE"]
THRESHOLD = float(os.environ.get("GREEN_THRESHOLD_GCO2", "250"))
GRID_ZONE = os.environ.get("GRID_ZONE", "US-CAL-CISO")
ELECTRICITYMAPS_SECRET_NAME = os.environ.get("ELECTRICITYMAPS_SECRET_NAME", "ecoshift/electricitymaps-api-key")
VCPUS_GREEN = int(os.environ.get("MAX_VCPUS_GREEN", "16"))
VCPUS_DIRTY = int(os.environ.get("MAX_VCPUS_DIRTY", "0"))

_ddb = boto3.resource("dynamodb")

DEFAULT_REGION = "us-west-2"
REGION_OPTIONS = {
    "us-east-1": {
        "region": "us-east-1",
        "name": "N. Virginia",
        "label": "us-east-1 · N. Virginia",
        "zone": "US-MIDA-PJM",
        "threshold": 350,
    },
    "us-east-2": {
        "region": "us-east-2",
        "name": "Ohio",
        "label": "us-east-2 · Ohio",
        "zone": "US-MIDW-MISO",
        "threshold": 380,
    },
    "us-west-2": {
        "region": "us-west-2",
        "name": "Oregon",
        "label": "us-west-2 · Oregon",
        "zone": "US-NW-BPAT",
        "threshold": 120,
    },
    "us-west-1": {
        "region": "us-west-1",
        "name": "N. California",
        "label": "us-west-1 · N. California",
        "zone": "US-CAL-CISO",
        "threshold": 200,
    },
}


@lru_cache(maxsize=1)
def _get_api_key() -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=ELECTRICITYMAPS_SECRET_NAME)
    return resp["SecretString"].strip()


def _region_options_list() -> list[dict]:
    return [dict(option) for option in REGION_OPTIONS.values()]


def _selected_region(qs: dict | None) -> dict:
    requested = ((qs or {}).get("region") or DEFAULT_REGION).strip()
    if requested not in REGION_OPTIONS:
        raise ValueError(
            f"unsupported region '{requested}'. Valid regions: {', '.join(REGION_OPTIONS)}"
        )
    return REGION_OPTIONS[requested]


def _em_get(path: str) -> dict:
    api_key = _get_api_key()
    url = f"https://api.electricitymap.org/v3{path}"
    req = urllib.request.Request(url, headers={"auth-token": api_key})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def get_grid_current(region: dict) -> dict:
    data = _em_get(f"/carbon-intensity/latest?zone={region['zone']}")
    ci = data.get("carbonIntensity")
    return {
        **region,
        "carbonIntensity": float(ci) if ci is not None else None,
        "datetime": data.get("datetime") or data.get("updatedAt"),
    }


def get_grid_history(region: dict) -> dict:
    data = _em_get(
        f"/carbon-intensity/history?zone={region['zone']}&temporalGranularity=15_minutes"
    )
    raw = data.get("history") or data.get("data") or []
    history = []
    for entry in raw:
        dt = entry.get("datetime") or entry.get("time")
        ci = entry.get("carbonIntensity")
        if dt is None or ci is None:
            continue
        intensity = float(ci)
        is_green = intensity <= float(region["threshold"])
        history.append({
            "datetime": dt,
            "carbonIntensity": intensity,
            "action": "scale_up" if is_green else "scale_down",
            "batch_target_vcpus": VCPUS_GREEN if is_green else VCPUS_DIRTY,
        })
    history.sort(key=lambda x: x.get("datetime", ""))
    return {**region, "history": history}


def get_power_breakdown(region: dict) -> dict:
    data = _em_get(f"/power-breakdown/latest?zone={region['zone']}")
    return {**data, **region}


def get_forecast(region: dict) -> dict:
    data = _em_get(f"/carbon-intensity/forecast?zone={region['zone']}")
    raw = data.get("forecast") or data.get("data") or []
    forecast = []
    for entry in raw[:24]:
        dt = entry.get("datetime") or entry.get("time")
        ci = entry.get("carbonIntensity")
        if dt is None or ci is None:
            continue
        forecast.append({"datetime": dt, "carbonIntensity": float(ci)})
    return {**region, "forecast": forecast}


def get_region_compare(selected_region: dict) -> dict:
    regions = []
    for region in REGION_OPTIONS.values():
        try:
            data = _em_get(f"/carbon-intensity/latest?zone={region['zone']}")
            ci = data.get("carbonIntensity")
            if ci is None:
                continue
            regions.append({
                **region,
                "carbonIntensity": float(ci),
            })
        except Exception as e:
            log.warning("region-compare: skipping %s (%s)", region["zone"], e)
            continue
    return {
        "current_region": selected_region["region"],
        "current_zone": selected_region["zone"],
        "regions": regions,
    }


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o) if o % 1 else int(o)
        return super().default(o)


def _response(status: int, body) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def _decisions_for_day(date_str: str) -> list[dict]:
    table = _ddb.Table(DYNAMO_TABLE)
    resp = table.query(KeyConditionExpression=Key("pk").eq(f"decision#{date_str}"))
    return resp.get("Items", [])


def get_decisions(hours: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    earliest = now - timedelta(hours=hours)
    days_to_query = {earliest.strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")}
    all_items: list[dict] = []
    for day in days_to_query:
        all_items.extend(_decisions_for_day(day))
    filtered = [i for i in all_items if i.get("sk", "") >= earliest.isoformat()]
    filtered.sort(key=lambda x: x.get("sk", ""))
    return filtered


def get_latest_summary() -> dict | None:
    table = _ddb.Table(DYNAMO_TABLE)
    resp = table.query(
        KeyConditionExpression=Key("pk").eq("summary"),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_current() -> dict | None:
    decisions = get_decisions(2)
    return decisions[-1] if decisions else None


def lambda_handler(event, context):
    path = event.get("rawPath") or event.get("requestContext", {}).get("http", {}).get("path", "")
    qs = event.get("queryStringParameters") or {}

    try:
        if path == "/decisions":
            hours = int(qs.get("hours", "24"))
            hours = max(1, min(hours, 168))
            return _response(200, {"decisions": get_decisions(hours)})

        if path == "/summary/latest":
            summary = get_latest_summary()
            if not summary:
                return _response(404, {"error": "no summaries yet"})
            return _response(200, summary)

        if path == "/current":
            current = get_current()
            if not current:
                return _response(404, {"error": "no decisions yet"})
            return _response(200, {
                "decision": current,
                "threshold": THRESHOLD,
            })

        if path == "/regions":
            return _response(200, {
                "default_region": DEFAULT_REGION,
                "regions": _region_options_list(),
            })

        if path == "/grid/current":
            region = _selected_region(qs)
            return _response(200, get_grid_current(region))

        if path == "/grid/history":
            region = _selected_region(qs)
            return _response(200, get_grid_history(region))

        if path == "/power-breakdown":
            region = _selected_region(qs)
            return _response(200, get_power_breakdown(region))

        if path == "/forecast":
            region = _selected_region(qs)
            return _response(200, get_forecast(region))

        if path == "/region-compare":
            region = _selected_region(qs)
            return _response(200, get_region_compare(region))

        return _response(404, {"error": f"unknown path: {path}"})
    except ValueError as e:
        return _response(400, {"error": str(e)})
    except Exception as e:
        log.exception("api error")
        return _response(500, {"error": str(e)})
