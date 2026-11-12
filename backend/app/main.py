"""FastAPI application exposing the wind forecast analysis.

Endpoints (all GET, JSON):

* ``/api/health``         liveness probe
* ``/api/meta``           data scope, defaults and snapshot freshness
* ``/api/analysis``       actual vs decision-time forecast, KPIs, daily table, error histogram
* ``/api/horizon-curve``  forecast error by lead time
"""

from __future__ import annotations

from datetime import date, time
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import analysis, config
from .data_store import WindDataset, get_dataset

app = FastAPI(
    title="Wind Forecast Monitor API",
    version="1.0.0",
    description="UK national wind generation: Elexon WINDFOR forecasts vs FUELHH actuals.",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

Dataset = Annotated[WindDataset, Depends(get_dataset)]


def _validate_window(start: date, end: date) -> None:
    if start > end:
        raise HTTPException(422, "start must be on or before end")
    if start < config.SCOPE_START or end > config.SCOPE_END:
        raise HTTPException(422, f"dates must be within {config.SCOPE_START} and {config.SCOPE_END}")


def _parse_gate(gate: str) -> time:
    try:
        return time.fromisoformat(gate)
    except ValueError as exc:
        raise HTTPException(422, "gate must be HH:MM") from exc


def _iso(dt) -> str | None:  # noqa: ANN001
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/meta")
def meta(data: Dataset) -> dict[str, object]:
    return {
        "scope": {"start": config.SCOPE_START.isoformat(), "end": config.SCOPE_END.isoformat()},
        "defaults": {
            "start": config.DEFAULT_START.isoformat(),
            "end": config.DEFAULT_END.isoformat(),
            "mode": "day_ahead",
            "gate": config.DEFAULT_GATE_TIME.strftime("%H:%M"),
            "horizon": 4,
        },
        "max_horizon_hours": config.MAX_HORIZON_HOURS,
        "timezone": "Europe/London",
        "sources": {
            "actuals": {"dataset": "FUELHH", "fuelType": "WIND", "rows": len(data.actuals), "fetchedAt": data.actuals_fetched_at},
            "forecasts": {
                "dataset": "WINDFOR",
                "targets": len(data.forecasts),
                "runs": data.forecast_run_count,
                "fetchedAt": data.forecasts_fetched_at,
            },
        },
    }


@app.get("/api/analysis")
def get_analysis(
    data: Dataset,
    start: date = Query(config.DEFAULT_START, description="First UK delivery day (inclusive)"),
    end: date = Query(config.DEFAULT_END, description="Last UK delivery day (inclusive)"),
    mode: analysis.Mode = Query("day_ahead", description="Decision rule: day_ahead gate or fixed horizon"),
    horizon: float = Query(4.0, ge=0, le=config.MAX_HORIZON_HOURS, description="Lead time in hours (horizon mode)"),
    gate: str = Query("11:00", description="Day-ahead gate closure, UK local HH:MM (day_ahead mode)"),
) -> dict[str, object]:
    _validate_window(start, end)
    gate_time = _parse_gate(gate)
    points = analysis.build_series(data, start, end, mode, horizon, gate_time)

    return {
        "params": {"start": start.isoformat(), "end": end.isoformat(), "mode": mode, "horizon": horizon, "gate": gate_time.strftime("%H:%M")},
        "metrics": analysis.error_metrics(points),
        "series": [
            {
                "t": _iso(p.target),
                "actual": p.actual,
                "forecast": p.forecast,
                "published": _iso(p.publish_time),
                "lead": round(p.lead_hours, 1) if p.lead_hours is not None else None,
                "error": p.error,
            }
            for p in points
        ],
        "daily": analysis.daily_breakdown(points),
        "histogram": analysis.error_histogram(points),
    }


@app.get("/api/horizon-curve")
def get_horizon_curve(
    data: Dataset,
    start: date = Query(config.DEFAULT_START),
    end: date = Query(config.DEFAULT_END),
) -> dict[str, object]:
    _validate_window(start, end)
    return {"params": {"start": start.isoformat(), "end": end.isoformat()}, "rows": analysis.horizon_curve(data, start, end)}
