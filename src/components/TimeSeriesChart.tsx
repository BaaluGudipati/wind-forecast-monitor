import { useMemo, useState } from "react";
import { Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { fmtDateTime, fmtDay, fmtHours, fmtMW } from "../format";
import type { SeriesPoint } from "../types";

interface Row {
  ts: number;
  actual: number | null;
  forecast: number | null;
  planning: number | null;
  published: string | null;
  lead: number | null;
  error: number | null;
}

interface Props {
  series: SeriesPoint[];
  shortfallP90?: number;
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{fmtDateTime(row.ts)}</div>
      <div className="tooltip-row">
        <span className="swatch" style={{ background: "var(--series-1)" }} /> Actual <b>{fmtMW(row.actual)}</b>
      </div>
      <div className="tooltip-row">
        <span className="swatch" style={{ background: "var(--series-2)" }} /> Forecast <b>{fmtMW(row.forecast)}</b>
      </div>
      {row.error !== null && (
        <div className="tooltip-row muted">
          Error (forecast − actual) <b>{fmtMW(row.error, { signed: true })}</b>
        </div>
      )}
      {row.published && (
        <div className="tooltip-row muted">
          Published {fmtDateTime(row.published)} · {fmtHours(row.lead)} ahead
        </div>
      )}
      {row.forecast === null && <div className="tooltip-row muted">Half-hour slot: WINDFOR forecasts are hourly</div>}
    </div>
  );
}

export function TimeSeriesChart({ series, shortfallP90 }: Props) {
  const [showPlanning, setShowPlanning] = useState(true);

  const rows = useMemo<Row[]>(
    () =>
      series.map((p) => ({
        ts: Date.parse(p.t),
        actual: p.actual,
        forecast: p.forecast,
        planning: p.forecast !== null && shortfallP90 !== undefined ? Math.max(0, p.forecast - shortfallP90) : null,
        published: p.published,
        lead: p.lead,
        error: p.error,
      })),
    [series, shortfallP90],
  );

  // One tick per day (or fewer for long ranges), aligned to midnight UTC (= UK midnight in winter).
  const ticks = useMemo(() => {
    if (!rows.length) return [];
    const days = Math.max(1, Math.round((rows[rows.length - 1].ts - rows[0].ts) / 86_400_000));
    const step = Math.ceil(days / 12);
    return rows.filter((r) => r.ts % 86_400_000 === 0).filter((_, i) => i % step === 0).map((r) => r.ts);
  }, [rows]);

  // Round GW gridlines (every 5 GW).
  const yTicks = useMemo(() => {
    const max = Math.max(5000, ...rows.map((r) => Math.max(r.actual ?? 0, r.forecast ?? 0)));
    const top = Math.ceil(max / 5000) * 5000;
    return Array.from({ length: top / 5000 + 1 }, (_, i) => i * 5000);
  }, [rows]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Wind generation: actual vs forecast</h2>
          <p className="sub">GB national wind, MW. Forecast = the latest Elexon WINDFOR run available under the chosen rule.</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showPlanning} onChange={(e) => setShowPlanning(e.target.checked)} />
          Show P90 planning level
        </label>
      </div>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="line" style={{ background: "var(--series-1)" }} /> Actual (FUELHH)
        </span>
        <span>
          <i className="line" style={{ background: "var(--series-2)" }} /> Forecast (WINDFOR)
        </span>
        {showPlanning && (
          <span>
            <i className="line dashed" /> Forecast − P90 shortfall
          </span>
        )}
      </div>
      <div className="chart-wrap tall">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={fmtDay}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              stroke="var(--axis)"
            />
            <YAxis
              domain={[0, yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              stroke="var(--axis)"
              width={52}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }} />
            <Line dataKey="actual" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="forecast" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            {showPlanning && (
              <Line
                dataKey="planning"
                stroke="var(--text-secondary)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Brush dataKey="ts" height={26} stroke="var(--axis)" fill="var(--surface-2)" tickFormatter={fmtDay} travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="hint">Drag the handles under the chart to zoom into a period.</p>
    </div>
  );
}
