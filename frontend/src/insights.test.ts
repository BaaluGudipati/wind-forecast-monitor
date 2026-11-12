import { describe, expect, it } from "vitest";
import { fmtGW, fmtMW } from "./format";
import { buildInsights } from "./insights";
import type { Params } from "./types";

const params: Params = { start: "2026-01-01", end: "2026-01-31", mode: "day_ahead", horizon: 4, gate: "11:00" };

describe("format", () => {
  it("formats GW and MW", () => {
    expect(fmtGW(2107)).toBe("2.1 GW");
    expect(fmtGW(1500, { signed: true })).toBe("+1.5 GW");
    expect(fmtGW(null)).toBe("–");
    expect(fmtMW(12345.4)).toBe("12,345 MW");
  });
});

describe("buildInsights", () => {
  it("returns nothing without paired data", () => {
    expect(buildInsights(params, { count: 0 }, [], [])).toEqual([]);
  });

  it("flags an optimistic bias and names the hardest day", () => {
    const insights = buildInsights(
      params,
      { count: 10, mae: 2000, bias: 1800, nmae_pct: 18, under_delivery_share_pct: 84, shortfall_p90: 4300, mean_lead_hours: 26 },
      [
        { day: "2026-01-05", count: 24, mae: 900, bias: 100, actual_gwh: 300, mean_actual: 12000 },
        { day: "2026-01-06", count: 24, mae: 5000, bias: 4800, actual_gwh: 200, mean_actual: 8000 },
      ],
      [],
    );
    const titles = insights.map((i) => i.title);
    expect(titles).toContain("Forecasts run optimistic");
    expect(insights.find((i) => i.title === "Hardest day")?.body).toContain("6 Jan");
    expect(insights.find((i) => i.title === "Shortfall cover (P90)")?.body).toContain("4.3 GW");
  });
});
