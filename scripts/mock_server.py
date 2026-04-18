#!/usr/bin/env python3
"""Local mock API server for EcoShift dashboard development.

Serves /current, /decisions, and /summary/latest with synthetic data
so the React dashboard can be fully exercised without deploying to AWS.

Usage:
    python scripts/mock_server.py [--port 3001] [--scenario green|dirty]
"""
from __future__ import annotations

import argparse
import json
import math
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

THRESHOLD = 250
MAX_VCPUS = 16

NARRATIVE = """Today, EcoShift managed compute scheduling across a 24-hour window for the US-CAL-CISO grid zone, executing 27 scale-up events during green energy windows and 69 scale-down events during high-carbon periods. In total, 108 vCPU-hours of work were completed exclusively while grid carbon intensity fell below the 250 gCO\u2082eq/kWh threshold, with all non-urgent jobs held in the AWS Batch queue during the 9.75 dirty hours.

From an environmental perspective, this approach avoided an estimated 742 grams of CO\u2082 equivalent compared to a flat-schedule baseline\u2014roughly equivalent to not driving 1.8 miles in an average gasoline car. The average grid intensity observed was 285.8 gCO\u2082/kWh, with the cleanest window recorded at midday (115 gCO\u2082/kWh) as California solar generation peaked, and the highest intensity at 19:30 UTC (415 gCO\u2082/kWh) during the evening gas-plant ramp.

On cost impact, deferred compute during dirty windows avoided approximately $11.17 in Fargate charges that would have run at full capacity around the clock. Looking ahead to tomorrow, the CAISO forecast suggests a similar solar profile; EcoShift will pre-position the compute environment to scale up ahead of the midday clean window. No action is required from engineering teams\u2014jobs will resume automatically when the grid is green."""


def _synthetic_decisions(hours: int = 24, scenario: str = "normal") -> list[dict]:
    now = datetime.now(timezone.utc)
    decisions = []
    for i in range(hours * 4):
        ts = now - timedelta(minutes=15 * (hours * 4 - 1 - i))
        hour = ts.hour + ts.minute / 60.0
        solar = 170 * max(0.0, math.cos((hour - 13) * math.pi / 9))
        evening = 130 * max(0.0, math.cos((hour - 20) * math.pi / 6))
        morning = 40 * max(0.0, math.cos((hour - 7) * math.pi / 4))
        intensity = max(80.0, round(285 + evening + morning - solar, 1))

        # Override for demo scenarios
        if scenario == "dirty":
            intensity = 420.0
        elif scenario == "green":
            intensity = 150.0

        action = "scale_up" if intensity <= THRESHOLD else "scale_down"
        target = MAX_VCPUS if action == "scale_up" else 0
        prev = MAX_VCPUS if action == "scale_down" else 0
        decisions.append({
            "pk": f"decision#{ts.strftime('%Y-%m-%d')}",
            "sk": ts.isoformat(),
            "timestamp": ts.isoformat(),
            "zone": "US-CAL-CISO",
            "carbon_intensity": intensity,
            "threshold": THRESHOLD,
            "action": action,
            "source": "mock",
            "batch_changed": True,
            "batch_previous_vcpus": prev,
            "batch_target_vcpus": target,
        })
    return decisions


def _compute_metrics(decisions: list[dict]) -> dict:
    if not decisions:
        return {}
    intensities = [d["carbon_intensity"] for d in decisions]
    avg = sum(intensities) / len(intensities)
    green = [d for d in decisions if d["action"] == "scale_up"]
    dirty = [d for d in decisions if d["action"] == "scale_down"]
    vcpu_hours_run = len(green) * 0.25 * MAX_VCPUS
    vcpu_hours_paused = len(dirty) * 0.25 * MAX_VCPUS
    energy_kwh = vcpu_hours_run * 8 / 1000
    gco2_actual = sum(MAX_VCPUS * 0.25 * 8 / 1000 * d["carbon_intensity"] for d in green)
    cf_vcpu_h = MAX_VCPUS * len(decisions) * 0.25
    gco2_cf = cf_vcpu_h * 8 / 1000 * avg
    gco2_avoided = max(gco2_cf - gco2_actual, 0)
    miles = gco2_avoided / 404
    return {
        "date": decisions[-1]["sk"][:10],
        "ticks": len(decisions),
        "green_ticks": len(green),
        "dirty_ticks": len(dirty),
        "scale_up_events": len(green),
        "scale_down_events": len(dirty),
        "avg_intensity_gco2_per_kwh": round(avg, 1),
        "min_intensity_gco2_per_kwh": round(min(intensities), 1),
        "max_intensity_gco2_per_kwh": round(max(intensities), 1),
        "vcpu_hours_run": round(vcpu_hours_run, 2),
        "vcpu_hours_paused": round(vcpu_hours_paused, 2),
        "energy_kwh": round(energy_kwh, 3),
        "gco2_actual": round(gco2_actual, 1),
        "gco2_counterfactual": round(gco2_cf, 1),
        "gco2_avoided": round(gco2_avoided, 1),
        "est_usd_saved": round(vcpu_hours_paused * 0.04048, 2),
        "real_world_equivalent": f"equivalent to not driving {miles:.1f} miles in an average gasoline car",
    }


SCENARIO = "normal"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  [{self.command}] {self.path}")

    def _send(self, status: int, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        path = parsed.path

        if path == "/current":
            decisions = _synthetic_decisions(2, SCENARIO)
            if not decisions:
                self._send(404, {"error": "no data"})
                return
            latest = decisions[-1]
            self._send(200, {"decision": latest, "threshold": THRESHOLD})

        elif path == "/decisions":
            hours = int((qs.get("hours") or ["24"])[0])
            decisions = _synthetic_decisions(hours, SCENARIO)
            self._send(200, {"decisions": decisions})

        elif path == "/summary/latest":
            decisions = _synthetic_decisions(24, SCENARIO)
            metrics = _compute_metrics(decisions)
            self._send(200, {
                "pk": "summary",
                "sk": decisions[-1]["sk"][:10],
                "date": decisions[-1]["sk"][:10],
                "metrics": metrics,
                "narrative": NARRATIVE,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            })

        elif path == "/scenario":
            self._send(200, {"scenario": SCENARIO})

        else:
            self._send(404, {"error": f"unknown path: {path}"})


def main():
    global SCENARIO
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=3001)
    ap.add_argument("--scenario", choices=("normal", "green", "dirty"), default="normal")
    args = ap.parse_args()
    SCENARIO = args.scenario

    server = HTTPServer(("localhost", args.port), Handler)
    print(f"EcoShift mock API running at http://localhost:{args.port}")
    print(f"Scenario: {SCENARIO}  (intensity: {'~150 gCO2/kWh' if SCENARIO=='green' else '~420 gCO2/kWh' if SCENARIO=='dirty' else 'CAISO 24h cycle'})")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
