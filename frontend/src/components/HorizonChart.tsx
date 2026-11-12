import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { fmtMW } from "../format";
import type { HorizonRow } from "../types";

function HorizonTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as HorizonRow;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{r.lead_hours} h before delivery</div>
      <div className="tooltip-row">
        Typical error (MAE) <b>{fmtMW(r.mae)}</b>
      </div>
      <div className="tooltip-row">
        <span className="swatch" style={{ background: "var(--series-2)" }} /> Mean error (bias) <b>{fmtMW(r.bias, { signed: true })}</b>
      </div>
      <div className="tooltip-row muted">
        80% of errors between {fmtMW(r.p10_error, { signed: true })} and {fmtMW(r.p90_error, { signed: true })}
      </div>
      <div className="tooltip-row muted">{r.count.toLocaleString("en-GB")} forecast/actual pairs</div>
    </div>
  );
}

export function HorizonChart({ rows, currentLead }: { rows: HorizonRow[]; currentLead?: number }) {
  const data = rows.map((r) => ({ ...r, band: [r.p10_error, r.p90_error] as [number, number] }));
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>How error changes with lead time</h2>
          <p className="sub">All WINDFOR runs in the window, grouped by hours between publication and delivery.</p>
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="line" style={{ background: "var(--series-2)" }} /> Mean error (bias)
        </span>
        <span>
          <i className="block" style={{ background: "var(--band)" }} /> P10–P90 error range
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="lead_hours"
              type="number"
              domain={[0, 48]}
              ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              stroke="var(--axis)"
              label={{ value: "Lead time (hours)", position: "insideBottom", offset: -12, fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              stroke="var(--axis)"
              width={52}
            />
            <Tooltip content={<HorizonTooltip />} cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Area dataKey="band" stroke="none" fill="var(--band)" isAnimationActive={false} />
            <Line dataKey="bias" stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {currentLead !== undefined && (
              <ReferenceLine
                x={Math.round(currentLead)}
                stroke="var(--text-secondary)"
                strokeDasharray="4 4"
                label={{ value: "your decision", position: "insideTopRight", fill: "var(--text-secondary)", fontSize: 12 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
