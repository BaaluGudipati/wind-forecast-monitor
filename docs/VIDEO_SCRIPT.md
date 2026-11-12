# Video script (max 10 minutes total)

Recording tips:
- Use **OBS Studio** (free) or the **Windows Game Bar** (`Win + Alt + R`) to record the screen and your mic.
- Use a 1920×1080 browser window and zoom to 110–125% so the text is easy to read.
- Have the live Vercel app open, plus VS Code with the repo and the GitHub repo page in other tabs.
- Read the lines below naturally. It is fine to rephrase. **[Brackets]** tell you what to click.
- Upload to YouTube with **Visibility: Unlisted**.

---

## PART 1: Client presentation (about 4.5 minutes)

**0:00 – Opening** [App open at the top of the page]
> "Hello, and thank you for your time. Over the pilot we built the **Wind Forecast Monitor** for your day-ahead trading team. Every day you have to decide how much power to buy for tomorrow. Wind is a big part of supply and it depends on the weather, so that decision rests on a wind forecast. This tool answers two questions: **which forecast did I actually have when I decided**, and **how much can I trust it?**"

**0:30 – Decision-time forecast** [Point at the controls]
> "At the top, choose the delivery days. By default we use the rule that matches your process: the forecast available at the **11:00 day-ahead gate on the day before delivery**. You can change the gate time here." [Change the gate to 14:00 and back to 11:00]
> "Data comes directly from Elexon: actual wind output from FUELHH and the official wind forecasts from WINDFOR, 280 forecast runs for January 2026."

**1:00 – Main chart** [Scroll to the chart; hover over a point]
> "Blue is what the wind actually generated; orange is the forecast you had at decision time. Hover on any hour to see the exact forecast, when it was published, and how many hours ahead. You can zoom into a period with the slider below." [Drag the brush to zoom into roughly 26–29 Jan]

**1:45 – The key finding** [Scroll up to the KPI cards and insights]
> "Here's what January tells us. The typical miss is **2.1 gigawatts**, about 18% of average wind output. More importantly, the forecast was **too high in 84% of hours**, by **1.8 GW on average**. So if you take the forecast at face value, you will usually **under-buy**, and then top up closer to delivery, often at higher prices."

**2:30 – Turning error into a decision** [Point at the P90 card; turn the P90 planning line on and off]
> "To make this actionable we show the **P90 shortfall**: in 9 out of 10 hours, wind fell short by no more than **4.4 GW**. The dashed line on the chart is the forecast minus that buffer, a conservative planning level you can buy against."

**3:05 – Lead time** [Switch to "Fixed lead time", move the slider from 1 to 48]
> "You can also see how accuracy changes with lead time. Error grows from about 1.8 GW one hour ahead to 2.4 GW two days ahead. Interestingly, even very late forecasts stay about 1.6 GW high. That means a big part of the error is **systematic, so it can be corrected**, which is a clear opportunity." [Scroll to the error-vs-lead chart and the histogram]

**3:45 – Day-by-day** [Scroll to the table; click Download CSV]
> "The daily table highlights the hardest days, such as 28 January with a 5.3 GW average miss, and everything can be exported to Excel."

**4:05 – Close**
> "So, in one screen your team sees the forecast they really had, how reliable it is, and how much cover to hold. The natural next steps are a live view for tomorrow, adding solar, and a bias-corrected forecast tested against prices. Thank you. Happy to take questions."

---

## PART 2: Technical walkthrough for the tech lead (about 4.5 minutes)

**0:00 – Architecture** [Open `docs/ARCHITECTURE.md` diagram]
> "This is the technical overview. The stack is a **React + TypeScript** frontend built with Vite and Recharts, and a **Python FastAPI** backend. It runs locally with **Docker Compose** and is deployed on **Vercel**: the React build is static, and FastAPI runs as a Python serverless function behind `/api`."

**0:35 – Data** [Open `backend/app/elexon.py` and `scripts/fetch_data.py`]
> "Data comes from two Elexon streams: FUELHH filtered to WIND, and WINDFOR. A fetch script pulls January's scope in weekly chunks, de-duplicates it, and saves a compact JSON snapshot. I chose a snapshot because the scope is a fixed historical month. It makes the app fast, deterministic, and independent of Elexon uptime. In production this would be a scheduled job writing to a database behind the same interface."

**1:15 – Core logic** [Open `backend/app/analysis.py`, `decision_cutoff` and `build_series`]
> "The key business rule is here. For each target time we compute a **cutoff**: either the gate time in UK local time on the day before delivery, or the target minus a fixed lead time. Then we take the **latest forecast published at or before the cutoff**. `data_store.py` indexes runs by target with sorted publish times, so this is a binary search. Time zones are handled with `Europe/London`, so BST works too. Actuals are half-hourly and forecasts hourly; I deliberately don't interpolate, so every number shown was really published."

**2:05 – Metrics** [Scroll to `error_metrics` and `horizon_curve`]
> "Error is forecast minus actual, so a positive error means a shortfall, the side that costs money. We compute MAE, RMSE, bias, error spread, R², and P10/P90 percentiles, and turn the P90 into a cover volume. The horizon curve groups every run by lead time to show how skill decays."

**2:40 – API and frontend** [Open `main.py`, then `frontend/src/App.tsx` and `components/`]
> "The API layer is thin: it validates inputs, such as dates within scope, horizon 0 to 48, and gate format, and shapes JSON. On the frontend, settings live in the URL so views are shareable; requests are debounced and cancelled when settings change. Components are split by concern: controls, KPI cards, three charts, and the daily table. The palette is colourblind-checked, with light and dark themes."

**3:20 – Quality** [Run `pytest -q` in a terminal; show `.github/workflows/ci.yml`]
> "Unit tests use synthetic data with hand-computed answers for the selection rules, including edge cases like an exact boundary, nothing published early enough, and the summer-time gate. API tests run against the real snapshot. CI runs backend tests, frontend tests and build, and the Docker build on every push."

**3:55 – Wrap-up** [Show the README]
> "The README explains the layout, how to run it with Docker or locally, and the assumptions. AI assistance with Claude Code was used and is declared there. Next steps would be a scheduled data refresh, a live tomorrow view, and a bias-corrected forecast. Thanks for reviewing."
