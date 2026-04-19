"""Carbon accounting for a day's worth of scheduler decisions.

Model (from README 'Measuring Impact'):
    energy_kwh          = vcpu_hours * avg_watts_per_vcpu / 1000
    gco2_actual         = energy_kwh * current_grid_intensity
    gco2_counterfactual = energy_kwh * 24h_avg_grid_intensity
    gco2_avoided        = gco2_counterfactual - gco2_actual
"""
from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Iterable

AVG_WATTS_PER_VCPU = 8.0       # AWS sustainability disclosures, general-purpose compute.
TICK_HOURS = 0.25              # 15-minute scheduler cadence.
USD_PER_VCPU_HOUR = 0.04048    # Fargate us-west-2 pricing, approximate.
SAVINGS_RATIO = 0.30           # Assumed discount for compute shifted into clean grid windows.
TICK_MINUTES_GREEN = 0.5       # Approx. coverage per scale_up tick (30s resolution).


@dataclass
class DailyMetrics:
    date: str
    ticks: int
    green_ticks: int
    dirty_ticks: int
    scale_up_events: int
    scale_down_events: int
    avg_intensity_gco2_per_kwh: float
    min_intensity_gco2_per_kwh: float
    max_intensity_gco2_per_kwh: float
    vcpu_hours_run: float
    vcpu_hours_paused: float
    energy_kwh: float
    gco2_actual: float
    gco2_counterfactual: float
    gco2_avoided: float
    est_usd_saved: float
    money_saved: float
    real_world_equivalent: str


def _real_world_equivalent(gco2_avoided: float) -> str:
    # 404 gCO2 per mile (EPA avg passenger vehicle). 1 tree ~ 60kg CO2/yr.
    miles = gco2_avoided / 404.0
    if gco2_avoided >= 1_000_000:
        tonnes = gco2_avoided / 1_000_000
        return f"equivalent to about {tonnes:.1f} tonnes of CO2, roughly {miles:,.0f} miles not driven"
    if gco2_avoided >= 1000:
        return f"equivalent to not driving {miles:,.0f} miles in an average gasoline car"
    return f"equivalent to not driving {miles:,.1f} miles in an average gasoline car"


def compute_daily(decisions: Iterable[dict], date: str) -> DailyMetrics:
    decisions = list(decisions)
    if not decisions:
        return DailyMetrics(
            date=date, ticks=0, green_ticks=0, dirty_ticks=0,
            scale_up_events=0, scale_down_events=0,
            avg_intensity_gco2_per_kwh=0.0, min_intensity_gco2_per_kwh=0.0, max_intensity_gco2_per_kwh=0.0,
            vcpu_hours_run=0.0, vcpu_hours_paused=0.0,
            energy_kwh=0.0, gco2_actual=0.0, gco2_counterfactual=0.0,
            gco2_avoided=0.0, est_usd_saved=0.0, money_saved=0.0,
            real_world_equivalent="no activity today",
        )

    intensities = [float(d["carbon_intensity"]) for d in decisions]
    avg_intensity = sum(intensities) / len(intensities)

    green = [d for d in decisions if d["action"] == "scale_up"]
    dirty = [d for d in decisions if d["action"] == "scale_down"]

    # Energy during green ticks (running) vs energy that would have run during dirty ticks (counterfactual).
    vcpu_hours_run = sum(int(d.get("batch_target_vcpus") or 0) for d in green) * TICK_HOURS
    vcpu_hours_paused = sum(max(int(d.get("batch_previous_vcpus") or 0), 16) for d in dirty) * TICK_HOURS

    energy_kwh_run = vcpu_hours_run * AVG_WATTS_PER_VCPU / 1000.0
    energy_kwh_paused = vcpu_hours_paused * AVG_WATTS_PER_VCPU / 1000.0

    gco2_actual = sum(
        int(d.get("batch_target_vcpus") or 0) * TICK_HOURS * AVG_WATTS_PER_VCPU / 1000.0 * float(d["carbon_intensity"])
        for d in green
    )
    # Counterfactual: every tick runs at green's vCPU count, at day-average intensity.
    counterfactual_vcpus = max((int(d.get("batch_target_vcpus") or 0) for d in green), default=0)
    total_vcpu_hours_counterfactual = counterfactual_vcpus * len(decisions) * TICK_HOURS
    energy_kwh_counterfactual = total_vcpu_hours_counterfactual * AVG_WATTS_PER_VCPU / 1000.0
    gco2_counterfactual = energy_kwh_counterfactual * avg_intensity

    gco2_avoided = max(gco2_counterfactual - gco2_actual, 0.0)
    est_usd_saved = energy_kwh_paused / (AVG_WATTS_PER_VCPU / 1000.0) * USD_PER_VCPU_HOUR * 0.0  # we defer jobs, not avoid them
    # "Savings" here is carbon, not $. Show the cost of paused compute time instead (for visibility).
    est_usd_saved = vcpu_hours_paused * USD_PER_VCPU_HOUR

    scale_up_events = sum(1 for d in decisions if d["action"] == "scale_up" and d.get("batch_changed"))
    scale_down_events = sum(1 for d in decisions if d["action"] == "scale_down" and d.get("batch_changed"))

    # Demo-friendly "money_saved": vCPU-hours that ran in clean windows, valued at Fargate pricing
    # with a SAVINGS_RATIO discount assumption (off-peak / spot-like savings when shifted to green).
    max_vcpus_green = int(os.environ.get("MAX_VCPUS_GREEN", "16"))
    scale_up_count = len(green)
    vcpu_hrs_green = scale_up_count * (TICK_MINUTES_GREEN / 60.0) * max_vcpus_green
    money_saved = round(vcpu_hrs_green * USD_PER_VCPU_HOUR * SAVINGS_RATIO, 2)

    return DailyMetrics(
        date=date,
        ticks=len(decisions),
        green_ticks=len(green),
        dirty_ticks=len(dirty),
        scale_up_events=scale_up_events,
        scale_down_events=scale_down_events,
        avg_intensity_gco2_per_kwh=round(avg_intensity, 1),
        min_intensity_gco2_per_kwh=round(min(intensities), 1),
        max_intensity_gco2_per_kwh=round(max(intensities), 1),
        vcpu_hours_run=round(vcpu_hours_run, 2),
        vcpu_hours_paused=round(vcpu_hours_paused, 2),
        energy_kwh=round(energy_kwh_run, 3),
        gco2_actual=round(gco2_actual, 1),
        gco2_counterfactual=round(gco2_counterfactual, 1),
        gco2_avoided=round(gco2_avoided, 1),
        est_usd_saved=round(est_usd_saved, 2),
        money_saved=money_saved,
        real_world_equivalent=_real_world_equivalent(gco2_avoided),
    )


def to_dict(m: DailyMetrics) -> dict:
    return asdict(m)
