"""Read-only HTTP API backing the EcoShift dashboard.

Routes:
  GET /decisions?hours=24      -> list of decision records
  GET /summary/latest          -> most recent daily summary (metrics + narrative)
  GET /current                 -> latest single decision (current grid state)
  GET /power-breakdown         -> live energy mix from ElectricityMaps
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

_ddb = boto3.resource("dynamodb")


@lru_cache(maxsize=1)
def _get_api_key() -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=ELECTRICITYMAPS_SECRET_NAME)
    return resp["SecretString"].strip()


def get_power_breakdown() -> dict:
    api_key = _get_api_key()
    url = f"https://api.electricitymap.org/v3/power-breakdown/latest?zone={GRID_ZONE}"
    req = urllib.request.Request(url, headers={"auth-token": api_key})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


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

        if path == "/power-breakdown":
            return _response(200, get_power_breakdown())

        return _response(404, {"error": f"unknown path: {path}"})
    except Exception as e:
        log.exception("api error")
        return _response(500, {"error": str(e)})
