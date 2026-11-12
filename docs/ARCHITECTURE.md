# Architecture and design notes

Audience: the technical lead reviewing this pilot.

## 1. Overview

```
 Elexon BMRS API                     Backend (Python, FastAPI)                       Frontend (React + TS)
 ─────────────────                   ───────────────────────────────────            ─────────────────────────
 FUELHH  (wind outturn)  ─┐          scripts/fetch_data.py                          Controls (dates, rule, gate/lead)
                          ├─fetch──▶   └─▶ data/*.json  (snapshot)                        │  URL-synced params
 WINDFOR (wind forecasts) ┘                      │                                        ▼
                                     data_store.py  load once, index by target    api.ts ── GET /api/analysis
                                                 │                                        GET /api/horizon-curve
                                     analysis.py   pure functions:                        │
                                       • decision_cutoff()  (gate / lead time)            ▼
                                       • build_series()     latest run ≤ cutoff      KPI cards · insights
                                       • error_metrics()    MAE, bias, P90 …         Actual-vs-forecast chart
                                       • horizon_curve()    error by lead time       Error-vs-lead chart
                                       • daily_breakdown(), error_histogram()        Histogram · daily table
                                                 │
                                     main.py  HTTP layer: validation, JSON shaping
```

Deployment: Vercel serves `frontend/dist` as static files. `api/index.py` exposes the same FastAPI app as a Python serverless function, and `/api/*` is rewritten to it. Locally, `docker compose` runs the API (uvicorn) and the web container (nginx proxying `/api`).

## 2. Core business rule: which forecast counts?

WINDFOR publishes about 8 runs per day. Each run covers hourly targets from the recent past up to about 66 h ahead. For a target time *t*, many forecasts exist. The trader can only use those **published before they had to decide**:

| Mode | Cutoff for target *t* | Use |
|---|---|---|
| `day_ahead` (default) | `gate` (UK local, default 11:00) on the day **before** *t*'s UK delivery day | Mirrors the GB day-ahead auction |
| `horizon` | `t − h` hours | Shows how skill decays with lead time |

The selected forecast is the **latest run with `publishTime ≤ cutoff`**. `WindDataset` keeps, for each target, the run publish times sorted, so the lookup is a `bisect` (O(log n)).

Edge cases handled:
- **Time zones:** delivery days and the gate are in `Europe/London` (handles BST/GMT; there's a unit test for summer). API timestamps are UTC.
- **Resolution mismatch:** FUELHH is half-hourly and WINDFOR is hourly. Half-past slots show the actual only, and metrics use hourly pairs. There is no interpolation, so every forecast number was really published.
- **No forecast early enough:** the target has `forecast = null` and is excluded from metrics (tested).
- **Negative lead runs** (WINDFOR includes recent-past targets) are excluded from the horizon curve (`0 ≤ lead ≤ 48`).

## 3. Metrics (`analysis.error_metrics`)

`error = forecast − actual` (positive means wind under-delivered, so buy more).

| Metric | Why it is there |
|---|---|
| MAE, nMAE (% of mean actual) | Typical miss, in MW and relative terms |
| Bias (mean error), share of hours under-delivered | Systematic offset; drives a correction policy |
| Error std-dev | Spread after removing bias (offset vs noise) |
| RMSE, R² | Standard skill scores; RMSE penalises big misses |
| P10 / P90 signed error, **P90 shortfall** | Translates error into a cover volume: "hold X GW to be covered in 9 of 10 hours" |
| P50/P90 absolute error, max | Tail risk |
| Mean lead time | What "day-ahead" means in hours for the selected rule |

The percentile uses linear interpolation (same as NumPy's default), implemented in pure Python. A unit test checks it.

## 4. Key design decisions and trade-offs

1. **Snapshot data instead of calling Elexon on every request.** The scope is a fixed historical month (~2.6 MB raw). Bundling a snapshot makes the deployed app fast, deterministic for the demo, and independent of Elexon uptime and rate limits. `scripts/fetch_data.py` refreshes it, and `config.py` defines the scope. *Next step for production:* a scheduled job (cron or Vercel cron) writing to Postgres or object storage, with the same `WindDataset` interface.
2. **Pure-Python analysis, no pandas.** The data is small and the logic is clear without a DataFrame. This keeps the serverless bundle tiny (fast cold starts) and the functions easy to unit-test with synthetic data. Moving to pandas or Polars would be easy if volumes grow, for example to all fuel types or multiple years.
3. **Thin HTTP layer.** `main.py` only validates input (date scope, horizon range, `HH:MM` gate) and shapes JSON. All logic is in `analysis.py`, which has no I/O.
4. **One endpoint per screen concern.** `/api/analysis` returns series, KPIs, daily rows and histogram in one call (one round-trip per settings change). `/api/horizon-curve` depends only on dates, so it is separate.
5. **Frontend state in the URL.** Settings live in the query string, so any view can be shared as a link. Requests are debounced (slider) and cancelled with `AbortController` when settings change.
6. **Chart design.** A colourblind-validated palette (blue = actual, orange = forecast), light and dark themes, legends plus tooltips, a single Y-axis per chart, and a brush to zoom.

## 5. Quality practices

- **Tests:** `backend/tests/test_analysis.py` covers the selection rules (gate, lead time, boundary equality, nothing-early-enough, BST gate) and the metrics, using synthetic data with hand-computed answers. `test_api.py` covers the real snapshot (full January coverage, day-ahead lead ≥ 13 h, shorter horizon is more accurate, and validation errors return 422). Frontend: `insights.test.ts`.
- **Types:** Python type hints throughout; TypeScript `strict`; API response types in `types.ts`.
- **CI:** GitHub Actions runs the backend tests, the frontend tests and build, and the `docker compose build`.
- **Config in one place:** `backend/app/config.py`.
- **Reproducibility:** pinned dependency versions; `package-lock.json`.

## 6. API reference

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/health` | – | `{status: "ok"}` |
| `GET /api/meta` | – | scope, defaults, data source row counts and fetch time |
| `GET /api/analysis` | `start`, `end` (UK delivery dates), `mode` (`day_ahead`/`horizon`), `horizon` (0–48), `gate` (`HH:MM`) | `params`, `metrics`, `series[]`, `daily[]`, `histogram[]` |
| `GET /api/horizon-curve` | `start`, `end` | error stats per lead hour 0–48 |

Interactive docs: `/docs` (Swagger UI) when running the backend.

## 7. Known limitations and next steps

- Historical snapshot only; add a scheduled refresh and a "latest forecast for tomorrow" live view.
- National total only; could break down by region or BM unit if the brief allows.
- Possible causes of the systematic bias (see ANALYSIS.md), such as curtailment or metering scope, are hypotheses that need validating with other data. They are out of scope here.
- Add a bias-corrected forecast and a probabilistic procurement recommendation, back-tested against prices.
- Auth and multi-user settings are not needed for the pilot.
