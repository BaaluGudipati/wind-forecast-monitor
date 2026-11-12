import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import { fmtGW } from "../format";
import type { HistogramBin } from "../types";

function HistTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload as HistogramBin & { mid: number };
  return (
    <div className="tooltip">
      <div className="tooltip-title">
        Error {fmtGW(b.bin_start, { signed: true })} to {fmtGW(b.bin_end, { signed: true })}
      </div>
      <div className="tooltip-row">
        <b>{b.count}</b> hours · {b.mid > 0 ? "wind below forecast" : "wind above forecast"}
      </div>
    </div>
  );
}

export function HistogramChart({ bins }: { bins: HistogramBin[] }) {
  const data = bins.map((b) => ({ ...b, mid: (b.bin_start + b.bin_end) / 2 }));
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Distribution of forecast errors</h2>
          <p className="sub">Hours by error size (forecast − actual), 0.5 GW bins.</p>
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="block" style={{ background: "var(--short)" }} /> Wind below forecast (need to buy more)
        </span>
        <span>
          <i className="block" style={{ background: "var(--long)" }} /> Wind above forecast
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 18, left: 0 }} barCategoryGap={2}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="mid"
              type="number"
              domain={["dataMin - 250", "dataMax + 250"]}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}`}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              stroke="var(--axis)"
              label={{ value: "Error (GW)", position: "insideBottom", offset: -12, fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} stroke="var(--axis)" width={40} allowDecimals={false} />
            <Tooltip content={<HistTooltip />} cursor={{ fill: "var(--surface-2)" }} />
            <ReferenceLine x={0} stroke="var(--axis)" />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((b) => (
                <Cell key={b.bin_start} fill={b.mid > 0 ? "var(--short)" : "var(--long)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
