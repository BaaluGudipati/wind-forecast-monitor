import { fmtGW, fmtLongDay } from "../format";
import type { DailyRow } from "../types";

export function DailyTable({ rows }: { rows: DailyRow[] }) {
  const maxMae = Math.max(1, ...rows.map((r) => r.mae ?? 0));
  const sorted = [...rows].filter((r) => r.mae !== null).sort((a, b) => (b.mae ?? 0) - (a.mae ?? 0));
  const worst = new Set(sorted.slice(0, 3).map((r) => r.day));

  const downloadCsv = () => {
    const header = "delivery_day,hourly_points,mae_mw,bias_mw,mean_actual_mw,actual_gwh";
    const lines = rows.map((r) => [r.day, r.count, r.mae ?? "", r.bias ?? "", r.mean_actual ?? "", r.actual_gwh].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wind-forecast-daily-accuracy.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Day by day</h2>
          <p className="sub">Accuracy per UK delivery day. The three worst days are flagged.</p>
        </div>
        <button type="button" className="ghost" onClick={downloadCsv}>
          Download CSV
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Delivery day</th>
              <th scope="col" className="num">
                Wind energy
              </th>
              <th scope="col" className="num">
                Bias
              </th>
              <th scope="col">Typical error (MAE)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>
                  {fmtLongDay(r.day)}
                  {worst.has(r.day) && <span className="flag">⚠ high error</span>}
                </td>
                <td className="num">{r.actual_gwh.toLocaleString("en-GB")} GWh</td>
                <td className="num">{fmtGW(r.bias, { signed: true })}</td>
                <td>
                  <div className="bar-cell">
                    <div className="bar" style={{ width: `${((r.mae ?? 0) / maxMae) * 100}%` }} />
                    <span>{fmtGW(r.mae)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
