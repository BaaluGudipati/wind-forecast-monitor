# Wind Forecast Monitor

A web app for a UK utility's day-ahead power trading team. It shows **which national wind forecast was available when a purchase decision had to be made**, and **how accurate those forecasts turned out to be**, for purchase decisions made in **January 2026**.

- **Live app:** <https://wind-forecast-monitor-rho-two.vercel.app/>
- **Data:** Elexon BMRS: [`FUELHH`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) (actual wind generation) and [`WINDFOR`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) (wind forecasts)
- **Stack:** React + TypeScript (Vite, Recharts) frontend · Python FastAPI backend · Docker · Vercel

---

## What the app does

| Need (from the brief) | How the app answers it |
|---|---|
| 1. Understand the latest forecast available at decision time | For every target hour, the app picks the **latest WINDFOR run published at or before the decision time**. There are two rules: **Day-ahead gate** (default 11:00 UK on the day before delivery, configurable) or a **fixed lead time** (0–48 h slider). The main chart shows that forecast next to the actual outturn. The tooltip shows when each forecast was published and how far ahead. |
| 2. Quantify forecast accuracy | KPI cards show MAE, bias, P90 shortfall cover, RMSE, R² and average lead time. Plain-English insights summarise them. There is an **error-vs-lead-time** curve with a P10–P90 band, an **error distribution** histogram, and a **day-by-day** table (exportable to CSV). |

**Headline result (11:00 day-ahead gate, all of January 2026):** typical error (MAE) **2.1 GW**, which is 18% of average wind output. Forecasts were **higher than actual in 84% of hours, by +1.8 GW on average**. Covering 9 out of 10 hours needs about **4.4 GW** of shortfall cover. See [docs/ANALYSIS.md](docs/ANALYSIS.md).

---

## Repository layout

```
.
├── api/
│   └── index.py              Vercel serverless entry point (re-exports the FastAPI app)
├── backend/                  Python backend (FastAPI)
│   ├── app/
│   │   ├── config.py         Scope, market settings (gate time, timezone), paths
│   │   ├── elexon.py         Elexon BMRS API client (FUELHH, WINDFOR)
│   │   ├── data_store.py     Loads the data snapshot; indexes forecasts by target time
│   │   ├── analysis.py       Business logic: forecast selection + accuracy metrics (pure functions)
│   │   └── main.py           HTTP API: /api/meta, /api/analysis, /api/horizon-curve, /api/health
│   ├── data/                 Snapshot of January 2026 Elexon data (JSON)
│   ├── scripts/fetch_data.py Refreshes the snapshot from the Elexon API
│   ├── tests/                pytest unit tests (synthetic data) + API tests (real snapshot)
│   ├── Dockerfile
│   └── requirements*.txt
├── frontend/                 React + TypeScript single-page app (Vite)
│   ├── src/
│   │   ├── App.tsx           Page layout, data loading, URL-synced settings
│   │   ├── api.ts            Typed API client
│   │   ├── types.ts          API response types
│   │   ├── insights.ts       Turns metrics into plain-English takeaways (+ tests)
│   │   ├── format.ts         GW/MW/time formatting (UK local time)
│   │   ├── components/       Controls, KPI cards, charts, daily table
│   │   └── styles.css        Design tokens (light + dark), layout
│   ├── Dockerfile            Multi-stage build → nginx (serves the SPA, proxies /api)
│   └── nginx.conf
├── docs/
│   ├── ARCHITECTURE.md       Design and implementation notes for technical review
│   ├── ANALYSIS.md           Findings from the January 2026 data
│   ├── VIDEO_SCRIPT.md       Script for the two-part demo video
│   └── DEPLOYMENT.md         Step-by-step GitHub + Vercel deployment
├── .github/workflows/ci.yml  CI: backend tests, frontend tests + build, Docker build
├── docker-compose.yml        Runs the full stack locally
├── vercel.json               Vercel build + routing config
└── requirements.txt          Python dependencies for the Vercel function
```

---

## How to run it

### Option A: Docker (recommended)

```bash
docker compose up --build
```

Open <http://localhost:8080>. The API is also exposed at <http://localhost:8000/docs> (interactive Swagger UI).

### Option B: Run locally without Docker

Prerequisites: Python 3.10+ and Node 20+.

```bash
# Backend (terminal 1)
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt        # Windows: .venv\Scripts\pip
.venv/bin/uvicorn app.main:app --reload --port 8000  # Windows: .venv\Scripts\uvicorn
```

```bash
# Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to port 8000.

> **Windows tip:** if port 8000 fails with `WinError 10013`, the port is reserved by Windows. Start the backend with `--port 8001` and the frontend with `$env:API_PROXY_TARGET="http://localhost:8001"; npm run dev` (PowerShell).

### Tests

```bash
cd backend && pytest -q          # 14 tests: selection rules, metrics, API validation
cd frontend && npm test          # insight + formatting tests
```

### Refresh the data snapshot

```bash
cd backend && python -m scripts.fetch_data
```

This pulls FUELHH (wind) and WINDFOR from Elexon for the configured scope (`app/config.py`) and rewrites `backend/data/*.json`.

---

## Deployment

The app is deployed on **Vercel** as one project. The React build is served as static files, and the FastAPI app runs as a Python serverless function (`api/index.py`). `vercel.json` rewrites `/api/*` to it. Step-by-step instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Key assumptions

- **Decision rule:** the GB day-ahead auction closes around 11:00 UK time on the day before delivery. The gate time can be changed in the UI.
- **Scope:** purchase decisions made in January 2026, meaning delivery days 1 Jan – 1 Feb 2026. The default view is 1–31 Jan.
- **Resolution:** actuals are half-hourly and WINDFOR targets are hourly. Accuracy is measured on the hourly points where both exist. Forecasts are **not** interpolated, so every number shown was actually published by Elexon.
- **Error sign:** `error = forecast − actual`. Positive means wind under-delivered, so the team would have to buy more.
- National level only; no data source other than these two Elexon datasets.

---

## Use of AI tools

This project was built with help from **Claude Code (Anthropic)**, an AI coding assistant. It was used to explore the Elexon APIs, scaffold and write the backend and frontend code, write tests, and draft the documentation and video script. All design decisions, outputs and numbers were reviewed and checked by running the app and the test suites.
