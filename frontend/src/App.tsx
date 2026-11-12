import { useEffect, useMemo, useState } from "react";
import { fetchAnalysis, fetchHorizonCurve, fetchMeta } from "./api";
import { Controls } from "./components/Controls";
import { DailyTable } from "./components/DailyTable";
import { HistogramChart } from "./components/HistogramChart";
import { HorizonChart } from "./components/HorizonChart";
import { KpiCards } from "./components/KpiCards";
import { TimeSeriesChart } from "./components/TimeSeriesChart";
import { fmtDateTime } from "./format";
import { buildInsights } from "./insights";
import type { Analysis, HorizonRow, Meta, Mode, Params } from "./types";

/** Read settings from the URL so a view can be shared as a link. */
function paramsFromUrl(defaults: Params): Params {
  const q = new URLSearchParams(window.location.search);
  const mode = q.get("mode");
  return {
    start: q.get("start") ?? defaults.start,
    end: q.get("end") ?? defaults.end,
    mode: mode === "horizon" || mode === "day_ahead" ? (mode as Mode) : defaults.mode,
    horizon: q.has("horizon") ? Number(q.get("horizon")) : defaults.horizon,
    gate: q.get("gate") ?? defaults.gate,
  };
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [curve, setCurve] = useState<HorizonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchMeta(ctrl.signal)
      .then((m) => {
        setMeta(m);
        setParams(paramsFromUrl(m.defaults));
      })
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!params) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      window.history.replaceState(null, "", `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`);
      Promise.all([fetchAnalysis(params, ctrl.signal), fetchHorizonCurve(params.start, params.end, ctrl.signal)])
        .then(([a, c]) => {
          setAnalysis(a);
          setCurve(c);
          setError(null);
        })
        .catch((e: Error) => e.name !== "AbortError" && setError(e.message))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 150); // debounce slider drags
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [params]);

  const insights = useMemo(
    () => (analysis ? buildInsights(analysis.params, analysis.metrics, analysis.daily, curve) : []),
    [analysis, curve],
  );

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <div>
            <h1>Wind Forecast Monitor</h1>
            <p>GB national wind forecasts vs actuals for day-ahead power procurement</p>
          </div>
        </div>
        {meta && (
          <div className="freshness" title="Data snapshot from the Elexon BMRS API">
            <span className="dot" aria-hidden="true" /> Elexon BMRS · {meta.sources.forecasts.runs} forecast runs · fetched{" "}
            {fmtDateTime(meta.sources.forecasts.fetchedAt)}
          </div>
        )}
      </header>

      {meta && params && <Controls meta={meta} params={params} onChange={setParams} />}

      {error && (
        <div className="error" role="alert">
          Could not load data: {error}
        </div>
      )}

      {analysis && (
        <main className={loading ? "content is-loading" : "content"} aria-busy={loading}>
          <KpiCards metrics={analysis.metrics} />

          {insights.length > 0 && (
            <section className="insights" aria-label="Key takeaways">
              {insights.map((i) => (
                <article key={i.title} className={`insight ${i.tone}`}>
                  <h3>
                    {i.tone === "warning" ? "⚠ " : ""}
                    {i.title}
                  </h3>
                  <p>{i.body}</p>
                </article>
              ))}
            </section>
          )}

          <TimeSeriesChart series={analysis.series} shortfallP90={analysis.metrics.shortfall_p90} />

          <div className="grid-2">
            <HorizonChart rows={curve} currentLead={analysis.metrics.mean_lead_hours} />
            <HistogramChart bins={analysis.histogram} />
          </div>

          <DailyTable rows={analysis.daily} />

          <section className="card method">
            <h2>Method and data</h2>
            <ul>
              <li>
                <b>Actuals:</b> Elexon <code>FUELHH</code>, fuel type <code>WIND</code>, half-hourly outturn (MW).
              </li>
              <li>
                <b>Forecasts:</b> Elexon <code>WINDFOR</code> national wind forecasts. Several runs are published each day, each covering
                hourly targets up to ~2.5 days ahead.
              </li>
              <li>
                <b>Which forecast counts:</b> for each target hour, the latest run published at or before the decision time. In{" "}
                <i>day-ahead</i> mode that is the gate time (UK) on the day before delivery. In <i>fixed lead time</i> mode it is the target
                time minus the lead time. Only values Elexon actually published are used; nothing is interpolated.
              </li>
              <li>
                <b>Error</b> = forecast − actual. Positive means wind delivered less than forecast, so extra power had to be bought. Metrics
                use hourly targets where both values exist.
              </li>
              <li>
                <b>Scope:</b> purchase decisions made in January 2026 (delivery 1 Jan – 1 Feb 2026). National level only.
              </li>
            </ul>
          </section>
        </main>
      )}

      {!analysis && !error && <div className="loading">Loading wind data…</div>}

      <footer className="footer">Pilot v1 · Data: Elexon BMRS (FUELHH, WINDFOR) · Times shown in UK local time</footer>
    </div>
  );
}
