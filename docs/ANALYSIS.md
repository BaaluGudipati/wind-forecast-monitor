# Findings: GB national wind forecasts, January 2026

Data: Elexon WINDFOR (280 forecast runs) vs FUELHH wind outturn, delivery days 1–31 Jan 2026, 744 hourly targets.
Error = forecast − actual (positive means wind came in below forecast).

## 1. Day-ahead decision (11:00 UK gate on the day before)

| Metric | Value |
|---|---|
| Average lead time of the forecast used | 26 h |
| Typical error (MAE) | **2.1 GW** (18% of mean wind output of 11.6 GW) |
| Bias | **+1.8 GW**: forecast above actual in **84%** of hours |
| Error spread after removing bias (std-dev) | 1.85 GW |
| RMSE · R² | 2.6 GW · 0.60 |
| P90 shortfall (cover needed for 9 of 10 hours) | **4.4 GW** |
| Worst single hour | 6.9 GW |

**What it means for buying:** the raw forecast is optimistic. If the desk subtracts the forecast from demand and buys the rest, it will usually **under-buy** and have to top up later, often at worse prices. A bias correction of about 1.8 GW, plus a risk buffer sized from the P90 shortfall, is a simple first policy to test.

## 2. Does the gate time matter?

| Gate (day before) | Mean lead | MAE | Bias | P90 shortfall |
|---|---|---|---|---|
| 09:00 | 28 h | 2.13 GW | +1.85 GW | 4.3 GW |
| 11:00 | 26 h | 2.11 GW | +1.84 GW | 4.4 GW |
| 14:00 | 24 h | 2.01 GW | +1.81 GW | 4.0 GW |

Using a later forecast helps a little, but the bias barely changes.

## 3. Error vs lead time (fixed-lead-time mode)

| Lead time | MAE | Bias | R² |
|---|---|---|---|
| ~1 h | 1.80 GW | +1.60 GW | 0.70 |
| 4 h | 1.84 GW | +1.64 GW | 0.69 |
| 12 h | 1.90 GW | +1.70 GW | 0.67 |
| 24 h | 2.05 GW | +1.85 GW | 0.63 |
| 36 h | 2.26 GW | +1.95 GW | 0.56 |
| 48 h | 2.38 GW | +1.88 GW | 0.51 |

Error grows with lead time, as expected. But even a forecast made **1 hour ahead is still ~1.6 GW above outturn**. That suggests a **structural difference between the two datasets**, not only weather-forecast skill. Plausible reasons:
- curtailment (wind farms told to reduce output, for example because of grid constraints), which a weather-based forecast does not anticipate;
- differences in which wind farms each dataset covers (for example, metered vs embedded generation).

These are hypotheses to confirm with the client. Either way, the bias is stable and **correctable**.

## 4. Day-to-day variation

- Hardest days (day-ahead MAE): **28 Jan (5.3 GW)**, **11 Jan (4.9 GW)**, **12 Jan (4.9 GW)**, all strongly over-forecast.
- Best days: 19 Jan (0.75 GW), 9 Jan (0.83 GW), 4 Jan (0.85 GW).

Large misses cluster on high-wind days, which is when curtailment is also most likely.

## 5. Suggested next steps for the client

1. Use the day-ahead view as the daily briefing: forecast, P90 planning level, and recent bias.
2. Pilot a **bias-corrected forecast** and back-test procurement cost against day-ahead and imbalance prices.
3. Extend to solar and to a live "tomorrow" view with automatic refresh.
