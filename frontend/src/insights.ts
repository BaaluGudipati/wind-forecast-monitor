// Turns the numbers into plain-English takeaways for the trading desk.

import { fmtGW, fmtHours, fmtLongDay, fmtPct } from "./format";
import type { DailyRow, HorizonRow, Metrics, Params } from "./types";

export interface Insight {
  tone: "info" | "warning";
  title: string;
  body: string;
}

function nearest(rows: HorizonRow[], hours: number): HorizonRow | undefined {
  return rows.reduce<HorizonRow | undefined>(
    (best, r) => (!best || Math.abs(r.lead_hours - hours) < Math.abs(best.lead_hours - hours) ? r : best),
    undefined,
  );
}

export function buildInsights(params: Params, m: Metrics, daily: DailyRow[], curve: HorizonRow[]): Insight[] {
  if (!m.count || m.mae === undefined) return [];
  const out: Insight[] = [];
  const decision =
    params.mode === "day_ahead" ? `forecasts available at the ${params.gate} day-ahead gate` : `forecasts made ${params.horizon} h ahead`;

  out.push({
    tone: "info",
    title: "Typical miss",
    body: `Using ${decision} (on average ${fmtHours(m.mean_lead_hours)} before delivery), wind came in ${fmtGW(m.mae)} away from forecast in a typical hour — ${fmtPct(m.nmae_pct)} of average wind output.`,
  });

  if (m.bias !== undefined && m.under_delivery_share_pct !== undefined && Math.abs(m.bias) >= 250) {
    const over = m.bias > 0;
    out.push({
      tone: "warning",
      title: over ? "Forecasts run optimistic" : "Forecasts run pessimistic",
      body: over
        ? `Wind delivered less than forecast in ${fmtPct(m.under_delivery_share_pct)} of hours, by ${fmtGW(m.bias)} on average. Taking the raw forecast at face value would systematically under-buy.`
        : `Wind delivered more than forecast in ${fmtPct(100 - m.under_delivery_share_pct)} of hours, by ${fmtGW(-m.bias)} on average. Taking the raw forecast at face value would systematically over-buy.`,
    });
  }

  if (m.shortfall_p90 !== undefined) {
    out.push({
      tone: "info",
      title: "Shortfall cover (P90)",
      body: `In 90% of hours, wind fell short of the forecast by no more than ${fmtGW(m.shortfall_p90)}. Holding about this much extra cover protects against all but the worst 1-in-10 hours.`,
    });
  }

  const worst = daily.filter((d) => d.mae !== null).sort((a, b) => (b.mae ?? 0) - (a.mae ?? 0))[0];
  if (worst) {
    out.push({
      tone: "info",
      title: "Hardest day",
      body: `${fmtLongDay(worst.day)} had the largest misses: ${fmtGW(worst.mae)} on average (bias ${fmtGW(worst.bias, { signed: true })}).`,
    });
  }

  const h1 = nearest(curve, 1);
  const h24 = nearest(curve, 24);
  const h48 = nearest(curve, 48);
  if (h1 && h24 && h48) {
    const offsetDominates = m.bias !== undefined && m.error_std !== undefined && Math.abs(m.bias) > m.error_std;
    out.push({
      tone: "info",
      title: "Value of waiting",
      body:
        `Typical error grows from ${fmtGW(h1.mae)} one hour ahead to ${fmtGW(h24.mae)} at 24 h and ${fmtGW(h48.mae)} at 48 h.` +
        (offsetDominates
          ? ` Even late forecasts carry a similar offset, so a large part of the miss is systematic and can be corrected for.`
          : ""),
    });
  }
  return out;
}
