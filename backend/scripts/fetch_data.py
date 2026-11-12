"""Refresh the bundled data snapshot from the Elexon BMRS API.

Usage (from the ``backend`` directory)::

    python -m scripts.fetch_data

The snapshot keeps the deployed app fast and independent of Elexon uptime.
Files are written in a compact, column-light JSON format:

* ``data/actuals_wind.json``   -> {"fetchedAt": ..., "rows": [[startTime, MW], ...]}
* ``data/forecasts_wind.json`` -> {"fetchedAt": ..., "rows": [[startTime, publishTime, MW], ...]}
"""

from __future__ import annotations

import json
from datetime import datetime, time, timedelta, timezone

from app import config
from app.elexon import fetch_wind_actuals, fetch_wind_forecasts


def main() -> None:
    # Actuals: one extra settlement day either side covers UK-local day edges.
    actuals = fetch_wind_actuals(config.SCOPE_START - timedelta(days=1), config.SCOPE_END + timedelta(days=1))

    # Forecasts: WINDFOR runs look up to ~2.5 days ahead, so start 3 days before
    # the first delivery day; stop at the end of the last delivery day.
    publish_from = datetime.combine(config.SCOPE_START - timedelta(days=3), time(0), timezone.utc)
    publish_to = datetime.combine(config.SCOPE_END + timedelta(days=1), time(0), timezone.utc)
    forecasts = fetch_wind_forecasts(publish_from, publish_to)

    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    actual_rows = sorted([r["startTime"], r["generation"]] for r in actuals)
    forecast_rows = sorted([r["startTime"], r["publishTime"], r["generation"]] for r in forecasts)

    config.ACTUALS_FILE.write_text(json.dumps({"fetchedAt": fetched_at, "source": "FUELHH", "rows": actual_rows}))
    config.FORECASTS_FILE.write_text(json.dumps({"fetchedAt": fetched_at, "source": "WINDFOR", "rows": forecast_rows}))
    print(f"Saved {len(actual_rows)} actual rows and {len(forecast_rows)} forecast rows to {config.DATA_DIR}")


if __name__ == "__main__":
    main()
