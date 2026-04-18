"""ElectricityMaps wrapper with a mock-fixture fallback for demos."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

import boto3

log = logging.getLogger(__name__)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "carbon_caiso_24h.json"
ELECTRICITYMAPS_URL = "https://api.electricitymap.org/v3/carbon-intensity/latest"


def _is_mock() -> bool:
    return os.environ.get("MOCK_CARBON", "1") == "1"


def _load_fixture() -> list[dict]:
    with FIXTURE_PATH.open() as f:
        return json.load(f)["points"]


def _fixture_lookup_now(now: datetime) -> float:
    """Pick the fixture point matching the current wall-clock quarter-hour."""
    points = _load_fixture()
    idx = (now.hour * 4) + (now.minute // 15)
    idx = min(idx, len(points) - 1)
    return float(points[idx]["carbon_intensity_gco2_per_kwh"])


def _demo_override(table_name: str) -> Optional[float]:
    """Check DynamoDB for a demo-forced intensity override (set by seed_demo_data.py)."""
    if not table_name:
        return None
    try:
        ddb = boto3.resource("dynamodb")
        resp = ddb.Table(table_name).get_item(Key={"pk": "override", "sk": "current"})
        item = resp.get("Item")
        if item and "carbon_intensity" in item:
            return float(item["carbon_intensity"])
    except Exception as e:
        log.warning("override lookup failed: %s", e)
    return None


@lru_cache(maxsize=1)
def _secret_api_key(secret_name: str) -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=secret_name)
    return resp["SecretString"].strip()


def _fetch_real(zone: str) -> float:
    import requests
    secret_name = os.environ.get("ELECTRICITYMAPS_SECRET_NAME", "ecoshift/electricitymaps-api-key")
    api_key = _secret_api_key(secret_name)
    r = requests.get(
        ELECTRICITYMAPS_URL,
        params={"zone": zone},
        headers={"auth-token": api_key},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    return float(data["carbonIntensity"])


def fetch_current_intensity(zone: str, table_name: str = "") -> tuple[float, str]:
    """Return (gCO2/kWh, source) where source is one of 'override', 'mock', 'live'."""
    override = _demo_override(table_name)
    if override is not None:
        log.info("using demo override: %.1f gCO2/kWh", override)
        return override, "override"

    if _is_mock():
        now = datetime.now(timezone.utc)
        value = _fixture_lookup_now(now)
        log.info("mock fixture lookup @ %s: %.1f gCO2/kWh", now.strftime("%H:%M"), value)
        return value, "mock"

    value = _fetch_real(zone)
    log.info("electricitymaps %s: %.1f gCO2/kWh", zone, value)
    return value, "live"
