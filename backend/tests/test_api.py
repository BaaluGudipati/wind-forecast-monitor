"""API tests against the bundled January 2026 snapshot."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta_describes_scope() -> None:
    body = client.get("/api/meta").json()
    assert body["scope"] == {"start": "2026-01-01", "end": "2026-02-01"}
    assert body["sources"]["forecasts"]["runs"] > 200


def test_analysis_default_is_full_january() -> None:
    body = client.get("/api/analysis").json()
    assert body["params"]["mode"] == "day_ahead"
    assert len(body["series"]) == 31 * 48  # every half-hour in January
    assert body["metrics"]["count"] == 31 * 24  # hourly forecast targets
    # Day-ahead forecasts must have been published before the 11:00 gate on D-1.
    for point in body["series"]:
        if point["lead"] is not None:
            assert point["lead"] >= 13


def test_shorter_horizon_is_more_accurate() -> None:
    near = client.get("/api/analysis", params={"mode": "horizon", "horizon": 1}).json()["metrics"]
    far = client.get("/api/analysis", params={"mode": "horizon", "horizon": 36}).json()["metrics"]
    assert near["mae"] < far["mae"]


def test_validation_errors() -> None:
    assert client.get("/api/analysis", params={"start": "2025-12-01"}).status_code == 422
    assert client.get("/api/analysis", params={"start": "2026-01-10", "end": "2026-01-05"}).status_code == 422
    assert client.get("/api/analysis", params={"horizon": 99}).status_code == 422
    assert client.get("/api/analysis", params={"gate": "noon"}).status_code == 422


def test_horizon_curve() -> None:
    rows = client.get("/api/horizon-curve").json()["rows"]
    assert rows[0]["lead_hours"] == 0
    assert rows[-1]["lead_hours"] <= 48
