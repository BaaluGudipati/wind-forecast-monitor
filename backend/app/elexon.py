"""Thin client for the two Elexon BMRS datasets used by the pilot.

* FUELHH  - half-hourly outturn generation by fuel type (we keep ``WIND``).
* WINDFOR - national wind generation forecasts (hourly targets, many runs/day).

Only the standard library is used so the client works anywhere (including the
Vercel serverless runtime) without extra dependencies.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from typing import Any

from . import config

USER_AGENT = "wind-forecast-monitor/1.0"


def _get_json(path: str, params: dict[str, str], retries: int = 3) -> list[dict[str, Any]]:
    url = f"{config.ELEXON_BASE_URL}{path}?{urllib.parse.urlencode(params)}"
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            # The /stream endpoints return a bare list; other endpoints wrap it in {"data": [...]}.
            return payload["data"] if isinstance(payload, dict) else payload
        except Exception as exc:  # pragma: no cover - network failure path
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Elexon request failed after {retries} attempts: {url}") from last_error


def fetch_wind_actuals(start: date, end: date) -> list[dict[str, Any]]:
    """FUELHH wind outturn for settlement dates ``start``..``end`` (inclusive)."""
    rows = _get_json(
        "/datasets/FUELHH/stream",
        {"settlementDateFrom": start.isoformat(), "settlementDateTo": end.isoformat(), "fuelType": "WIND"},
    )
    return [r for r in rows if r.get("fuelType") == "WIND"]


def fetch_wind_forecasts(publish_from: datetime, publish_to: datetime, chunk_days: int = 7) -> list[dict[str, Any]]:
    """All WINDFOR forecast runs published in ``[publish_from, publish_to)``.

    Requests are chunked by publish time to keep each response small.
    """
    rows: list[dict[str, Any]] = []
    cursor = publish_from
    while cursor < publish_to:
        chunk_end = min(cursor + timedelta(days=chunk_days), publish_to)
        rows.extend(
            _get_json(
                "/datasets/WINDFOR/stream",
                {
                    "publishDateTimeFrom": cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "publishDateTimeTo": chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
            )
        )
        cursor = chunk_end
    # Chunk boundaries are inclusive on both ends at the API, so de-duplicate.
    unique = {(r["startTime"], r["publishTime"]): r for r in rows}
    return list(unique.values())
