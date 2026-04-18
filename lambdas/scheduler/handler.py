"""EcoShift scheduler Lambda — fires every 15 min.

Flow: fetch grid carbon intensity -> compare to threshold -> scale Batch up or down
      -> log decision to DynamoDB.
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3

from carbon_client import fetch_current_intensity
from batch_controller import set_max_vcpus

log = logging.getLogger()
log.setLevel(logging.INFO)

DYNAMO_TABLE = os.environ.get("DYNAMO_TABLE", "ecoshift-decisions")
GRID_ZONE = os.environ.get("GRID_ZONE", "US-CAL-CISO")
THRESHOLD = float(os.environ.get("GREEN_THRESHOLD_GCO2", "250"))
COMPUTE_ENV = os.environ.get("BATCH_COMPUTE_ENV", "ecoshift-jobs-ce")
VCPUS_GREEN = int(os.environ.get("MAX_VCPUS_GREEN", "16"))
VCPUS_DIRTY = int(os.environ.get("MAX_VCPUS_DIRTY", "0"))
DECISION_TTL_DAYS = 90


def _record_decision(intensity: float, action: str, source: str, batch_result: dict) -> None:
    ddb = boto3.resource("dynamodb").Table(DYNAMO_TABLE)
    now = datetime.now(timezone.utc)
    ttl = int(time.time()) + DECISION_TTL_DAYS * 86400
    ddb.put_item(Item={
        "pk": f"decision#{now.strftime('%Y-%m-%d')}",
        "sk": now.isoformat(),
        "timestamp": now.isoformat(),
        "zone": GRID_ZONE,
        "carbon_intensity": Decimal(str(round(intensity, 2))),
        "threshold": Decimal(str(THRESHOLD)),
        "action": action,
        "source": source,
        "batch_changed": batch_result.get("changed", False),
        "batch_previous_vcpus": batch_result.get("previous"),
        "batch_target_vcpus": batch_result.get("target"),
        "ttl": ttl,
    })


def lambda_handler(event, context):
    intensity, source = fetch_current_intensity(GRID_ZONE, DYNAMO_TABLE)

    if intensity <= THRESHOLD:
        action = "scale_up"
        target = VCPUS_GREEN
    else:
        action = "scale_down"
        target = VCPUS_DIRTY

    log.info(
        "grid intensity=%.1f gCO2/kWh threshold=%.0f -> %s (target vCPUs=%d, source=%s)",
        intensity, THRESHOLD, action, target, source,
    )

    batch_result = set_max_vcpus(COMPUTE_ENV, target)
    _record_decision(intensity, action, source, batch_result)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "intensity_gco2_per_kwh": intensity,
            "threshold": THRESHOLD,
            "action": action,
            "source": source,
            "batch": batch_result,
        }),
    }


if __name__ == "__main__":
    # Local smoke test: ECOSHIFT_MOCK_CARBON=1 python handler.py
    os.environ.setdefault("MOCK_CARBON", "1")
    logging.basicConfig(level=logging.INFO)
    print(lambda_handler({}, None))
