"""Vercel serverless entry point.

Vercel's Python runtime serves the ASGI ``app`` object found here. All the
real code lives in ``backend/app``; this file only puts it on the import path.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401
