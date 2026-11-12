"""Central configuration for the wind forecast monitor backend.

Everything that defines the *scope* of the pilot lives here so that it can be
reviewed (and changed) in one place.
"""

from __future__ import annotations

import os
from datetime import date, time
from pathlib import Path
from zoneinfo import ZoneInfo

# --- Market / domain settings -------------------------------------------------

#: GB power market local time. Delivery days and the day-ahead gate are local.
UK_TZ = ZoneInfo("Europe/London")

#: Default day-ahead auction gate closure (GB day-ahead auctions close ~11:00
#: UK time on the day before delivery). Configurable from the UI.
DEFAULT_GATE_TIME = time(11, 0)

#: Pilot scope: purchase decisions made in January 2026. A decision taken on
#: 31 Jan is for delivery on 1 Feb, so data covers delivery 1 Jan - 1 Feb.
SCOPE_START = date(2026, 1, 1)
SCOPE_END = date(2026, 2, 1)  # inclusive (UK local delivery day)

#: Default analysis window shown in the UI (all January delivery days).
DEFAULT_START = date(2026, 1, 1)
DEFAULT_END = date(2026, 1, 31)

#: Forecast horizons analysed in the "error vs lead time" view (hours).
MAX_HORIZON_HOURS = 48

# --- Elexon BMRS API ---------------------------------------------------------

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")

# --- Data snapshot -------------------------------------------------------------

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
ACTUALS_FILE = DATA_DIR / "actuals_wind.json"
FORECASTS_FILE = DATA_DIR / "forecasts_wind.json"

# --- HTTP ---------------------------------------------------------------------

#: Comma separated list of origins allowed to call the API (local dev).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
