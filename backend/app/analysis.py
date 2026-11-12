"""Forecast selection and accuracy analysis (pure functions, no I/O).

Key business rule
-----------------
For every target half-hour we need *the forecast the trader could actually
have seen when deciding*. Two decision rules are supported:

``day_ahead``
    The GB day-ahead auction closes at a gate time (default 11:00 UK) on the
    day before delivery. For a target in UK delivery day D we take the latest
    WINDFOR run published at or before ``D-1 @ gate``.

``horizon``
    A fixed lead time of ``h`` hours: the latest run published at or before
    ``target - h``. Useful to see how quickly accuracy degrades with lead time.

Error convention: ``error = forecast - actual`` (MW). A positive error means
wind under-delivered against the forecast - i.e. the volume the team would
have to buy back short-notice. That sign is what matters for procurement risk.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from statistics import fmean
from typing import Iterable, Literal

from . import config
from .data_store import WindDataset

Mode = Literal["day_ahead", "horizon"]


# --- Time helpers --------------------------------------------------------------


def delivery_window_utc(start: date, end: date) -> tuple[datetime, datetime]:
    """UTC ``[from, to)`` covering UK-local delivery days ``start``..``end``."""
    tz = config.UK_TZ
    begin = datetime.combine(start, time(0), tz).astimezone(timezone.utc)
    finish = datetime.combine(end + timedelta(days=1), time(0), tz).astimezone(timezone.utc)
    return begin, finish


def delivery_day(target: datetime) -> date:
    return target.astimezone(config.UK_TZ).date()


def decision_cutoff(target: datetime, mode: Mode, horizon_hours: float = 0.0, gate: time = config.DEFAULT_GATE_TIME) -> datetime:
    """Latest publish time a forecast may have to be usable for ``target``."""
    if mode == "horizon":
        return target - timedelta(hours=horizon_hours)
    decision_day = delivery_day(target) - timedelta(days=1)
    return datetime.combine(decision_day, gate, config.UK_TZ).astimezone(timezone.utc)


# --- Statistics helpers ----------------------------------------------------------


def percentile(values: list[float], q: float) -> float:
    """Linear-interpolated percentile (same definition as numpy's default)."""
    if not values:
        return math.nan
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q / 100.0
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return ordered[lo]
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def _clean(value: float) -> float | None:
    return None if value is None or math.isnan(value) else round(value, 1)


# --- Results -------------------------------------------------------------------


@dataclass(frozen=True)
class SeriesPoint:
    target: datetime
    actual: float | None
    forecast: float | None
    publish_time: datetime | None

    @property
    def error(self) -> float | None:
        if self.actual is None or self.forecast is None:
            return None
        return self.forecast - self.actual

    @property
    def lead_hours(self) -> float | None:
        if self.publish_time is None:
            return None
        return (self.target - self.publish_time).total_seconds() / 3600.0


def build_series(
    data: WindDataset,
    start: date,
    end: date,
    mode: Mode,
    horizon_hours: float = 0.0,
    gate: time = config.DEFAULT_GATE_TIME,
) -> list[SeriesPoint]:
    """Actual vs. decision-time forecast for every target in the window.

    Actuals are half-hourly; WINDFOR targets are hourly, so half-past points
    carry an actual only. We deliberately do not interpolate forecasts: every
    number shown is a value Elexon actually published.
    """
    begin, finish = delivery_window_utc(start, end)
    targets = sorted({t for t in data.actuals if begin <= t < finish} | {t for t in data.forecasts if begin <= t < finish})

    points: list[SeriesPoint] = []
    for target in targets:
        fc = data.latest_forecast(target, decision_cutoff(target, mode, horizon_hours, gate))
        points.append(
            SeriesPoint(
                target=target,
                actual=data.actuals.get(target),
                forecast=fc.generation if fc else None,
                publish_time=fc.publish_time if fc else None,
            )
        )
    return points


def error_metrics(points: Iterable[SeriesPoint]) -> dict[str, float | int | None]:
    """Accuracy summary over the points that have both an actual and a forecast."""
    pairs = [p for p in points if p.error is not None]
    errors = [p.error for p in pairs]  # type: ignore[misc]
    abs_errors = [abs(e) for e in errors]
    actuals = [p.actual for p in pairs]  # type: ignore[misc]
    leads = [p.lead_hours for p in pairs if p.lead_hours is not None]

    if not pairs:
        return {"count": 0}

    mean_actual = fmean(actuals)
    mae = fmean(abs_errors)
    rmse = math.sqrt(fmean(e * e for e in errors))
    ss_res = sum(e * e for e in errors)
    ss_tot = sum((a - mean_actual) ** 2 for a in actuals)

    return {
        "count": len(pairs),
        "mae": _clean(mae),
        "rmse": _clean(rmse),
        "bias": _clean(fmean(errors)),
        # Spread of the error once the systematic bias is removed (population std-dev).
        "error_std": _clean(math.sqrt(max(0.0, fmean(e * e for e in errors) - fmean(errors) ** 2))),
        "nmae_pct": _clean(100 * mae / mean_actual) if mean_actual else None,
        "r2": round(1 - ss_res / ss_tot, 3) if ss_tot else None,
        "p50_abs_error": _clean(percentile(abs_errors, 50)),
        "p90_abs_error": _clean(percentile(abs_errors, 90)),
        "max_abs_error": _clean(max(abs_errors)),
        # Signed error band: actual falls within [forecast - p90, forecast - p10] 80% of the time.
        "p10_error": _clean(percentile(errors, 10)),
        "p90_error": _clean(percentile(errors, 90)),
        # P90 shortfall: in 90% of hours wind delivered no more than this below forecast.
        "shortfall_p90": _clean(max(0.0, percentile(errors, 90))),
        "under_delivery_share_pct": _clean(100 * sum(e > 0 for e in errors) / len(errors)),
        "mean_actual": _clean(mean_actual),
        "mean_lead_hours": _clean(fmean(leads)) if leads else None,
    }


def daily_breakdown(points: list[SeriesPoint]) -> list[dict[str, object]]:
    """Per delivery-day accuracy (spot the days that went wrong)."""
    by_day: dict[date, list[SeriesPoint]] = {}
    for p in points:
        by_day.setdefault(delivery_day(p.target), []).append(p)

    rows = []
    for day in sorted(by_day):
        day_points = by_day[day]
        paired = [p for p in day_points if p.error is not None]
        energy = lambda vals: round(sum(vals) / 2 / 1000, 1)  # half-hourly MW -> GWh  # noqa: E731
        rows.append(
            {
                "day": day.isoformat(),
                "count": len(paired),
                "mae": _clean(fmean(abs(p.error) for p in paired)) if paired else None,  # type: ignore[arg-type]
                "bias": _clean(fmean(p.error for p in paired)) if paired else None,  # type: ignore[misc]
                "actual_gwh": energy([p.actual for p in day_points if p.actual is not None]),
                "mean_actual": _clean(fmean(p.actual for p in day_points if p.actual is not None))
                if any(p.actual is not None for p in day_points)
                else None,
            }
        )
    return rows


def horizon_curve(data: WindDataset, start: date, end: date, max_hours: int = config.MAX_HORIZON_HOURS) -> list[dict[str, object]]:
    """Error statistics grouped by forecast lead time (1-hour buckets).

    Uses *every* forecast run (not just the latest one), so it shows the
    intrinsic skill of WINDFOR at each lead time over the window.
    """
    begin, finish = delivery_window_utc(start, end)
    buckets: dict[int, list[float]] = {h: [] for h in range(max_hours + 1)}
    for target, runs in data.forecasts.items():
        if not (begin <= target < finish) or target not in data.actuals:
            continue
        actual = data.actuals[target]
        for run in runs:
            lead = (target - run.publish_time).total_seconds() / 3600.0
            if 0 <= lead <= max_hours:
                buckets[int(lead)].append(run.generation - actual)

    rows = []
    for hour, errors in buckets.items():
        if not errors:
            continue
        rows.append(
            {
                "lead_hours": hour,
                "count": len(errors),
                "mae": _clean(fmean(abs(e) for e in errors)),
                "bias": _clean(fmean(errors)),
                "p10_error": _clean(percentile(errors, 10)),
                "p90_error": _clean(percentile(errors, 90)),
            }
        )
    return rows


def error_histogram(points: list[SeriesPoint], bin_mw: int = 500) -> list[dict[str, object]]:
    """Distribution of signed errors in ``bin_mw`` wide bins."""
    errors = [p.error for p in points if p.error is not None]
    if not errors:
        return []
    counts: dict[int, int] = {}
    for e in errors:
        b = math.floor(e / bin_mw) * bin_mw  # type: ignore[operator]
        counts[b] = counts.get(b, 0) + 1
    lo, hi = min(counts), max(counts)
    return [{"bin_start": b, "bin_end": b + bin_mw, "count": counts.get(b, 0)} for b in range(lo, hi + bin_mw, bin_mw)]
