#!/usr/bin/env python3
"""Seed Nimbus with demo data and/or flip the live demo scenario.

Usage:
    # Populate the last 24h of decision history (uses the synthetic fixture):
    python scripts/seed_demo_data.py --history

    # Force the next scheduler tick to see DIRTY grid:
    python scripts/seed_demo_data.py --scenario=dirty

    # Force the next scheduler tick to see GREEN grid:
    python scripts/seed_demo_data.py --scenario=green

    # Clear the override (return to fixture/live carbon data):
    python scripts/seed_demo_data.py --clear

Requires AWS credentials with read/write access to the ecoshift-decisions table.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import boto3

TABLE_NAME = "ecoshift-decisions"
THRESHOLD = 250
FIXTURE = Path(__file__).parent.parent / "lambdas" / "scheduler" / "fixtures" / "carbon_caiso_24h.json"


def get_table():
    return boto3.resource("dynamodb").Table(TABLE_NAME)


def seed_history() -> None:
    table = get_table()
    with FIXTURE.open() as f:
        points = json.load(f)["points"]
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=24)

    print(f"seeding 96 synthetic decisions into {TABLE_NAME}...")
    with table.batch_writer() as bw:
        for i, pt in enumerate(points):
            ts = start + timedelta(minutes=15 * i)
            intensity = float(pt["carbon_intensity_gco2_per_kwh"]) + random.uniform(-8, 8)
            action = "scale_up" if intensity <= THRESHOLD else "scale_down"
            target = 16 if action == "scale_up" else 0
            bw.put_item(Item={
                "pk": f"decision#{ts.strftime('%Y-%m-%d')}",
                "sk": ts.isoformat(),
                "timestamp": ts.isoformat(),
                "zone": "US-CAL-CISO",
                "carbon_intensity": Decimal(str(round(intensity, 2))),
                "threshold": Decimal(str(THRESHOLD)),
                "action": action,
                "source": "seed",
                "batch_changed": True,
                "batch_previous_vcpus": 16 if i > 0 and action != ("scale_up" if float(points[i-1]["carbon_intensity_gco2_per_kwh"]) <= THRESHOLD else "scale_down") else target,
                "batch_target_vcpus": target,
                "ttl": int(time.time()) + 7 * 86400,
            })
    print("done.")


def set_override(value: float) -> None:
    table = get_table()
    table.put_item(Item={
        "pk": "override",
        "sk": "current",
        "carbon_intensity": Decimal(str(round(value, 2))),
        "set_at": datetime.now(timezone.utc).isoformat(),
        "ttl": int(time.time()) + 3600,
    })
    print(f"override set to {value:.1f} gCO2/kWh (expires in 1h or on --clear)")


def clear_override() -> None:
    get_table().delete_item(Key={"pk": "override", "sk": "current"})
    print("override cleared.")


def main():
    ap = argparse.ArgumentParser()
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--history", action="store_true", help="seed 24h of synthetic decisions")
    group.add_argument("--scenario", choices=("green", "dirty"), help="set demo override")
    group.add_argument("--clear", action="store_true", help="clear demo override")
    args = ap.parse_args()

    if args.history:
        seed_history()
    elif args.scenario == "green":
        set_override(150.0)
    elif args.scenario == "dirty":
        set_override(420.0)
    elif args.clear:
        clear_override()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
