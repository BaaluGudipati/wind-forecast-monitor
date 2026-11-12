// Response shapes of the FastAPI backend (see backend/app/main.py).

export type Mode = "day_ahead" | "horizon";

export interface Params {
  start: string;
  end: string;
  mode: Mode;
  horizon: number;
  gate: string;
}

export interface Meta {
  scope: { start: string; end: string };
  defaults: Params;
  max_horizon_hours: number;
  timezone: string;
  sources: {
    actuals: { dataset: string; fuelType: string; rows: number; fetchedAt: string };
    forecasts: { dataset: string; targets: number; runs: number; fetchedAt: string };
  };
}

export interface Metrics {
  count: number;
  mae?: number;
  rmse?: number;
  bias?: number;
  error_std?: number;
  nmae_pct?: number;
  r2?: number;
  p50_abs_error?: number;
  p90_abs_error?: number;
  max_abs_error?: number;
  p10_error?: number;
  p90_error?: number;
  shortfall_p90?: number;
  under_delivery_share_pct?: number;
  mean_actual?: number;
  mean_lead_hours?: number;
}

export interface SeriesPoint {
  t: string;
  actual: number | null;
  forecast: number | null;
  published: string | null;
  lead: number | null;
  error: number | null;
}

export interface DailyRow {
  day: string;
  count: number;
  mae: number | null;
  bias: number | null;
  actual_gwh: number;
  mean_actual: number | null;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface Analysis {
  params: Params;
  metrics: Metrics;
  series: SeriesPoint[];
  daily: DailyRow[];
  histogram: HistogramBin[];
}

export interface HorizonRow {
  lead_hours: number;
  count: number;
  mae: number;
  bias: number;
  p10_error: number;
  p90_error: number;
}
