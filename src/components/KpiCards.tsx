import { fmtGW, fmtHours, fmtPct } from "../format";
import type { Metrics } from "../types";

interface Card {
  label: string;
  value: string;
  note: string;
}

export function KpiCards({ metrics: m }: { metrics: Metrics }) {
  const cards: Card[] = [
    {
      label: "Typical error (MAE)",
      value: fmtGW(m.mae),
      note: `${fmtPct(m.nmae_pct)} of average wind output`,
    },
    {
      label: "Systematic bias",
      value: fmtGW(m.bias, { signed: true }),
      note:
        m.bias === undefined
          ? ""
          : m.bias > 0
            ? `forecast above actual in ${fmtPct(m.under_delivery_share_pct)} of hours`
            : `forecast below actual in ${fmtPct(100 - (m.under_delivery_share_pct ?? 0))} of hours`,
    },
    {
      label: "P90 shortfall cover",
      value: fmtGW(m.shortfall_p90),
      note: "covers wind shortfall in 9 of 10 hours",
    },
    {
      label: "RMSE · fit (R²)",
      value: `${fmtGW(m.rmse)} · ${m.r2?.toFixed(2) ?? "–"}`,
      note: `worst hour ${fmtGW(m.max_abs_error)}`,
    },
    {
      label: "Average lead time",
      value: fmtHours(m.mean_lead_hours),
      note: `${m.count.toLocaleString("en-GB")} hourly targets compared`,
    },
  ];

  return (
    <section className="kpis" aria-label="Forecast accuracy summary">
      {cards.map((c) => (
        <div className="kpi" key={c.label}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-note">{c.note}</div>
        </div>
      ))}
    </section>
  );
}
