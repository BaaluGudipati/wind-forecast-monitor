"""Unit tests for the forecast-selection rules and metrics (synthetic data)."""

from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest

from app import analysis
from app.data_store import ForecastPoint, WindDataset


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


@pytest.fixture()
def dataset() -> WindDataset:
    """Two targets on 10 Jan 2026 with forecast runs published at different times."""
    t1 = utc(2026, 1, 10, 12)
    t2 = utc(2026, 1, 10, 13)
    return WindDataset(
        actuals={t1: 10_000.0, utc(2026, 1, 10, 12, 30): 10_200.0, t2: 9_000.0},
        forecasts={
            t1: [
                ForecastPoint(utc(2026, 1, 8, 12), 13_000.0),  # 2 days earlier
                ForecastPoint(utc(2026, 1, 9, 10, 30), 12_000.0),  # before 11:00 gate on D-1
                ForecastPoint(utc(2026, 1, 9, 11, 30), 11_000.0),  # after gate
                ForecastPoint(utc(2026, 1, 10, 9), 10_500.0),  # 3h ahead
            ],
            t2: [ForecastPoint(utc(2026, 1, 9, 10, 30), 8_000.0)],
        },
    )


def test_day_ahead_uses_latest_run_before_gate(dataset: WindDataset) -> None:
    points = analysis.build_series(dataset, date(2026, 1, 10), date(2026, 1, 10), "day_ahead", gate=time(11, 0))
    p = next(p for p in points if p.target == utc(2026, 1, 10, 12))
    assert p.forecast == 12_000.0
    assert p.publish_time == utc(2026, 1, 9, 10, 30)
    assert p.error == 2_000.0


def test_horizon_mode_respects_lead_time(dataset: WindDataset) -> None:
    target = utc(2026, 1, 10, 12)
    by_horizon = {
        h: next(p for p in analysis.build_series(dataset, date(2026, 1, 10), date(2026, 1, 10), "horizon", h) if p.target == target)
        for h in (0, 3, 4, 30, 60)
    }
    assert by_horizon[0].forecast == 10_500.0
    assert by_horizon[3].forecast == 10_500.0  # published exactly 3h before -> allowed
    assert by_horizon[4].forecast == 11_000.0
    assert by_horizon[30].forecast == 13_000.0
    assert by_horizon[60].forecast is None  # nothing that early


def test_half_hour_targets_carry_actual_only(dataset: WindDataset) -> None:
    points = analysis.build_series(dataset, date(2026, 1, 10), date(2026, 1, 10), "horizon", 0)
    half = next(p for p in points if p.target.minute == 30)
    assert half.actual == 10_200.0 and half.forecast is None and half.error is None


def test_metrics(dataset: WindDataset) -> None:
    points = analysis.build_series(dataset, date(2026, 1, 10), date(2026, 1, 10), "day_ahead")
    m = analysis.error_metrics(points)
    # errors: +2000 (t1), -1000 (t2)
    assert m["count"] == 2
    assert m["mae"] == 1500.0
    assert m["bias"] == 500.0
    assert m["rmse"] == pytest.approx(1581.1, abs=0.1)
    assert m["error_std"] == 1500.0
    assert m["under_delivery_share_pct"] == 50.0


def test_metrics_empty() -> None:
    assert analysis.error_metrics([]) == {"count": 0}


def test_percentile_matches_numpy_linear() -> None:
    values = [1.0, 2.0, 3.0, 4.0]
    assert analysis.percentile(values, 50) == 2.5
    assert analysis.percentile(values, 90) == pytest.approx(3.7)
    assert analysis.percentile(values, 0) == 1.0


def test_gate_is_uk_local_time_in_summer() -> None:
    # During BST (UTC+1) an 11:00 UK gate is 10:00 UTC.
    cutoff = analysis.decision_cutoff(utc(2026, 7, 10, 12), "day_ahead", gate=time(11, 0))
    assert cutoff == utc(2026, 7, 9, 10)


def test_horizon_curve_buckets(dataset: WindDataset) -> None:
    rows = analysis.horizon_curve(dataset, date(2026, 1, 10), date(2026, 1, 10))
    by_lead = {r["lead_hours"]: r for r in rows}
    assert by_lead[3]["mae"] == 500.0  # 10_500 vs 10_000
    assert 48 in by_lead  # 2-day-old run, lead exactly 48h
