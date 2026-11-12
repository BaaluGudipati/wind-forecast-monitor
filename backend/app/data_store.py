"""Loads the wind data snapshot into memory once per process.

The data is small (~20k forecast rows for the pilot month), so an in-memory
index keyed by target time is simpler and faster than a database.
"""

from __future__ import annotations

import bisect
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from . import config


def parse_utc(ts: str) -> datetime:
    """Parse Elexon ISO timestamps such as ``2026-01-01T23:30:00Z``."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)


@dataclass(frozen=True)
class ForecastPoint:
    publish_time: datetime
    generation: float


@dataclass
class WindDataset:
    #: target time (UTC) -> actual wind generation (MW)
    actuals: dict[datetime, float]
    #: target time (UTC) -> forecast runs for that target, sorted by publish time
    forecasts: dict[datetime, list[ForecastPoint]]
    actuals_fetched_at: str = ""
    forecasts_fetched_at: str = ""
    _publish_index: dict[datetime, list[datetime]] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        for target, runs in self.forecasts.items():
            runs.sort(key=lambda p: p.publish_time)
            self._publish_index[target] = [p.publish_time for p in runs]

    def latest_forecast(self, target: datetime, cutoff: datetime) -> ForecastPoint | None:
        """Most recent forecast for ``target`` published at or before ``cutoff``."""
        publish_times = self._publish_index.get(target)
        if not publish_times:
            return None
        idx = bisect.bisect_right(publish_times, cutoff) - 1
        return self.forecasts[target][idx] if idx >= 0 else None

    @property
    def forecast_run_count(self) -> int:
        return len({p.publish_time for runs in self.forecasts.values() for p in runs})


def load_dataset(actuals_file: Path, forecasts_file: Path) -> WindDataset:
    actuals_raw = json.loads(actuals_file.read_text())
    forecasts_raw = json.loads(forecasts_file.read_text())

    actuals = {parse_utc(start): float(mw) for start, mw in actuals_raw["rows"]}
    forecasts: dict[datetime, list[ForecastPoint]] = {}
    for start, publish, mw in forecasts_raw["rows"]:
        forecasts.setdefault(parse_utc(start), []).append(ForecastPoint(parse_utc(publish), float(mw)))

    return WindDataset(
        actuals=actuals,
        forecasts=forecasts,
        actuals_fetched_at=actuals_raw.get("fetchedAt", ""),
        forecasts_fetched_at=forecasts_raw.get("fetchedAt", ""),
    )


@lru_cache(maxsize=1)
def get_dataset() -> WindDataset:
    """Process-wide dataset (cached; FastAPI dependency)."""
    return load_dataset(config.ACTUALS_FILE, config.FORECASTS_FILE)
