"""Idempotent AWS Batch compute-environment scaling."""
from __future__ import annotations

import logging
import boto3

log = logging.getLogger(__name__)
_batch = boto3.client("batch")


def get_current_desired_vcpus(compute_env: str) -> int | None:
    resp = _batch.describe_compute_environments(computeEnvironments=[compute_env])
    envs = resp.get("computeEnvironments") or []
    if not envs:
        return None
    return int(envs[0].get("computeResources", {}).get("maxvCpus", 0))


def set_max_vcpus(compute_env: str, target: int) -> dict:
    """Update compute env maxvCpus; no-op if already at target."""
    current = get_current_desired_vcpus(compute_env)
    if current == target:
        log.info("batch compute env %s already at maxvCpus=%d; skipping", compute_env, target)
        return {"changed": False, "previous": current, "target": target}

    log.info("scaling batch compute env %s from maxvCpus=%s -> %d", compute_env, current, target)
    _batch.update_compute_environment(
        computeEnvironment=compute_env,
        computeResources={"maxvCpus": target},
    )
    return {"changed": True, "previous": current, "target": target}
